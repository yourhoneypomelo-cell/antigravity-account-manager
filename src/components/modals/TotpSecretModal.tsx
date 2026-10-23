import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { cleanTotpSecret, isValidTotpSecret, generateTotpCode } from "../../utils/totp";
import { copyWithAutoClear } from "../../utils/clipboard";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

interface TotpSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSecret: string;
  onApply: (secret: string) => void;
  onDelete: () => void;
}

export function TotpSecretModal({ isOpen, onClose, currentSecret, onApply, onDelete }: TotpSecretModalProps) {
  const [secret, setSecret] = useState(currentSecret);
  const [showSecret, setShowSecret] = useState(false);
  const [showCode, setShowCode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSecret(currentSecret);
      setShowSecret(false);
      setShowCode(true);
      setCopied(false);
      setError(null);
    } else {
      setSecret("");
      setShowSecret(false);
      setShowCode(true);
      setCopied(false);
    }
  }, [isOpen, currentSecret]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  const cleaned = cleanTotpSecret(secret);
  const preview = cleaned && isValidTotpSecret(cleaned) ? generateTotpCode(cleaned) : null;

  const handleCopyCode = async () => {
    if (!preview?.code) return;
    await copyWithAutoClear(preview.code, "动态登录验证码", 30, () => {});
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopied(true);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1400);
  };

  const handleApply = () => {
    if (cleaned && !isValidTotpSecret(cleaned)) { setError("密钥格式有误，请检查后重试。"); return; }
    try { onApply(cleaned); onClose(); } catch { setError("应用失败，请重试。"); }
  };
  const handleDelete = () => {
    if (!window.confirm("移除本地保存的验证器密钥？")) return;
    try { onDelete(); onClose(); } catch { setError("移除失败，请重试。"); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{currentSecret ? "验证器密钥" : "添加验证器密钥"}</DialogTitle>
          <DialogDescription className="sr-only">录入生成动态验证码的密钥，应用后需保存账号修改。</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="totp-secret">密钥</Label>
          <div className="relative">
            <Input id="totp-secret" type={showSecret ? "text" : "password"} value={secret} onChange={(e) => { setSecret(e.target.value); setError(null); }} placeholder="粘贴密钥" autoFocus autoComplete="off" spellCheck={false} className="pr-11 font-mono" aria-invalid={!!error} aria-describedby={error ? "totp-secret-error" : undefined} />
            <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-[3px]" onClick={() => setShowSecret((value) => !value)} aria-label={showSecret ? "隐藏密钥" : "显示密钥"}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {error && <p id="totp-secret-error" role="alert" className="text-[13px] text-destructive">{error}</p>}
        {preview && (
          <div className="flex items-center justify-between py-1">
            <span className="text-[13px] text-muted-foreground">动态验证码</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-lg font-medium tabular-nums tracking-wide select-text">
                {showCode ? preview.formatted : "••• •••"}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-all duration-150 active:scale-[0.94] [&_svg]:h-3.5 [&_svg]:w-3.5"
                    onClick={() => setShowCode((value) => !value)}
                    aria-label={showCode ? "隐藏动态验证码" : "显示动态验证码"}
                  >
                    {showCode ? <EyeOff /> : <Eye />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{showCode ? "隐藏动态验证码" : "显示动态验证码"}</TooltipContent>
              </Tooltip>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-7 min-w-[62px] px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={handleCopyCode}
                aria-label="复制动态验证码"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "已复制" : "复制"}
              </Button>
            </div>
          </div>
        )}
        <DialogFooter className="justify-between">
          <div>{currentSecret && <Button type="button" variant="ghost" className="text-destructive" onClick={handleDelete}>移除密钥</Button>}</div>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button type="button" onClick={handleApply}>应用</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
