import React, { useEffect, useRef, useState } from "react";
import { Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useVault } from "../../context/VaultContext";
import { api } from "../../services/tauri";
import { ChromeProfileBinding, DetectedBrowserProfile, AccountSummary } from "../../types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { cn } from "../../lib/utils";

export function AddAccountModal() {
  const {
    accounts,
    isAddModalOpen,
    setIsAddModalOpen,
    setSelectedAccountId,
    refreshAccounts,
    showToast,
  } = useVault();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedProfile, setDetectedProfile] = useState<DetectedBrowserProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 自动填入视觉特效反馈状态
  const [emailFilledFeedback, setEmailFilledFeedback] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 覆盖确认弹窗状态
  const [isOverwriteOpen, setIsOverwriteOpen] = useState(false);
  const [existingAccount, setExistingAccount] = useState<AccountSummary | null>(null);
  const [isOverwriting, setIsOverwriting] = useState(false);

  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Reset when dialog opens or closes
  useEffect(() => {
    if (!isAddModalOpen) {
      setEmail("");
      setDisplayName("");
      setDetectedProfile(null);
      setErrorMsg(null);
      setIsDetecting(false);
      setIsOverwriteOpen(false);
      setExistingAccount(null);
      setIsOverwriting(false);
      setEmailFilledFeedback(false);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    }
  }, [isAddModalOpen]);

  const handleAutoDetectFromBrowser = async () => {
    if (isDetecting || isSubmitting) return;
    setIsDetecting(true);
    setErrorMsg(null);
    try {
      const detected = await api.getActiveBrowserProfile();
      if (!mounted.current) return;
      setDetectedProfile(detected);
      if (detected.email) {
        setEmail(detected.email);
        setEmailFilledFeedback(true);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => {
          if (mounted.current) setEmailFilledFeedback(false);
        }, 3000);
        showToast(`已从最新活动 Chrome 窗口提取：${detected.email}`, "info");
        setTimeout(() => {
          emailInputRef.current?.focus();
        }, 60);
      } else {
        showToast(`已捕获 Chrome 配置「${detected.profile_name}」，请手动输入该配置登录的邮箱`, "info");
        emailInputRef.current?.focus();
      }
    } catch (err: any) {
      if (!mounted.current) return;
      const msg = typeof err === "string" ? err : err?.message || "未检测到活动的 Chrome 浏览器配置";
      setErrorMsg(msg);
    } finally {
      if (mounted.current) setIsDetecting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setErrorMsg(null);
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !emailTrimmed.includes("@")) {
      setErrorMsg("请输入有效的邮箱地址。");
      return;
    }

    // 1. 本地前置查重：如果已经存在该邮箱，弹出覆盖/退出选择
    const matched = accounts.find(
      (a) => a.email.toLowerCase() === emailTrimmed.toLowerCase()
    );
    if (matched) {
      setExistingAccount(matched);
      setIsOverwriteOpen(true);
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    let createdId: string | null = null;
    try {
      const newId = await api.createAccount(emailTrimmed, displayName.trim() || undefined);
      if (!mounted.current) return;
      createdId = newId;

      // 如果通过一键导入或已关联浏览器配置，自动绑定好 Chrome 配置
      if (detectedProfile) {
        const binding: ChromeProfileBinding = {
          executable_path: detectedProfile.executable_path,
          profile_path: detectedProfile.profile_path,
        };
        await api.saveAccountChromeProfile(newId, binding).catch((err) => {
          console.warn("Failed to auto-save chrome profile:", err);
        });
      }

      await refreshAccounts();
      if (!mounted.current) return;
      setSelectedAccountId(newId);
      setIsAddModalOpen(false);
      showToast(
        detectedProfile ? "账号已添加并自动绑定 Chrome 首页" : "账号已添加",
        "success"
      );
    } catch (error: any) {
      if (!mounted.current) return;
      if (createdId) {
        setIsAddModalOpen(false);
        showToast("账号已添加，请重新打开列表以刷新。", "warning");
      } else {
        const errorStr = typeof error === "string" ? error : error?.message || "";
        // 捕获唯一键冲突或已存在异常，转为弹窗提示
        if (
          errorStr.includes("UNIQUE constraint failed") ||
          errorStr.includes("already exist") ||
          errorStr.includes("已经存在")
        ) {
          const found = accounts.find(
            (a) => a.email.toLowerCase() === emailTrimmed.toLowerCase()
          );
          if (found) setExistingAccount(found);
          setIsOverwriteOpen(true);
        } else {
          setErrorMsg(errorStr || "添加失败，请检查邮箱是否已存在。");
        }
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  };

  // 用户点击“覆盖”执行覆盖逻辑
  const handleConfirmOverwrite = async () => {
    if (isOverwriting || !mounted.current) return;
    const emailTrimmed = email.trim();
    const matched =
      existingAccount ||
      accounts.find((a) => a.email.toLowerCase() === emailTrimmed.toLowerCase());

    if (!matched) {
      setErrorMsg("未在本地找到已存在的对应账号。");
      setIsOverwriteOpen(false);
      return;
    }

    setIsOverwriting(true);
    try {
      // 1. 如果用户填写了新备注名，更新账号基础信息
      const newDisplayName = displayName.trim() || matched.display_name;
      await api.updateBasicInfo(
        matched.id,
        matched.email,
        newDisplayName,
        matched.purpose || "未记录",
        matched.tags || [],
        matched.is_favorite || false,
        matched.status || "未记录",
        null,
        matched.last_verified_at,
        matched.data_source
      );

      // 2. 如果关联了浏览器配置，更新绑定的 Chrome 配置
      if (detectedProfile) {
        const binding: ChromeProfileBinding = {
          executable_path: detectedProfile.executable_path,
          profile_path: detectedProfile.profile_path,
        };
        await api.saveAccountChromeProfile(matched.id, binding).catch((err) => {
          console.warn("Failed to overwrite chrome profile:", err);
        });
      }

      await refreshAccounts();
      if (!mounted.current) return;
      setSelectedAccountId(matched.id);
      setIsOverwriteOpen(false);
      setIsAddModalOpen(false);
      showToast(
        detectedProfile
          ? "已覆盖账号并更新 Chrome 绑定"
          : "已成功覆盖更新该账号",
        "success"
      );
    } catch (err: any) {
      if (!mounted.current) return;
      const msg = typeof err === "string" ? err : err?.message || "覆盖操作失败";
      showToast(msg, "error");
    } finally {
      if (mounted.current) setIsOverwriting(false);
    }
  };

  return (
    <>
      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          if (!submitting.current) setIsAddModalOpen(open);
        }}
      >
        <DialogContent className="max-w-[380px]" hideCloseButton={isSubmitting}>
          <DialogHeader>
            <DialogTitle>新增账号</DialogTitle>
            <DialogDescription className="sr-only">新增账号</DialogDescription>
          </DialogHeader>

          <div className="pt-0.5 pb-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSubmitting || isDetecting}
              onClick={handleAutoDetectFromBrowser}
              className="w-full gap-2 text-xs font-medium border border-border bg-secondary hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] text-foreground h-9 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>
                {isDetecting ? (
                  <>
                    正在抓取{" "}
                    <span className="underline underline-offset-4">最新活动浏览器窗口</span>
                    {" "}配置…
                  </>
                ) : (
                  <>
                    一键从{" "}
                    <span className="underline underline-offset-4">最新活动浏览器窗口</span>
                    {" "}配置
                  </>
                )}
              </span>
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-account-email">Google 邮箱</Label>
                {emailFilledFeedback && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 animate-in fade-in slide-in-from-right-1 duration-200">
                    <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
                    已自动提取填入
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  ref={emailInputRef}
                  id="new-account-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailFilledFeedback) setEmailFilledFeedback(false);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="name@gmail.com"
                  disabled={isSubmitting}
                  aria-invalid={!!errorMsg}
                  aria-describedby={errorMsg ? "new-account-error" : undefined}
                  className={cn(
                    "transition-all duration-300",
                    emailFilledFeedback &&
                      "animate-input-fill border-blue-500 ring-2 ring-blue-500/25 bg-blue-500/[0.04] dark:bg-blue-500/10 pr-20"
                  )}
                />
                {emailFilledFeedback && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full pointer-events-none select-none animate-in fade-in zoom-in-95 duration-200">
                    <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
                    <span>已填入</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-account-name">备注名（选填）</Label>
              <Input
                id="new-account-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="工作账号"
                disabled={isSubmitting}
              />
            </div>

            {detectedProfile && (
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-blue-500/10 border border-blue-500/20 text-[12px] font-medium text-blue-600 dark:text-blue-400 text-center animate-in fade-in zoom-in-95 duration-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-500" />
                <span>Chrome启动链接成功关联该账号</span>
              </div>
            )}
            {errorMsg && (
              <p id="new-account-error" role="alert" className="text-[13px] text-destructive">
                {errorMsg}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => setIsAddModalOpen(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="min-w-20"
                disabled={isSubmitting || !email.trim()}
              >
                {isSubmitting ? "添加中…" : "添加"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 账号已存在覆盖提示弹窗（退出在右侧，覆盖在左侧，精炼美观设计） */}
      <Dialog
        open={isOverwriteOpen}
        onOpenChange={(open) => {
          if (!isOverwriting) setIsOverwriteOpen(open);
        }}
      >
        <DialogContent className="max-w-[360px]" hideCloseButton={isOverwriting}>
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 text-amber-500 shrink-0">
                <AlertCircle className="w-4 h-4" />
              </span>
              <DialogTitle className="text-[15px] font-semibold text-foreground">
                账号已存在
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-0.5">
              该邮箱在资料库中已存在，是否覆盖更新其配置？
            </DialogDescription>
          </DialogHeader>

          {/* 目标账号与关联信息精简卡片 */}
          <div className="rounded-lg border border-border-subtle bg-muted/40 dark:bg-muted/20 p-3 my-1 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground shrink-0">目标邮箱</span>
              <span className="font-mono-numbers font-medium text-foreground truncate select-all" title={email.trim()}>
                {email.trim()}
              </span>
            </div>
            {detectedProfile && (
              <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-border-subtle/60">
                <span className="text-muted-foreground shrink-0">关联浏览器</span>
                <span className="font-medium text-blue-600 dark:text-blue-400 truncate">
                  {detectedProfile.profile_name}
                  {detectedProfile.display_name ? ` (${detectedProfile.display_name})` : ""}
                </span>
              </div>
            )}
          </div>

          {/* 选项操作区：覆盖在左侧，退出在右侧 */}
          <div className="flex items-center gap-2.5 pt-2 w-full">
            <Button
              type="button"
              variant="default"
              disabled={isOverwriting}
              onClick={handleConfirmOverwrite}
              className="flex-1 h-9 cursor-pointer"
            >
              {isOverwriting ? "正在覆盖…" : "覆盖"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isOverwriting}
              onClick={() => setIsOverwriteOpen(false)}
              className="flex-1 h-9 cursor-pointer"
            >
              退出
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
