import React, { useState } from "react";
import { Eye, EyeOff, AlertCircle, Sun, Moon, Loader2, LockKeyhole } from "lucide-react";
import { useVault } from "@/context/VaultContext";
import { api } from "@/services/tauri";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function LockScreen() {
  const { vaultStatus, isLoading, unlock, refreshStatus, darkMode, toggleDarkMode, showToast } = useVault();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isInitialized = vaultStatus?.initialized ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultStatus || isSubmitting) return;
    setErrorMessage(null);

    const pw = password.trim();
    if (!pw || (!isInitialized && pw.length < 6)) {
      setErrorMessage("主密码长度至少需要 6 个字符");
      return;
    }

    if (!isInitialized && pw !== confirmPassword.trim()) {
      setErrorMessage("两次输入的主密码不一致");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await unlock(pw);
      if (!result.success) {
        setErrorMessage(result.error || "主密码不正确，请重新输入");
      }
    } catch {
      setErrorMessage("无法解锁，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetVault = async () => {
    if (
      !window.confirm(
        "确定要重置本地加密资料库吗？\n注意：重置将清空当前本地所有账号资料并创建全新的资料库，此操作不可撤销！"
      )
    ) {
      return;
    }
    try {
      await api.resetVault();
      await refreshStatus();
      setPassword("");
      setConfirmPassword("");
      setErrorMessage(null);
      showToast("资料库已重置，请设定新的主密码", "info");
    } catch {
      showToast("重置失败", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-foreground select-none">
      <header className="h-12 px-4 flex items-center justify-between shrink-0 border-b border-border-subtle bg-sidebar">
        <div className="flex items-center gap-2.5">
          <img src="/branding/antigravity-v3-small.svg" alt="" aria-hidden="true" className="w-6 h-6 shrink-0" />
          <span className="text-[16px] leading-6 font-medium tracking-[-0.02em]">Antigravity Account Manager</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="text-muted-foreground hover:text-foreground"
              aria-label={darkMode ? "切换至浅色模式" : "切换至深色模式"}
            >
              {darkMode ? <Sun className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" /> : <Moon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{darkMode ? "浅色模式" : "深色模式"}</TooltipContent>
        </Tooltip>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12 sm:pb-24">
        {!vaultStatus ? (
          <div className="w-full max-w-[360px] text-center space-y-4" role="status">
            {isLoading || isRetrying ? (
              <>
                <Loader2 className="w-5 h-5 mx-auto animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">正在打开账号库</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">暂时无法读取账号库</p>
                <Button variant="outline" onClick={async () => {
                  setIsRetrying(true);
                  try { await refreshStatus(); } finally { setIsRetrying(false); }
                }}>重试</Button>
              </>
            )}
          </div>
        ) : (
        <div className="w-full max-w-[360px]">
          <div className="mb-7">
            <div className="mb-5 text-muted-foreground">
              <LockKeyhole className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h1 className="text-[22px] leading-[30px] font-medium text-foreground">
              {isInitialized ? "账号库已锁定" : "创建账号库"}
            </h1>
            {!isInitialized && <p className="mt-2 text-[13px] leading-5 text-muted-foreground">设置主密码，至少 6 个字符。</p>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <Label htmlFor="lock-master-pw" className="mb-1.5 block">
                主密码
              </Label>
              <div className="relative flex items-center">
                <Input
                  id="lock-master-pw"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isInitialized ? "current-password" : "new-password"}
                  disabled={isSubmitting}
                  aria-invalid={!!errorMessage}
                  aria-describedby={errorMessage ? "lock-error" : undefined}
                  autoFocus
                  className="h-[42px] pl-3 pr-10 text-[14px] leading-[22px]"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isSubmitting}
                  className="w-8 h-8 absolute right-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>

            {!isInitialized && (
              <div>
                <Label htmlFor="lock-confirm-pw" className="mb-1.5 block">
                  确认主密码
                </Label>
                <Input
                  id="lock-confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  aria-invalid={!!errorMessage}
                  aria-describedby={errorMessage ? "lock-error" : undefined}
                  className="h-[42px] px-3 text-[14px] leading-[22px]"
                />
              </div>
            )}

            {errorMessage && (
              <div id="lock-error" role="alert" className="flex items-start gap-1.5 text-[12px] leading-[18px] text-destructive py-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="default"
              disabled={isSubmitting || !password.trim()}
              aria-busy={isSubmitting}
              className="w-full h-10 text-[13px] font-medium gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              <span>{isSubmitting ? (isInitialized ? "解锁中" : "创建中") : isInitialized ? "解锁" : "创建账号库"}</span>
            </Button>
          </form>

          {isInitialized && (
            <details className="mt-7 text-[12px] leading-[18px] text-muted-foreground">
              <summary className="w-fit rounded-sm cursor-pointer hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">无法解锁？</summary>
              <p className="mt-3 leading-5">重置会清空本机的全部账号记录，且无法撤销。</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetVault}
                disabled={isSubmitting}
                className="mt-2 -ml-2 px-2 text-destructive hover:text-destructive"
              >
                重置资料库
              </Button>
            </details>
          )}
        </div>
        )}
      </main>
    </div>
  );
}
