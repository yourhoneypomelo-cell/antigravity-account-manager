import React, { useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useVault } from "../../context/VaultContext";
import { api } from "../../services/tauri";

export function UnlockVaultModal() {
  const { vaultStatus, unlock, isUnlockModalOpen, refreshStatus, showToast } =
    useVault();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isUnlockModalOpen) return null;

  const isInitialized = vaultStatus?.initialized ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const pw = password.trim();
    if (pw.length < 6) {
      setErrorMessage("主密码长度至少需要 6 个字符。");
      return;
    }

    if (!isInitialized) {
      if (pw !== confirmPassword.trim()) {
        setErrorMessage("两次输入的主密码不一致。");
        return;
      }
    }

    setIsSubmitting(true);
    const result = await unlock(pw);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || "密码不正确");
    }
  };

  const handleResetVault = async () => {
    if (
      !window.confirm(
        "确定要重置本地加密资料库吗？\n注意：重置将清空当前本地所有账号资料并允许您设定全新的主密码，旧密码无法找回。此操作不可恢复！"
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
    } catch (err) {
      showToast("重置失败", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-5 select-none animate-in fade-in duration-100">
      <div className="w-full max-w-[380px] bg-app-bg border border-app-border rounded-[12px] shadow-xl p-7 space-y-5 text-left text-app-text">
        {/* Title: 20px / 28px, font-weight 500, left aligned */}
        <div>
          <h2 className="text-[20px] leading-[28px] font-medium tracking-tight text-app-text">
            {isInitialized ? "解锁账号库" : "初始化账号库"}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Master Password Input */}
          <div className="space-y-1.5">
            <label className="block text-[13px] leading-[18px] font-medium text-app-secondary">
              {isInitialized ? "主密码" : "设定主密码（至少 6 位）"}
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="请输入主密码"
                autoFocus
                className="w-full h-[38px] pl-3 pr-10 rounded-md border border-app-border bg-app-input text-[14px] text-app-text placeholder:text-app-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent tracking-wider transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 p-1 text-app-muted hover:text-app-text rounded transition-colors"
                title={showPassword ? "隐藏密码" : "显示密码"}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password Input (Only when initializing) */}
          {!isInitialized && (
            <div className="space-y-1.5">
              <label className="block text-[12px] leading-[18px] font-medium text-app-secondary">
                再次确认主密码
              </label>
              <div className="relative flex items-center">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="请再次输入主密码"
                  className="w-full h-[38px] pl-3 pr-10 rounded-md border border-app-border bg-app-input text-[14px] text-app-text placeholder:text-app-muted focus:outline-none focus:ring-1 focus:ring-app-accent focus:border-app-accent tracking-wider transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-2 p-1 text-app-muted hover:text-app-text rounded transition-colors"
                  title={showConfirmPassword ? "隐藏密码" : "显示密码"}
                  aria-label={showConfirmPassword ? "隐藏密码" : "显示密码"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Quiet Error Notification */}
          {errorMessage && (
            <div className="flex items-center gap-1.5 text-[12px] text-rose-500 py-0.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Button: 38px high, font-weight 500, no arrow */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-[38px] rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[13px] leading-[18px] font-medium shadow-xs transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{isSubmitting ? "正在解锁..." : isInitialized ? "解锁" : "创建账号库"}</span>
          </button>
        </form>

        {/* Low frequency reset option */}
        {isInitialized && (
          <div className="pt-1 flex items-center justify-between text-[11px] text-app-muted">
            <button
              type="button"
              onClick={handleResetVault}
              className="text-app-muted hover:text-rose-500 transition-colors"
            >
              忘记密码？重置资料库
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
