import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  KeyRound,
  Mail,
  Phone,
  FileText,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  CheckCircle2,
  ClipboardPaste,
  Crown,
} from "lucide-react";
import { api } from "../../services/tauri";
import { ScrapedSecurityData } from "../../types";

interface AutoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  email: string;
  currentAuth: {
    twoFactorStatus: string;
    skipPasswordStatus: string;
    totpStatus: string;
    totpAddedAt?: string | null;
  };
  currentRecovery: {
    hasRecoveryEmail: string;
    recoveryEmail: string;
    recoveryEmailVerified: string;
    hasRecoveryPhone: string;
    recoveryPhone: string;
    recoveryPhoneVerified: string;
  };
  currentMembership?: {
    status: string;
    plan: string;
    startDate: string;
  };
  backupCodesCount: number;
  onApply: (data: ScrapedSecurityData) => Promise<void>;
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
}

// Concise parser for Google Security page
export function parseSecurityText(raw: string): ScrapedSecurityData | null {
  if (!raw || !raw.trim()) return null;
  const clean = raw.replace(/\r\n/g, "\n").trim();

  try {
    const json = JSON.parse(clean);
    if (
      typeof json === "object" &&
      json !== null &&
      (json.two_factor_status || json.recovery_email || json.recovery_phone || json.skip_password_status)
    ) {
      return json as ScrapedSecurityData;
    }
  } catch {
    // Continue to text parser
  }

  const res: ScrapedSecurityData = {};

  // Recovery Phone & 2-Step Verification Phones
  const recPhoneMatch = clean.match(/(?:Recovery phone|辅助电话|恢复电话|密保手机)[\s:\-\n]+([+0-9\s-]{6,20})/i);
  if (recPhoneMatch) {
    res.recovery_phone = recPhoneMatch[1].trim();
    res.has_recovery_phone = "有";
    res.recovery_phone_verified = "已验证";
  }

  const twoFaPhoneMatch = clean.match(/(?:2-Step Verification phones|两步验证电话|两步验证手机)[\s:\-\n]+([+0-9\s-]{6,20})/i);
  if (twoFaPhoneMatch) {
    res.two_factor_phone = twoFaPhoneMatch[1].trim();
    if (!res.recovery_phone) {
      res.recovery_phone = res.two_factor_phone;
      res.has_recovery_phone = "有";
      res.recovery_phone_verified = "已验证";
    }
  }

  if (!res.recovery_phone) {
    const fallbackPhone = clean.match(/(?:^|\n)\s*([1-9]\d{2}[\s-]?\d{4}[\s-]?\d{4})\s*(?:$|\n)/);
    if (fallbackPhone) {
      res.recovery_phone = fallbackPhone[1].trim();
      res.has_recovery_phone = "有";
      res.recovery_phone_verified = "已验证";
    }
  }

  // Recovery Email
  const recEmailMatch = clean.match(/(?:Recovery email|辅助邮箱|恢复邮箱)[\s:\-\n]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (recEmailMatch) {
    res.recovery_email = recEmailMatch[1].trim();
    res.has_recovery_email = "有";
    res.recovery_email_verified = "已验证";
  } else {
    const allEmails = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const valid = allEmails.filter(e => !e.endsWith("@google.com") && !e.includes("myaccount"));
    if (valid.length > 0) {
      res.recovery_email = valid[0].trim();
      res.has_recovery_email = "有";
      res.recovery_email_verified = "已验证";
    }
  }

  // 2-Step Verification
  const twoFaMatch = clean.match(/(?:2-Step Verification|两步验证)[\s:\-\n]+(On|Off|开启|关闭|已开启|未开启)/i);
  if (twoFaMatch) {
    const val = twoFaMatch[1].toLowerCase();
    res.two_factor_status = val === "off" || val === "关闭" || val === "未开启" ? "关闭" : "开启";
  } else if (clean.includes("2-Step Verification") || clean.includes("两步验证")) {
    res.two_factor_status = "开启";
  }

  // Skip Password
  const skipPwdMatch = clean.match(/(?:Skip password when possible|尽可能跳过密码)[\s:\-\n]+(On|Off|开启|关闭|已开启|未开启)/i);
  if (skipPwdMatch) {
    const val = skipPwdMatch[1].toLowerCase();
    res.skip_password_status = val === "off" || val === "关闭" || val === "未开启" ? "关闭" : "开启";
  } else {
    res.skip_password_status = "开启";
  }

  // Authenticator
  const notAddedMatch = clean.match(/(?:Authenticator|身份验证器)[\s:\-\n]+(Not added|未添加|Off|关闭)/i);
  if (notAddedMatch) {
    res.totp_status = "关闭";
    res.totp_added_at = null;
  } else {
    const totpAddedMatch = clean.match(/(?:Authenticator|身份验证器)[\s:\-\n]+(?:Added|已添加)\s*([^\n]+)/i);
    if (totpAddedMatch) {
      res.totp_status = "开启";
      res.totp_added_at = totpAddedMatch[1].trim();
    } else if (clean.includes("Authenticator") || clean.includes("身份验证器")) {
      res.totp_status = "开启";
    }
  }

  // Backup codes
  const backupMatch = clean.match(/(?:Backup codes|备用验证码|备用代码)[\s:\-\n]+(\d+)\s*(?:codes available|个可用|剩余|个剩余|条剩余|remaining)/i);
  if (backupMatch) {
    res.backup_codes_status = "开启";
    res.backup_codes_remaining = parseInt(backupMatch[1], 10);
  } else if (clean.includes("Backup codes") || clean.includes("备用验证码")) {
    res.backup_codes_status = "开启";
    const countMatch = clean.match(/(\d+)\s*(?:codes available|个可用|剩余|条剩余|remaining)/i);
    res.backup_codes_remaining = countMatch ? parseInt(countMatch[1], 10) : 10;
  }

  // Membership / Subscription
  if (/AI\s*Ultra/i.test(clean)) {
    res.membership_plan = "AI Ultra";
    res.membership_status = "有效";
  } else if (/Google\s*AI[\s\n]+Pro|AI\s*Pro/i.test(clean)) {
    res.membership_plan = "AI Pro";
    res.membership_status = "有效";
  } else if (/AI\s*Plus|AI\s*Premium/i.test(clean)) {
    res.membership_plan = "AI Plus";
    res.membership_status = "有效";
  } else if (/Current plan|当前套餐|当前方案/i.test(clean)) {
    res.membership_status = "有效";
    if (/Pro/i.test(clean)) res.membership_plan = "AI Pro";
    else if (/Ultra/i.test(clean)) res.membership_plan = "AI Ultra";
    else if (/Plus|Premium/i.test(clean)) res.membership_plan = "AI Plus";
    else res.membership_plan = "其他";
  } else if (/Upgrade to Google One|升级到 Google One/i.test(clean)) {
    res.membership_status = "未开通";
    res.membership_plan = "免费";
  }

  // Member date
  const memberSinceMatch = clean.match(/Member since\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (memberSinceMatch) {
    const monthsMap: Record<string, string> = {
      january: "01", jan: "01", february: "02", feb: "02", march: "03", mar: "03", april: "04", apr: "04",
      may: "05", june: "06", jun: "06", july: "07", jul: "07", august: "08", aug: "08",
      september: "09", sep: "09", sept: "09", october: "10", oct: "10", november: "11", nov: "11", december: "12", dec: "12"
    };
    const mStr = memberSinceMatch[1].toLowerCase();
    const dStr = memberSinceMatch[2].padStart(2, "0");
    const yStr = memberSinceMatch[3];
    res.membership_start_date = `${yStr}-${monthsMap[mStr] || "01"}-${dStr}`;
  } else {
    const cnDateMatch = clean.match(/(?:自|于|从|since)?\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (cnDateMatch) {
      res.membership_start_date = `${cnDateMatch[1]}-${cnDateMatch[2].padStart(2, "0")}-${cnDateMatch[3].padStart(2, "0")}`;
    }
  }

  if (
    res.two_factor_status ||
    res.recovery_email ||
    res.recovery_phone ||
    res.backup_codes_remaining !== undefined ||
    res.membership_status ||
    res.membership_plan
  ) {
    res.raw_source = "Google 页面实时提取";
    res.extracted_at = new Date().toISOString();
    return res;
  }

  return null;
}

export function AutoConfigModal({
  isOpen,
  onClose,
  accountId,
  email,
  currentAuth,
  currentRecovery,
  currentMembership,
  backupCodesCount,
  onApply,
  showToast,
}: AutoConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [crawlStageText, setCrawlStageText] = useState("");
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [scrapedData, setScrapedData] = useState<ScrapedSecurityData | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [applying, setApplying] = useState(false);
  const [activeStep, setActiveStep] = useState<"idle" | "listening" | "ready" | "done">("idle");
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Micro-script to extract Google Security data in browser DevTools Console
  const extractorScript = `(() => {
  try {
    const text = (document.body ? document.body.innerText : '').replace(/\\r\\n/g, '\\n');
    let recPhone = '';
    let twoFaPhone = '';
    const recPhoneMatch = text.match(/(?:Recovery phone|辅助电话|恢复电话|密保手机)[\\s:\\-\\n]+([+0-9\\s-]{6,20})/i);
    if (recPhoneMatch) recPhone = recPhoneMatch[1].trim();
    const twoFaPhoneMatch = text.match(/(?:2-Step Verification phones|两步验证电话|两步验证手机)[\\s:\\-\\n]+([+0-9\\s-]{6,20})/i);
    if (twoFaPhoneMatch) twoFaPhone = twoFaPhoneMatch[1].trim();
    if (!recPhone && twoFaPhone) recPhone = twoFaPhone;
    if (!twoFaPhone && recPhone) twoFaPhone = recPhone;
    if (!recPhone) {
      const generalPhone = text.match(/(?:^|\\n)\\s*([1-9]\\d{2}[\\s-]?\\d{4}[\\s-]?\\d{4})\\s*(?:$|\\n)/);
      if (generalPhone) { recPhone = generalPhone[1].trim(); twoFaPhone = recPhone; }
    }
    let recEmail = '';
    const recEmailMatch = text.match(/(?:Recovery email|辅助邮箱|恢复邮箱)[\\s:\\-\\n]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/i);
    if (recEmailMatch) {
      recEmail = recEmailMatch[1].trim();
    } else {
      const allEmails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g) || [];
      const valid = allEmails.filter(e => !e.endsWith('@google.com') && !e.includes('myaccount'));
      if (valid.length > 0) recEmail = valid[0].trim();
    }
    let twoFactor = "开启";
    const twoFaMatch = text.match(/(?:2-Step Verification|两步验证)[\\s:\\-\\n]+(On|Off|开启|关闭|已开启|未开启)/i);
    if (twoFaMatch) {
      const val = twoFaMatch[1].toLowerCase();
      twoFactor = (val === 'off' || val === '关闭' || val === '未开启') ? "关闭" : "开启";
    }
    let skipPwd = "开启";
    const skipPwdMatch = text.match(/(?:Skip password when possible|尽可能跳过密码)[\\s:\\-\\n]+(On|Off|开启|关闭|已开启|未开启)/i);
    if (skipPwdMatch) {
      const val = skipPwdMatch[1].toLowerCase();
      skipPwd = (val === 'off' || val === '关闭' || val === '未开启') ? "关闭" : "开启";
    }
    let totp = "开启";
    const totpMatch = text.match(/(?:Authenticator|身份验证器)[\\s:\\-\\n]+(Added[^\\n]+|已添加[^\\n]+|Not added|未添加|Off|关闭)/i);
    if (totpMatch) {
      const val = totpMatch[1].toLowerCase();
      totp = (val.includes('not') || val.includes('未') || val.includes('off') || val.includes('关闭')) ? "关闭" : "开启";
    }
    let backupRemain = 10;
    const backupMatch = text.match(/(?:Backup codes|备用验证码|备用代码)[\\s:\\-\\n]+(\\d+)\\s*(?:codes available|个可用|剩余|个剩余|条剩余|remaining)/i);
    if (backupMatch) {
      backupRemain = parseInt(backupMatch[1], 10);
    } else {
      const countMatch = text.match(/(\\d+)\\s*(?:codes available|个可用|剩余|条剩余|remaining)/i);
      if (countMatch) backupRemain = parseInt(countMatch[1], 10);
    }
    const res = {
      two_factor_status: twoFactor,
      two_factor_phone: twoFaPhone || null,
      skip_password_status: skipPwd,
      totp_status: totp,
      has_recovery_phone: recPhone ? "有" : "无",
      recovery_phone: recPhone || null,
      recovery_phone_verified: recPhone ? "已验证" : "未填写",
      has_recovery_email: recEmail ? "有" : "无",
      recovery_email: recEmail || null,
      recovery_email_verified: recEmail ? "已验证" : "未填写",
      backup_codes_status: "开启",
      backup_codes_remaining: backupRemain,
      raw_source: "Chrome 页面实时提取",
      extracted_at: new Date().toISOString()
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(JSON.stringify(res, null, 2));
    }
    fetch("http://127.0.0.1:18299/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(res),
      mode: "cors"
    }).catch(() => {});
    const b = document.createElement("div");
    b.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 8px 20px rgba(0,0,0,0.3);z-index:9999999;font-family:sans-serif;";
    b.innerText = "已提取配置并同步至客户端";
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 3000);
    return res;
  } catch(e) {
    alert("提取失败: " + e.message);
  }
})();`;

  useEffect(() => {
    if (isOpen) {
      setScrapedData(null);
      setActiveStep("idle");
      setLoading(false);
      setApplying(false);
      setShowManualPaste(false);
      setManualInput("");

      // Clear any previous cached data upon opening modal
      api.clearSyncedSecurityData().catch(() => {});

      try {
        const step = new URLSearchParams(window.location.search).get("demo_step");
        if (step === "crawling") {
          setLoading(true);
          setCrawlProgress(68);
          setCrawlStageText("正在读取会员数据…");
        }
      } catch {}

      const checkSynced = async () => {
        try {
          const synced = await api.getSyncedSecurityData();
          if (synced && (synced.two_factor_status || synced.recovery_phone || synced.recovery_email)) {
            setScrapedData(synced);
            setActiveStep("ready");
            showToast("已获取最新安全配置", "success");
            await api.clearSyncedSecurityData();
          }
        } catch {
          // Ignore
        }
      };

      pollTimerRef.current = setInterval(checkSynced, 900);

      const handleWindowFocus = async () => {
        try {
          const text = await navigator.clipboard.readText();
          const parsed = parseSecurityText(text);
          if (parsed && (!scrapedData || parsed.extracted_at !== scrapedData.extracted_at)) {
            setScrapedData(parsed);
            setActiveStep("ready");
            showToast("已识别安全配置", "success");
          }
        } catch {
          // Ignore
        }
      };

      window.addEventListener("focus", handleWindowFocus);

      return () => {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        window.removeEventListener("focus", handleWindowFocus);
      };
    }
  }, [isOpen]);

  const handleAutoCrawl = async () => {
    setLoading(true);
    setCrawlProgress(5);
    setCrawlStageText("正在启动环境…");

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 3500) {
        const p = Math.min(28, Math.round(5 + (elapsed / 3500) * 23));
        setCrawlProgress(p);
        setCrawlStageText("正在启动环境…");
      } else if (elapsed < 10500) {
        const p = Math.min(65, Math.round(28 + ((elapsed - 3500) / 7000) * 37));
        setCrawlProgress(p);
        setCrawlStageText("正在读取安全设置…");
      } else if (elapsed < 17000) {
        const p = Math.min(92, Math.round(65 + ((elapsed - 10500) / 6500) * 27));
        setCrawlProgress(p);
        setCrawlStageText("正在读取会员数据…");
      } else {
        const extra = Math.min(4, Math.floor((elapsed - 17000) / 2000));
        setCrawlProgress(Math.min(96, 92 + extra));
        setCrawlStageText("正在整理数据…");
      }
    }, 200);

    try {
      const binding = await api.getAccountChromeProfile(accountId);
      if (!binding) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        showToast("该账号尚未绑定 Chrome 个人资料", "error");
        setLoading(false);
        return;
      }

      await api.clearSyncedSecurityData();
      const res = await api.crawlAccountSecurity(accountId);

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setCrawlProgress(100);
      setCrawlStageText("抓取完成");

      await new Promise(r => setTimeout(r, 350));
      setScrapedData(res);
      setActiveStep("ready");
      showToast("抓取成功", "success");
    } catch (err: any) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      const msg = typeof err === "string" ? err : err?.message || "抓取失败";
      showToast(msg, "error");
    } finally {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setLoading(false);
    }
  };

  const handleOpenChromeSecurity = async () => {
    try {
      const binding = await api.getAccountChromeProfile(accountId);
      if (!binding) {
        showToast("该账号尚未绑定 Chrome 个人资料", "error");
        return;
      }
      await api.openAccountChrome(accountId, "https://myaccount.google.com/security");
      setActiveStep("listening");
      showToast("已打开安全页面", "info");
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || "打开失败";
      showToast(msg, "error");
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(extractorScript);
      setCopiedScript(true);
      showToast("探针脚本已复制，按 F12 粘贴回车运行", "success");
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      showToast("复制失败", "error");
    }
  };

  const handleReadClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showToast("剪贴板为空", "error");
        return;
      }
      const parsed = parseSecurityText(text);
      if (parsed) {
        setScrapedData(parsed);
        setActiveStep("ready");
        showToast("识别成功", "success");
        return;
      }
      showToast("未检测到有效安全信息", "error");
    } catch {
      showToast("无法读取剪贴板，请使用手动粘贴", "error");
    }
  };

  const handleApplyManualText = () => {
    if (!manualInput.trim()) {
      showToast("请先粘贴内容", "error");
      return;
    }
    const parsed = parseSecurityText(manualInput);
    if (parsed) {
      setScrapedData(parsed);
      setActiveStep("ready");
      setShowManualPaste(false);
      showToast("解析成功", "success");
    } else {
      showToast("未能解析出安全信息", "error");
    }
  };

  const handleConfirmApply = async () => {
    if (!scrapedData) return;
    setApplying(true);
    try {
      await onApply(scrapedData);
      setActiveStep("done");
      showToast("已成功保存安全配置", "success");
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || "保存失败";
      showToast(msg, "error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-[580px] max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-medium text-foreground">
                一键配置安全状态
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {/* Target Account */}
          <div className="p-2.5 bg-accent/40 rounded-lg border border-border-subtle flex items-center justify-between">
            <span className="text-muted-foreground">目标账号</span>
            <span className="font-medium text-foreground text-[13px]">{email}</span>
          </div>

          {/* Sync Items: Clean Grid */}
          <div className="p-3 bg-card border border-border-subtle rounded-xl space-y-2">
            <span className="font-medium text-foreground text-xs block">同步项目</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-muted-foreground text-[12px]">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border-subtle/50">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium text-foreground">两步验证</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border-subtle/50">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-medium text-foreground">跳过密码</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border-subtle/50">
                <KeyRound className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="font-medium text-foreground">身份验证器</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border-subtle/50">
                <Phone className="w-4 h-4 text-teal-500 shrink-0" />
                <span className="font-medium text-foreground">绑定手机</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border-subtle/50">
                <Mail className="w-4 h-4 text-purple-500 shrink-0" />
                <span className="font-medium text-foreground">辅助邮箱</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border-subtle/50">
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="font-medium text-foreground">备用验证码</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border-subtle/50 col-span-2 sm:col-span-2">
                <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-medium text-foreground">会员套餐（状态、方案、入会日期）</span>
              </div>
            </div>
          </div>

          {/* Action Trigger Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pt-0.5">
              <Button
                id="btn-modal-start-crawl"
                type="button"
                variant="default"
                size="sm"
                disabled={loading || applying}
                onClick={handleAutoCrawl}
                className="h-8 px-4 text-xs gap-1.5 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>正在后台静默抓取…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{scrapedData ? "重新抓取" : "一键抓取"}</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading || applying}
                onClick={() => setShowManualPaste(!showManualPaste)}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer hover:bg-accent"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>手动粘贴</span>
              </Button>
            </div>

            {/* Minimalist Live Progress Bar & Stage Indicator */}
            {loading && (
              <div className="p-3 bg-accent/30 border border-blue-500/25 rounded-xl space-y-2 shadow-xs transition-all">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                    <span className="font-medium text-foreground">{crawlStageText}</span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {crawlProgress}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${crawlProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Listening Banner */}
            {activeStep === "listening" && !scrapedData && (
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between text-[11.5px] text-blue-600 dark:text-blue-400">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>正在获取安全配置，请稍候…</span>
                </span>
              </div>
            )}

            {/* Manual Paste */}
            {showManualPaste && (
              <div className="p-3 bg-muted/40 border border-border-subtle rounded-xl space-y-2 animation-fade-in">
                <textarea
                  className="w-full h-20 p-2 text-xs font-mono bg-background border border-border-subtle rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="粘贴 Google 安全页面复制的文字或 JSON…"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowManualPaste(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleApplyManualText}
                  >
                    解析填入
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Scraped Diff Result View */}
          {scrapedData && (
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2.5 animation-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>已获取最新安全配置</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {scrapedData.raw_source || "实时提取"}
                </span>
              </div>

              <div className="space-y-1.5 divide-y divide-border-subtle/40 text-[12px]">
                {/* Phone */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">绑定手机</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/70 line-through text-[11px] truncate max-w-[120px]">
                      {currentRecovery.recoveryPhone || currentRecovery.hasRecoveryPhone}
                    </span>
                    <span>→</span>
                    <span className="font-medium text-foreground bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded text-[11px]">
                      {scrapedData.recovery_phone || scrapedData.two_factor_phone || "已开启"} ({scrapedData.recovery_phone_verified || "已验证"})
                    </span>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">辅助邮箱</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/70 line-through text-[11px] truncate max-w-[120px]">
                      {currentRecovery.recoveryEmail || currentRecovery.hasRecoveryEmail}
                    </span>
                    <span>→</span>
                    <span className="font-medium text-foreground bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded text-[11px]">
                      {scrapedData.recovery_email || "已开启"} ({scrapedData.recovery_email_verified || "已验证"})
                    </span>
                  </div>
                </div>

                {/* 2FA */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">两步验证</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/70 line-through text-[11px]">{currentAuth.twoFactorStatus}</span>
                    <span>→</span>
                    <span className="font-medium text-foreground bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[11px]">
                      {scrapedData.two_factor_status || "开启"}
                    </span>
                  </div>
                </div>

                {/* Skip Password */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">跳过密码</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/70 line-through text-[11px]">{currentAuth.skipPasswordStatus}</span>
                    <span>→</span>
                    <span className="font-medium text-foreground bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[11px]">
                      {scrapedData.skip_password_status || "开启"}
                    </span>
                  </div>
                </div>

                {/* Authenticator */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">身份验证器</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/70 line-through text-[11px]">
                      {currentAuth.totpStatus}
                      {currentAuth.totpAddedAt ? ` (${currentAuth.totpAddedAt})` : ""}
                    </span>
                    <span>→</span>
                    <span className="font-medium text-foreground bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[11px]">
                      {scrapedData.totp_status || "开启"}
                      {scrapedData.totp_added_at ? ` (添加于 ${scrapedData.totp_added_at})` : ""}
                    </span>
                  </div>
                </div>

                {/* Backup Codes */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">备用验证码</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/70 line-through text-[11px]">剩余 {backupCodesCount} 条</span>
                    <span>→</span>
                    <span className="font-medium text-foreground bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-[11px]">
                      剩余 {scrapedData.backup_codes_remaining ?? 10} 条
                    </span>
                  </div>
                </div>

                {/* Membership Status */}
                {scrapedData.membership_status && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">会员状态</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/70 line-through text-[11px]">
                        {currentMembership?.status || "未填写"}
                      </span>
                      <span>→</span>
                      <span className="font-medium text-foreground bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[11px]">
                        {scrapedData.membership_status}
                      </span>
                    </div>
                  </div>
                )}

                {/* Membership Plan */}
                {scrapedData.membership_plan && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">套餐方案</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/70 line-through text-[11px]">
                        {currentMembership?.plan || "未填写"}
                      </span>
                      <span>→</span>
                      <span className="font-medium text-foreground bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded text-[11px]">
                        {scrapedData.membership_plan}
                      </span>
                    </div>
                  </div>
                )}

                {/* Membership Start Date */}
                {scrapedData.membership_start_date && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">入会日期</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/70 line-through text-[11px]">
                        {currentMembership?.startDate || "未填写"}
                      </span>
                      <span>→</span>
                      <span className="font-medium text-foreground bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded text-[11px]">
                        {scrapedData.membership_start_date}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 mt-1 border-t border-border-subtle shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={applying}
            className="h-8 text-xs cursor-pointer border-border-subtle"
          >
            取消
          </Button>
          <Button
            id="btn-modal-apply-config"
            type="button"
            variant="default"
            size="sm"
            disabled={!scrapedData || applying}
            onClick={handleConfirmApply}
            className="h-8 text-xs gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {applying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>保存中…</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>确认应用并保存</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
