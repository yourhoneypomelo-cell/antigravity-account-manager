import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { ChromeProfileBinding } from "../../types";
import { api, isBrowserPreview } from "../../services/tauri";
import { useVault } from "../../context/VaultContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const pathText = (value: string) => value.trim().replace(/^"(.*)"$/, "$1");
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export function ChromeProfileControl({ accountId, email }: { accountId: string; email: string }) {
  const { showToast } = useVault();
  const [binding, setBinding] = useState<ChromeProfileBinding | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [profilePath, setProfilePath] = useState("");
  const [executablePath, setExecutablePath] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    setLoaded(false);
    setLoadError("");
    api.getAccountChromeProfile(accountId).then(value => {
      if (active) { setBinding(value); setLoaded(true); }
    }).catch(reason => {
      if (active) { setLoadError(errorText(reason)); setLoaded(true); }
    });
    return () => { active = false; mounted.current = false; };
  }, [accountId]);

  const configure = () => {
    setProfilePath(binding?.profile_path || "");
    setExecutablePath(binding?.executable_path || "");
    setError(loadError);
    setOpen(true);
  };

  const save = async (remove = false) => {
    if (pending.current) return;
    const next = remove ? null : { profile_path: pathText(profilePath), executable_path: pathText(executablePath) };
    if (next && (!next.profile_path || !next.executable_path)) { setError("请填写两项完整路径。"); return; }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api.saveAccountChromeProfile(accountId, next);
      if (!mounted.current) return;
      setBinding(next);
      setLoadError("");
      setOpen(false);
    } catch (reason) {
      if (mounted.current) setError(errorText(reason));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const launch = async () => {
    if (!binding || loadError) { configure(); return; }
    if (pending.current) return;
    pending.current = true;
    setLaunching(true);
    try {
      await api.openAccountChrome(accountId);
    } catch (reason) {
      if (mounted.current) showToast(errorText(reason), "error");
    } finally {
      pending.current = false;
      if (mounted.current) setLaunching(false);
    }
  };

  const profileName = pathText(binding?.profile_path || "").replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  const draftParts = pathText(profilePath).replace(/[\\/]+$/, "").split(/[\\/]/);
  const draftDirectory = draftParts.length > 1 ? draftParts.pop() : "";

  return (
    <>
      <div className="flex shrink-0">
        {!binding ? (
          // 未配置绑定状态：仅显示“设置chrome账号绑定”，无下拉
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!loaded || launching}
                onClick={configure}
                aria-label="设置chrome账号绑定"
                className="h-8 w-8 min-[860px]:w-auto p-0 min-[860px]:px-2.5 text-xs gap-1.5 font-normal border-border-subtle text-muted-foreground hover:text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden min-[860px]:inline">设置chrome账号绑定</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>设置chrome账号绑定</span>
            </TooltipContent>
          </Tooltip>
        ) : (
          // 已配置绑定状态：主按钮为“账号chrome首页”，下拉为“修改chrome账号绑定”
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!loaded || launching}
                  onClick={launch}
                  aria-label="账号chrome首页"
                  className="h-8 text-xs gap-1.5 font-normal rounded-r-none border-r-0 border-border-subtle text-muted-foreground hover:text-foreground hover:bg-accent hover:border-control-hover transition-all duration-150 active:scale-[0.98] cursor-pointer"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden min-[860px]:inline">
                    {launching ? "正在打开…" : "账号chrome首页"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>{launching ? "正在打开 Chrome…" : `账号chrome首页 · ${profileName || "已绑定"}`}</span>
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Chrome 配置选项"
                  disabled={launching}
                  className="h-8 w-6 p-0 rounded-l-none border-border-subtle text-muted-foreground hover:text-foreground hover:bg-accent hover:border-control-hover transition-all duration-150 active:scale-[0.98] cursor-pointer"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={configure} className="cursor-pointer">
                  修改chrome账号绑定
                </DropdownMenuItem>
                {profileName && (
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground border-t border-border-subtle mt-1 pt-1 select-text">
                    当前配置：{profileName}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={value => { if (!pending.current) setOpen(value); }}>
        <DialogContent
          className="max-w-[520px]"
          hideCloseButton={busy}
          onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
          onPointerDownOutside={event => { if (busy) event.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>{binding ? "修改chrome账号绑定" : "设置chrome账号绑定"}</DialogTitle>
            <DialogDescription className="break-all">{email}</DialogDescription>
          </DialogHeader>
          <p className="text-[13px] leading-6 text-muted-foreground">
            保证<strong className="font-semibold text-foreground">最新活动的浏览器窗口</strong>登录本账号，打开 <code className="rounded bg-secondary px-1.5 py-0.5 text-foreground select-text">chrome://version</code> 填写以下内容。
          </p>
          <fieldset disabled={busy} className="space-y-4 min-w-0">
            <div className="space-y-1.5">
              <Label htmlFor="chrome-profile-path">个人资料路径（Profile Path）</Label>
              <Input
                id="chrome-profile-path"
                value={profilePath}
                onChange={event => { setProfilePath(event.target.value); setError(""); }}
                placeholder="C:\Users\用户名\AppData\Local\Google\Chrome\User Data\Profile 3"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chrome-executable-path">可执行文件路径（Executable Path）</Label>
              <Input
                id="chrome-executable-path"
                value={executablePath}
                onChange={event => { setExecutablePath(event.target.value); setError(""); }}
                placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </fieldset>
          {draftDirectory && (
            <p className="text-xs text-muted-foreground">
              将打开配置：<span className="text-foreground select-text">{draftDirectory}</span>
            </p>
          )}
          {isBrowserPreview && (
            <p className="text-xs text-muted-foreground">演示模式仅临时保存绑定；启动 Chrome 需使用桌面程序。</p>
          )}
          {error && <p role="alert" className="text-[13px] text-destructive break-words">{error}</p>}
          <DialogFooter className="justify-between">
            <div>
              {binding && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => save(true)}>
                  解除绑定
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button
                size="sm"
                disabled={busy || !profilePath.trim() || !executablePath.trim()}
                onClick={() => save()}
              >
                {busy ? "保存中…" : "保存绑定"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
