import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Eye,
  EyeOff,
  Copy,
  Plus,
  Trash2,
  KeyRound,
  Check,
  Edit2,
  AlertTriangle,
  ExternalLink,
  Globe,
  ShieldCheck,
  ArrowLeftRight,
  Gauge,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { generateTotpCode, getTotpRemainingSeconds, cleanTotpSecret } from "../../utils/totp";
import { AccountDetail, SecurityKeyEntry, BackupCodeEntry, BackupCodeBatch, ScrapedSecurityData } from "../../types";
import { api, isBrowserPreview } from "../../services/tauri";
import { useVault } from "../../context/VaultContext";
import { copyWithAutoClear } from "../../utils/clipboard";
import { PasskeyModal } from "../modals/PasskeyModal";
import { BackupCodeImportModal } from "../modals/BackupCodeImportModal";
import { TotpSecretModal } from "../modals/TotpSecretModal";
import { AutoConfigModal } from "./AutoConfigModal";
import { SegmentedField } from "../ui/segmented-field";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { DatePicker } from "../ui/date-picker";
import { ChromeProfileControl } from "./ChromeProfileControl";
import { PhoneInput } from "../ui/phone-input/PhoneInput";
import { normalizePhone } from "../../lib/countryData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const statusOptions = ["未填写", "开启", "关闭"].map(value => ({ value, label: value }));
const presenceOptions = ["未填写", "无", "有"].map(value => ({ value, label: value }));
const displayStatus = (value?: string | null) => !value || value === "未记录" ? "未填写" : value;

function Field({ label, id, extra, children }: { label: string; id: string; extra?: string; children: React.ReactNode }) {
  return <div className="profile-field"><Label htmlFor={id} className="profile-label">{label}</Label><div className="profile-control">{children}{extra && <span className="block mt-1 text-[11px] text-muted-foreground tabular-nums">{extra}</span>}</div></div>;
}

function GeminiLogoIcon({ className }: { className?: string }) {
  return (
    <img
      src="/branding/gemini-official.svg"
      alt="Google Gemini"
      aria-hidden="true"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

function AntigravityLogoIcon({ className }: { className?: string }) {
  return (
    <img
      src="/branding/antigravity-official.svg"
      alt="Google Antigravity"
      aria-hidden="true"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

const detailTabs = [
  { id: "security", label: "安全性与登录", icon: "shield" },
  { id: "membership", label: "Gemini 会员", icon: "gemini" },
  { id: "switcher", label: "切号工具", icon: "switcher" },
  { id: "quota", label: "配额查询", icon: "quota" },
  { id: "antigravity", label: "Antigravity", icon: "antigravity" },
] as const;
type DetailTab = typeof detailTabs[number]["id"];

const GOOGLE_SECURITY_DIRECT_URLS = {
  password: "https://myaccount.google.com/signinoptions/password?continue=https%3A%2F%2Fmyaccount.google.com%2Fsecurity",
  authenticator: "https://myaccount.google.com/two-step-verification/authenticator?utm_source=google-account&utm_medium=web&utm_campaign=authenticator-screen&continue=https%3A%2F%2Fmyaccount.google.com%2Fsecurity",
  twosv: "https://myaccount.google.com/signinoptions/twosv",
  passwordoptional: "https://myaccount.google.com/signinoptions/passwordoptional?utm_source=google-account&utm_medium=web",
  recoveryEmail: "https://myaccount.google.com/recovery/email?continue=https%3A%2F%2Fmyaccount.google.com%2Fsecurity",
  backupCodes: "https://myaccount.google.com/two-step-verification/backup-codes?utm_source=google-account&utm_medium=web&utm_campaign=backupcodes-screen&continue=https%3A%2F%2Fmyaccount.google.com%2Fsecurity",
  googleOne: "https://one.google.com/",
} as const;

function IconAction({ id, label, children, onClick, disabled = false }: { id?: string; label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <Tooltip><TooltipTrigger asChild><Button id={id} variant="ghost" size="icon-sm" className="h-[30px] w-[30px] text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-all duration-150 active:scale-[0.94] [&_svg]:h-3.5 [&_svg]:w-3.5" aria-label={label} onClick={onClick} disabled={disabled}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

export interface AccountDetailRef {
  saveChanges: () => Promise<boolean>;
}

interface AccountDetailProps {
  account: AccountDetail | null;
  onDirtyChange?: (dirty: boolean) => void;
}

export const AccountDetailView = forwardRef<AccountDetailRef, AccountDetailProps>(
  function AccountDetailView({ account, onDirtyChange }, ref) {
    const { isDetailLoading } = useVault();
    const formRef = useRef<AccountDetailRef>(null);

    useImperativeHandle(ref, () => ({
      saveChanges: async () => {
        if (formRef.current) {
          return await formRef.current.saveChanges();
        }
        return false;
      },
    }));

    if (!account) {
      if (isDetailLoading) {
        return (
          <div className="flex-1 flex items-center justify-center text-xs text-app-muted select-none">
            加载中...
          </div>
        );
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-app-secondary select-none">
          <KeyRound className="w-10 h-10 stroke-1 mb-2 text-app-secondary/60" />
          <p className="text-[14px] leading-[20px] font-medium text-app-text mb-1">未选中账号</p>
          <p className="text-[12px] leading-[18px] text-app-secondary max-w-xs leading-relaxed font-normal">
            请在左侧列表选择一个 Google 账号，或点击左上角“+ 新增”开始录入。
          </p>
        </div>
      );
    }

    return (
      <AccountDetailForm
        key={account.id}
        ref={formRef}
        account={account}
        onDirtyChange={onDirtyChange}
      />
    );
  }
);

interface AccountDetailFormProps {
  account: AccountDetail;
  onDirtyChange?: (dirty: boolean) => void;
}

const AccountDetailForm = forwardRef<AccountDetailRef, AccountDetailFormProps>(
  function AccountDetailForm({ account, onDirtyChange }, ref) {
    const { refreshAccounts, loadAccountDetail, setSelectedAccountId, showToast, lock } = useVault();
    const [activeTab, setActiveTab] = useState<DetailTab>(() => {
      try {
        const t = new URLSearchParams(window.location.search).get("tab");
        if (t === "membership" || t === "switcher" || t === "quota" || t === "antigravity") return t;
      } catch {}
      return "security";
    });
    const scrollRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const selectTab = (tab: DetailTab) => {
      setActiveTab(tab);
      scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    };

    // 1. Account Info Section State
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState<boolean>(false);
    const [email, setEmail] = useState<string>(account.email || "");
    const [emailError, setEmailError] = useState<string>("");
    const emailRef = useRef<HTMLInputElement>(null);
    const [remark, setRemark] = useState<string>(account.display_name || "");
    const [password, setPassword] = useState<string>("");
    const [originalPassword, setOriginalPassword] = useState<string>("");
    const [passwordLoaded, setPasswordLoaded] = useState<boolean>(false);
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [maskCountdown, setMaskCountdown] = useState<number | null>(null);
    const [passwordCopied, setPasswordCopied] = useState<boolean>(false);

    // 2. Login & Recovery Section State
    const [twoFactorStatus, setTwoFactorStatus] = useState<string>(
      displayStatus(account.auth?.two_factor_status)
    );
    const [skipPasswordStatus, setSkipPasswordStatus] = useState<string>(
      displayStatus(account.auth?.skip_password_status)
    );

    // Authenticator (TOTP) state
    const [totpStatus, setTotpStatus] = useState<string>(
      displayStatus(account.auth?.totp_status)
    );
    const [totpSecret, setTotpSecret] = useState<string>(
      account.auth?.totp_secret || ""
    );
    const [totpAddedAt, setTotpAddedAt] = useState<string>(
      account.auth?.totp_added_at || ""
    );
    const [showTotpCode, setShowTotpCode] = useState<boolean>(() => {
      try {
        const step = new URLSearchParams(window.location.search).get("demo_step");
        if (step === "totp_revealed") return true;
        if (step === "totp_masked") return false;
      } catch {
        // ignore
      }
      return false;
    });
    const [totpCodeData, setTotpCodeData] = useState<{ code: string; formatted: string } | null>(null);
    const [totpRemaining, setTotpRemaining] = useState<number>(30);
    const [isTotpModalOpen, setIsTotpModalOpen] = useState<boolean>(false);
    const [totpCopied, setTotpCopied] = useState<boolean>(false);

    // Recovery Email & Phone
    const [hasRecoveryEmail, setHasRecoveryEmail] = useState<string>(
      displayStatus(account.recovery?.has_recovery_email)
    );
    const [recoveryEmail, setRecoveryEmail] = useState<string>(
      account.recovery?.recovery_email || ""
    );
    const [recoveryEmailVerified, setRecoveryEmailVerified] = useState<string>(
      displayStatus(account.recovery?.recovery_email_verified)
    );

    const [hasRecoveryPhone, setHasRecoveryPhone] = useState<string>(
      displayStatus(account.recovery?.has_recovery_phone)
    );
    const [recoveryPhone, setRecoveryPhone] = useState<string>(
      account.recovery?.recovery_phone || ""
    );
    const [recoveryPhoneVerified, setRecoveryPhoneVerified] = useState<string>(
      displayStatus(account.recovery?.recovery_phone_verified)
    );

    // 3. Gemini Membership Section State
    const currentSub = useMemo(() => {
      return (
        account.subscriptions?.find((s) => s.is_current) ||
        account.subscriptions?.[0] || {
          id: "",
          account_id: account.id,
          status: "未填写",
          plan: "未填写",
          source: "未填写",
          auto_renewal: "未填写",
          is_current: true,
          start_date: null,
          end_date: null,
        }
      );
    }, [account.subscriptions]);

    const [subStatus, setSubStatus] = useState<string>(displayStatus(currentSub.status));
    const [subPlan, setSubPlan] = useState<string>(displayStatus(currentSub.plan));
    const [subStartDate, setSubStartDate] = useState<string>(currentSub.start_date || "");

    // 4. Backup Codes Section State
    const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
    const [isBackupImportOpen, setIsBackupImportOpen] = useState<boolean>(false);
    const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

    const currentBatch = useMemo<BackupCodeBatch | null>(() => {
      if (!account.backup_code_batches || account.backup_code_batches.length === 0) {
        return null;
      }
      return (
        account.backup_code_batches.find((b) => b.is_active) ||
        account.backup_code_batches[0]
      );
    }, [account.backup_code_batches]);

    // 5. Passkeys Section State
    const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState<boolean>(false);
    const [editingPasskey, setEditingPasskey] = useState<SecurityKeyEntry | null>(null);

    // UI State: Save bar & More menu
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "just_saved" | "error">("idle");
    const [saveErrorMsg, setSaveErrorMsg] = useState<string>("");
    const savingRef = useRef(false);
    const [pendingCodeId, setPendingCodeId] = useState<string | null>(null);
    const pendingCodeRef = useRef(false);

    // Timers for in-place copy feedback (1.4s reset)
    const passwordCopyTimerRef = useRef<NodeJS.Timeout | null>(null);
    const totpCopyTimerRef = useRef<NodeJS.Timeout | null>(null);
    const backupCopyTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch plaintext password on mount
    useEffect(() => {
      let active = true;
      const fetchPassword = async () => {
        try {
          const plain = await api.getAccountPassword(account.id);
          if (active) {
            setPassword(plain || "");
            setOriginalPassword(plain || "");
            setPasswordLoaded(true);
          }
        } catch (err) {
          if (active) {
            setPasswordLoaded(false);
            setSaveStatus("error");
            setSaveErrorMsg("密码读取失败，请重新选择此账号后重试");
          }
        }
      };
      fetchPassword();
      return () => {
        active = false;
      };
    }, [account.id]);

    // Reset edit mode when switching accounts
    useEffect(() => {
      setIsEditing(false);
      setIsDiscardConfirmOpen(false);
    }, [account.id]);

    // Password 15s auto-mask timer
    useEffect(() => {
      if (!showPassword) {
        setMaskCountdown(null);
        return;
      }
      setMaskCountdown(15);
      const interval = setInterval(() => {
        setMaskCountdown((prev) => {
          if (prev === null || prev <= 1) {
            setShowPassword(false);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }, [showPassword]);

    // TOTP real-time ticker
    useEffect(() => {
      const update = () => {
        const cleaned = cleanTotpSecret(totpSecret);
        if (!cleaned) {
          setTotpCodeData(null);
          setTotpRemaining(30);
          return;
        }
        const codeData = generateTotpCode(cleaned);
        const rem = getTotpRemainingSeconds();
        setTotpCodeData(codeData);
        setTotpRemaining(rem);
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }, [totpSecret]);

    useEffect(() => () => {
      if (passwordCopyTimerRef.current) clearTimeout(passwordCopyTimerRef.current);
      if (totpCopyTimerRef.current) clearTimeout(totpCopyTimerRef.current);
      if (backupCopyTimerRef.current) clearTimeout(backupCopyTimerRef.current);
    }, []);

    // Copy password with in-place feedback and silent 30s auto-clear
    const handleCopyPassword = async () => {
      if (!password) {
        showToast("尚未填写密码", "warning");
        return;
      }
      const ok = await copyWithAutoClear(password, "Google 账号密码", 30, () => {});
      if (!ok) showToast("复制失败，请重试", "error");
      if (ok) {
        if (passwordCopyTimerRef.current) clearTimeout(passwordCopyTimerRef.current);
        setPasswordCopied(true);
        passwordCopyTimerRef.current = setTimeout(() => setPasswordCopied(false), 1400);
      }
    };

    // Copy TOTP with in-place feedback and silent 30s auto-clear
    const handleCopyTotpCode = async () => {
      if (!totpCodeData?.code) return;
      const ok = await copyWithAutoClear(totpCodeData.code, "动态登录验证码", 30, () => {});
      if (!ok) showToast("复制失败，请重试", "error");
      if (ok) {
        if (totpCopyTimerRef.current) clearTimeout(totpCopyTimerRef.current);
        setTotpCopied(true);
        totpCopyTimerRef.current = setTimeout(() => setTotpCopied(false), 1400);
      }
    };

    // Check dirty state
    const isDirty = useMemo(() => {
      if (!passwordLoaded) return false;

      const emailChanged = email.trim() !== (account.email || "");
      const remarkChanged = remark.trim() !== (account.display_name || "");
      const pwChanged = password !== originalPassword;

      const orig2fa = displayStatus(account.auth?.two_factor_status);
      const origSkip = displayStatus(account.auth?.skip_password_status);
      const twoFactorChanged = twoFactorStatus !== orig2fa;
      const skipPasswordChanged = skipPasswordStatus !== origSkip;

      const origTotpStatus = displayStatus(account.auth?.totp_status);
      const origTotpSecret = account.auth?.totp_secret || "";
      const totpChanged =
        totpStatus !== origTotpStatus ||
        totpSecret.trim() !== origTotpSecret;

      const origHasEmail = displayStatus(account.recovery?.has_recovery_email);
      const origRecEmail = account.recovery?.recovery_email || "";
      const origRecEmailVer = displayStatus(account.recovery?.recovery_email_verified);
      const recoveryEmailChanged =
        hasRecoveryEmail !== origHasEmail ||
        (hasRecoveryEmail === "有" && recoveryEmail.trim() !== origRecEmail) ||
        (hasRecoveryEmail === "有" && recoveryEmailVerified !== origRecEmailVer);

      const origHasPhone = displayStatus(account.recovery?.has_recovery_phone);
      const origRecPhone = account.recovery?.recovery_phone || "";
      const recoveryPhoneChanged =
        hasRecoveryPhone !== origHasPhone ||
        (hasRecoveryPhone === "有" && normalizePhone(recoveryPhone) !== normalizePhone(origRecPhone));

      const origSubStatus = displayStatus(currentSub.status);
      const origSubPlan = displayStatus(currentSub.plan);
      const origSubStartDate = currentSub.start_date || "";
      const subChanged =
        subStatus !== origSubStatus ||
        subPlan !== origSubPlan ||
        subStartDate !== origSubStartDate;

      return (
        emailChanged ||
        remarkChanged ||
        pwChanged ||
        twoFactorChanged ||
        skipPasswordChanged ||
        totpChanged ||
        recoveryEmailChanged ||
        recoveryPhoneChanged ||
        subChanged
      );
    }, [
      passwordLoaded,
      email,
      remark,
      password,
      originalPassword,
      twoFactorStatus,
      skipPasswordStatus,
      totpStatus,
      totpSecret,
      hasRecoveryEmail,
      recoveryEmail,
      recoveryEmailVerified,
      hasRecoveryPhone,
      recoveryPhone,
      subStatus,
      subPlan,
      subStartDate,
      account,
      currentSub,
    ]);

    useEffect(() => {
      onDirtyChange?.(isEditing && isDirty);
    }, [isEditing, isDirty, onDirtyChange]);

    useEffect(() => {
      if (!isBrowserPreview) return;
      try {
        const scrollTarget = new URLSearchParams(window.location.search).get("scroll");
        if (scrollTarget === "backup") {
          setActiveTab("security");
          setTimeout(() => {
            document.getElementById("section-backup-codes")?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
          }, 100);
        }
        const step = new URLSearchParams(window.location.search).get("demo_step");
        if (step === "copy") {
          setTotpCopied(true);
        } else if (step === "dirty" || step === "edit") {
          setIsEditing(true);
          if (step === "dirty") {
            setRemark("主力研发工作号 - 进行中的新模型联调");
          }
        } else if (step === "saved") {
          setSaveStatus("just_saved");
        }
      } catch {
        // ignore
      }
    }, []);

    // Discard Changes: opens confirmation modal to prevent accidental click
    const handleRequestDiscard = () => {
      setIsDiscardConfirmOpen(true);
    };

    // Confirmed Discard Changes: reverts all modified state back to original
    const handleConfirmDiscard = () => {
      setIsDiscardConfirmOpen(false);
      setEmail(account.email || "");
      setEmailError("");
      setPassword(originalPassword);
      setRemark(account.display_name || "");
      setTwoFactorStatus(displayStatus(account.auth?.two_factor_status));
      setSkipPasswordStatus(displayStatus(account.auth?.skip_password_status));
      setTotpStatus(displayStatus(account.auth?.totp_status));
      setTotpSecret(account.auth?.totp_secret || "");
      setTotpAddedAt(account.auth?.totp_added_at || "");
      setHasRecoveryEmail(displayStatus(account.recovery?.has_recovery_email));
      setRecoveryEmail(account.recovery?.recovery_email || "");
      setRecoveryEmailVerified(displayStatus(account.recovery?.recovery_email_verified));
      setHasRecoveryPhone(displayStatus(account.recovery?.has_recovery_phone));
      setRecoveryPhone(account.recovery?.recovery_phone || "");
      setRecoveryPhoneVerified(displayStatus(account.recovery?.recovery_phone_verified));
      setSubStatus(displayStatus(currentSub.status));
      setSubPlan(displayStatus(currentSub.plan));
      setSubStartDate(currentSub.start_date || "");
      setSaveStatus("idle");
      setSaveErrorMsg("");
      setIsEditing(false);
      showToast("已放弃修改", "info");
    };

    // Unified Save Changes handler
    const handleSaveChanges = async (): Promise<boolean> => {
      if (savingRef.current || !passwordLoaded) return false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setEmailError("请输入有效的邮箱地址");
        selectTab("security");
        requestAnimationFrame(() => emailRef.current?.focus());
        setSaveStatus("error");
        setSaveErrorMsg("请输入有效的邮箱地址");
        return false;
      }
      savingRef.current = true;
      setSaveStatus("saving");
      setSaveErrorMsg("");
      try {
        // 1. Update basic info
        await api.updateBasicInfo(
          account.id,
          email.trim(),
          remark.trim() || null,
          account.purpose || null,
          account.tags || [],
          account.is_favorite || false,
          account.status || "正常",
          account.notes || null,
          account.last_verified_at || null,
          account.data_source || null
        );

        // 2. Update auth info
        await api.updateAuthInfo(
          account.id,
          Boolean(password),
          password ? password : null,
          twoFactorStatus,
          account.auth?.two_factor_methods || [],
          skipPasswordStatus,
          totpStatus,
          totpSecret.trim() ? totpSecret.trim() : null,
          totpAddedAt.trim() ? totpAddedAt.trim() : null
        );

        // 3. Update recovery info
        await api.updateRecoveryInfo(
          account.id,
          hasRecoveryEmail,
          hasRecoveryEmail === "有" ? recoveryEmail.trim() : null,
          hasRecoveryEmail === "有" ? recoveryEmailVerified : "未填写",
          hasRecoveryPhone,
          hasRecoveryPhone === "有" ? recoveryPhone.trim() : null,
          account.recovery?.recovery_phone_verified || "未填写"
        );

        // 4. Update subscription
        await api.saveSubscription(account.id, {
          ...currentSub,
          status: subStatus,
          plan: subPlan,
          start_date: subStartDate || null,
        });

        setOriginalPassword(password);
        setEmail(email.trim());
        setRemark(remark.trim());
        setRecoveryEmail(recoveryEmail.trim());
        setRecoveryPhone(recoveryPhone.trim());
        await loadAccountDetail(account.id);
        await refreshAccounts();

        setSaveStatus("idle");
        setIsEditing(false);
        showToast("已保存修改", "success");
        return true;
      } catch (err: any) {
        console.error("Save account failed:", err);
        const msg = typeof err === "string" ? err : err?.message || "保存修改失败";
        if (msg.toLowerCase().includes("locked")) {
          lock();
          return false;
        }
        setSaveStatus("error");
        setSaveErrorMsg(msg);
        return false;
      } finally {
        savingRef.current = false;
      }
    };

    useImperativeHandle(ref, () => ({
      saveChanges: handleSaveChanges,
    }));

    // Backup codes item actions
    const handleToggleRevealCode = (id: string) => {
      setRevealedCodes((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleToggleCodeUsed = async (entry: BackupCodeEntry) => {
      if (pendingCodeRef.current) return;
      pendingCodeRef.current = true;
      setPendingCodeId(entry.id);
      try {
        const nextUsed = !entry.is_used;
        await api.markBackupCodeUsed(entry.id, nextUsed);
        await loadAccountDetail(account.id);
        await refreshAccounts();
      } catch (err) {
        showToast("更新备用码状态失败", "error");
      } finally {
        pendingCodeRef.current = false;
        setPendingCodeId(null);
      }
    };

    const handleCopyCode = async (id: string, code: string) => {
      const ok = await copyWithAutoClear(code, "备用验证码", 30, () => {});
      if (!ok) showToast("复制失败，请重试", "error");
      if (ok) {
        if (backupCopyTimerRef.current) clearTimeout(backupCopyTimerRef.current);
        setCopiedCodeId(id);
        backupCopyTimerRef.current = setTimeout(() => {
          setCopiedCodeId((curr) => (curr === id ? null : curr));
        }, 1400);
      }
    };

    // Passkey actions
    const handleSavePasskey = async (cardData: Partial<SecurityKeyEntry>) => {
      try {
        const existing = account.security_keys.find(key => key.id === cardData.id);
        await api.saveSecurityKey(account.id, {
          id: cardData.id || "",
          account_id: account.id,
          category: cardData.category || "通行密钥",
          display_name: cardData.display_name || "",
          provider: cardData.provider || "Google 密码管理工具",
          device_name: cardData.device_name || null,
          device_model: existing?.device_model ?? null,
          storage_location: cardData.storage_location || null,
          created_at: cardData.created_at || null,
          last_used_desc: cardData.last_used_desc || "未填写",
          creation_type: cardData.creation_type || "未填写",
          status: cardData.status || "正常",
          data_source: existing?.data_source || "本地记录",
          observation_time: existing?.observation_time ?? null,
          notes: existing?.notes ?? null,
        });
        await loadAccountDetail(account.id);
      } catch (err) {
        throw err;
      }
    };

    const handleDeletePasskey = async (cardId: string, cardName: string) => {
      if (!window.confirm(`确定要删除密钥「${cardName}」的本地记录吗？`)) return;
      try {
        await api.deleteSecurityKey(cardId);
        await loadAccountDetail(account.id);
      } catch (err) {
        showToast("删除密钥失败", "error");
      }
    };

    // Delete entire account
    const handleDeleteAccount = async () => {
      if (!window.confirm(`确定要删除账号「${account.email}」及其全部凭据吗？此操作不可撤销！`)) {
        return;
      }
      try {
        await api.deleteAccount(account.id);
        setSelectedAccountId(null);
        await refreshAccounts();
        showToast(`已删除账号：${account.email}`, "info");
      } catch (err) {
        showToast("删除账号失败", "error");
      }
    };

    // Open Gemini AI in bound Chrome profile
    const [isLaunchingGemini, setIsLaunchingGemini] = useState(false);
    const handleLaunchGemini = async () => {
      if (isLaunchingGemini) return;
      setIsLaunchingGemini(true);
      try {
        const binding = await api.getAccountChromeProfile(account.id);
        if (!binding) {
          showToast("此账号尚未设置 Chrome 绑定，请先在右上角配置绑定", "error");
          return;
        }
        await api.openAccountChrome(account.id, "https://gemini.google.com/");
        showToast("已通过绑定的 Chrome 窗口打开 Gemini 官网", "info");
      } catch (err: any) {
        const msg = typeof err === "string" ? err : err?.message || "打开 Chrome 失败";
        showToast(msg, "error");
      } finally {
        setIsLaunchingGemini(false);
      }
    };

    // Open Google Security in bound Chrome profile
    const [isLaunchingSecurity, setIsLaunchingSecurity] = useState(false);
    const handleLaunchSecurity = async () => {
      if (isLaunchingSecurity) return;
      setIsLaunchingSecurity(true);
      try {
        const binding = await api.getAccountChromeProfile(account.id);
        if (!binding) {
          showToast("此账号尚未设置 Chrome 绑定，请先在右上角配置绑定", "error");
          return;
        }
        await api.openAccountChrome(account.id, "https://myaccount.google.com/security");
        showToast("已通过绑定的 Chrome 窗口打开 Google 安全设置", "info");
      } catch (err: any) {
        const msg = typeof err === "string" ? err : err?.message || "打开 Chrome 失败";
        showToast(msg, "error");
      } finally {
        setIsLaunchingSecurity(false);
      }
    };

    const handleDirectUrl = async (key: keyof typeof GOOGLE_SECURITY_DIRECT_URLS, label: string) => {
      const url = GOOGLE_SECURITY_DIRECT_URLS[key];
      try {
        const binding = await api.getAccountChromeProfile(account.id);
        if (!binding) {
          showToast("此账号尚未设置 Chrome 绑定，请先在右上角配置绑定", "error");
          return;
        }
        await api.openAccountChrome(account.id, url);
        showToast(`已通过绑定的 Chrome 窗口直达${label}`, "info");
      } catch (err: any) {
        const msg = typeof err === "string" ? err : err?.message || "打开 Chrome 失败";
        showToast(msg, "error");
      }
    };

    const handleOpenNavigationLink = async (url: string, label: string) => {
      try {
        const binding = await api.getAccountChromeProfile(account.id);
        if (!binding) {
          showToast("此账号尚未设置 Chrome 绑定，请先在右上角配置绑定", "error");
          return;
        }
        await api.openAccountChrome(account.id, url);
        showToast(`已通过绑定的 Chrome 窗口直达 ${label}`, "info");
      } catch (err: any) {
        const msg = typeof err === "string" ? err : err?.message || "打开 Chrome 失败";
        showToast(msg, "error");
      }
    };

    // 一键配置弹窗与抓取应用逻辑
    const [isAutoConfigOpen, setIsAutoConfigOpen] = useState(() => {
      try {
        const s = new URLSearchParams(window.location.search).get("demo_step");
        if (s === "auto_config" || s === "crawling") return true;
      } catch {}
      return false;
    });

    const handleApplyAutoConfig = async (data: ScrapedSecurityData) => {
      if (data.two_factor_status) setTwoFactorStatus(data.two_factor_status);
      if (data.skip_password_status) setSkipPasswordStatus(data.skip_password_status);
      if (data.totp_status) setTotpStatus(data.totp_status);
      if (data.totp_added_at) setTotpAddedAt(data.totp_added_at);
      if (data.has_recovery_email) setHasRecoveryEmail(data.has_recovery_email);
      if (data.recovery_email !== undefined && data.recovery_email !== null) {
        setRecoveryEmail(data.recovery_email);
        if (data.recovery_email) setHasRecoveryEmail("有");
      }
      if (data.recovery_email_verified) setRecoveryEmailVerified(data.recovery_email_verified);

      const targetPhone = data.recovery_phone || data.two_factor_phone;
      if (targetPhone) {
        setHasRecoveryPhone("有");
        setRecoveryPhone(targetPhone);
        setRecoveryPhoneVerified(data.recovery_phone_verified || "已验证");
      } else if (data.has_recovery_phone) {
        setHasRecoveryPhone(data.has_recovery_phone);
      }

      if (data.membership_status) setSubStatus(data.membership_status);
      if (data.membership_plan) setSubPlan(data.membership_plan);
      if (data.membership_start_date) setSubStartDate(data.membership_start_date);

      try {
        const next2fa = data.two_factor_status || twoFactorStatus;
        const nextSkip = data.skip_password_status || skipPasswordStatus;
        const nextTotp = data.totp_status || totpStatus;
        const nextHasRecEmail = data.has_recovery_email || (data.recovery_email ? "有" : hasRecoveryEmail);
        const nextRecEmail = data.recovery_email !== undefined && data.recovery_email !== null ? data.recovery_email : recoveryEmail;
        const nextRecEmailVer = data.recovery_email_verified || recoveryEmailVerified;

        const nextHasRecPhone = targetPhone ? "有" : (data.has_recovery_phone || hasRecoveryPhone);
        const nextRecPhone = targetPhone ? targetPhone : recoveryPhone;
        const nextRecPhoneVer = data.recovery_phone_verified || (targetPhone ? "已验证" : recoveryPhoneVerified);

        await api.updateAuthInfo(
          account.id,
          Boolean(password),
          password ? password : null,
          next2fa,
          account.auth?.two_factor_methods || [],
          nextSkip,
          nextTotp,
          totpSecret,
          data.totp_added_at || totpAddedAt || null
        );

        await api.updateRecoveryInfo(
          account.id,
          nextHasRecEmail,
          nextHasRecEmail === "有" ? nextRecEmail.trim() : null,
          nextHasRecEmail === "有" ? nextRecEmailVer : "未填写",
          nextHasRecPhone,
          nextHasRecPhone === "有" ? nextRecPhone.trim() : null,
          nextHasRecPhone === "有" ? nextRecPhoneVer : "未填写"
        );

        if (data.membership_status || data.membership_plan || data.membership_start_date) {
          const nextSubStatus = data.membership_status || subStatus;
          const nextSubPlan = data.membership_plan || subPlan;
          const nextSubDate = data.membership_start_date || (subStartDate ? subStartDate : null);
          await api.saveSubscription(account.id, {
            ...currentSub,
            status: nextSubStatus,
            plan: nextSubPlan,
            start_date: nextSubDate,
          });
        }

        await loadAccountDetail(account.id);
        await refreshAccounts();
      } catch (err: any) {
        const msg = typeof err === "string" ? err : err?.message || "一键配置保存失败";
        showToast(msg, "error");
        throw err;
      }
    };


    return (
      <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
        <header className="h-[76px] px-6 xl:px-8 border-b border-border-subtle flex items-center shrink-0">
          <div className="max-w-[880px] w-full flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 mr-2">
              <h1 className="text-[20px] leading-7 font-medium tracking-[-0.015em] truncate" title={account.email}>{account.email}</h1>
              {account.display_name && <p className="text-xs text-muted-foreground mt-0.5 truncate">{account.display_name}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ChromeProfileControl key={account.id} accountId={account.id} email={account.email} />

              {/* 一键配置按钮：位于“账号chrome首页”和“删除账号”中间 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    id="btn-auto-configure"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAutoConfigOpen(true)}
                    className="h-8 w-8 min-[860px]:w-auto p-0 min-[860px]:px-2.5 text-xs gap-1.5 font-normal border-border-subtle text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
                    aria-label="一键配置"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="hidden min-[860px]:inline">一键配置</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span>一键配置与安全状态同步</span>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteAccount}
                    className="h-8 w-8 min-[860px]:w-auto p-0 min-[860px]:px-2.5 text-xs gap-1.5 font-normal border-border-subtle text-rose-500/80 hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30 hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
                    aria-label="删除账号"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden min-[860px]:inline">删除账号</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span>删除账号凭据（不可撤销）</span>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <div className="detail-tabs-bar px-6 xl:px-8 border-b border-border-subtle shrink-0">
          <div className="max-w-[880px] w-full flex items-center justify-between gap-4">
            <div role="tablist" aria-label="账号资料分类" className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar py-0.5">
              {detailTabs.map((tab, index) => <button
                key={tab.id}
                ref={element => { tabRefs.current[index] = element; }}
                type="button"
                role="tab"
                id={`detail-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`detail-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className="detail-tab flex items-center gap-1.5 cursor-pointer"
                onClick={() => selectTab(tab.id)}
                onKeyDown={event => {
                  let next = index;
                  if (event.key === "ArrowRight") next = (index + 1) % detailTabs.length;
                  else if (event.key === "ArrowLeft") next = (index - 1 + detailTabs.length) % detailTabs.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = detailTabs.length - 1;
                  else return;
                  event.preventDefault();
                  selectTab(detailTabs[next].id);
                  tabRefs.current[next]?.focus();
                }}
              >
                {tab.icon === "shield" && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {tab.icon === "gemini" && <GeminiLogoIcon className="w-3.5 h-3.5 shrink-0" />}
                {tab.icon === "switcher" && <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                {tab.icon === "quota" && <Gauge className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                {tab.icon === "antigravity" && <AntigravityLogoIcon className="w-3.5 h-3.5 shrink-0" />}
                <span>{tab.label}</span>
              </button>)}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 xl:px-8 py-6" data-testid="account-scroll">
          <fieldset disabled={saveStatus === "saving"} className="detail-content max-w-[880px] min-w-0 w-full pb-5">
            <div role="tabpanel" id="detail-panel-security" aria-labelledby="detail-tab-security" hidden={activeTab !== "security"} tabIndex={0} className="detail-panel">
              {/* 谷歌安全设置：位于“安全性与登录”下方、“账号信息”上方 */}
              <div className="mb-5 pb-3 border-b border-border-subtle flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-medium text-foreground">Google 账号安全中心</span>
                  <span className="hidden sm:inline text-muted-foreground/70 truncate">https://myaccount.google.com/security</span>
                </div>
                <Button
                  id="btn-direct-security"
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLaunchingSecurity}
                  onClick={handleLaunchSecurity}
                  className="h-8 px-3 text-xs gap-1.5 font-normal border-border-subtle text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0"
                  title="直达 https://myaccount.google.com/security"
                >
                  <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span>谷歌安全设置</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </Button>
              </div>

              <section className="profile-section" aria-labelledby="account-info-heading">
                <h2 id="account-info-heading" className="section-heading">账号信息</h2>
              <div className="profile-fields">
                <Field label="Google 邮箱" id="account-email">
                  <Input
                    ref={emailRef}
                    id="account-email"
                    type="email"
                    autoComplete="off"
                    value={email}
                    readOnly={!isEditing}
                    onChange={e => {
                      if (!isEditing) return;
                      setEmail(e.target.value);
                      setEmailError("");
                      if (emailError) {
                        setSaveStatus("idle");
                        setSaveErrorMsg("");
                      }
                    }}
                    placeholder="name@gmail.com"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? "account-email-error" : undefined}
                    className={cn(!isEditing && "cursor-default")}
                  />
                  {emailError && <p id="account-email-error" className="mt-1.5 text-xs text-destructive">{emailError}</p>}
                </Field>
                <Field label="密码" id="account-password" extra={showPassword && maskCountdown !== null ? `${maskCountdown}s 后隐藏` : undefined}>
                  <div className="relative">
                    <Input
                      id="account-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      disabled={!passwordLoaded}
                      readOnly={!isEditing}
                      onChange={e => {
                        if (!isEditing) return;
                        setPassword(e.target.value);
                      }}
                      placeholder={passwordLoaded ? "未填写" : "正在读取…"}
                      className={cn("pr-[102px]", !isEditing && "cursor-default")}
                    />
                    <div className="absolute right-1 top-1 flex">
                      <IconAction label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword(v => !v)} disabled={!passwordLoaded || !password}>{showPassword ? <EyeOff /> : <Eye />}</IconAction>
                      <IconAction label={passwordCopied ? "已复制密码" : "复制密码"} onClick={handleCopyPassword} disabled={!passwordLoaded || !password}>{passwordCopied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}</IconAction>
                      <IconAction id="btn-direct-password" label="在绑定的 Chrome 中直达修改密码" onClick={() => handleDirectUrl("password", "修改密码页面")}>
                        <ExternalLink className="text-blue-500" />
                      </IconAction>
                    </div>
                  </div>
                </Field>
                <Field label="备注" id="account-remark">
                  <Textarea
                    id="account-remark"
                    value={remark}
                    readOnly={!isEditing}
                    onChange={e => {
                      if (!isEditing) return;
                      setRemark(e.target.value);
                    }}
                    placeholder="添加备注"
                    rows={1}
                    className={cn("min-h-[38px] h-[38px] max-h-[120px]", !isEditing && "cursor-default")}
                  />
                </Field>
              </div>
            </section>

            <section className="profile-section" aria-labelledby="login-heading">
              <h2 id="login-heading" className="section-heading">登录验证</h2>
              <div className="profile-fields">
                <div className="profile-field">
                  <span className="profile-label">两步验证</span>
                  <div className="profile-control">
                    <div className="flex items-center flex-wrap gap-2.5">
                      <SegmentedField aria-label="两步验证" value={twoFactorStatus} onChange={setTwoFactorStatus} options={statusOptions} readOnly={!isEditing} />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            id="btn-direct-twosv"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDirectUrl("twosv", "两步验证设置")}
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150"
                            aria-label="在绑定的 Chrome 中直达两步验证设置"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                            <span>前往设置</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span>在绑定的 Chrome 中直达两步验证设置</span>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
                <div className="profile-field">
                  <span className="profile-label">尽可能跳过密码</span>
                  <div className="profile-control">
                    <div className="flex items-center flex-wrap gap-2.5">
                      <SegmentedField aria-label="尽可能跳过密码" value={skipPasswordStatus} onChange={setSkipPasswordStatus} options={statusOptions} readOnly={!isEditing} />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            id="btn-direct-passwordoptional"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDirectUrl("passwordoptional", "尽可能跳过密码设置")}
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150"
                            aria-label="在绑定的 Chrome 中直达尽可能跳过密码设置"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                            <span>前往设置</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span>在绑定的 Chrome 中直达“尽可能跳过密码”设置</span>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
                <div className="profile-field profile-authenticator">
                  <span className="profile-label">验证器</span>
                  <div className="profile-control">
                    <div className="flex items-center flex-wrap gap-2.5">
                      <SegmentedField aria-label="验证器" value={totpStatus} onChange={setTotpStatus} options={statusOptions} readOnly={!isEditing} />

                      {totpAddedAt && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                          <span>Google 已添加：{totpAddedAt}</span>
                        </span>
                      )}

                      <Button
                        variant={!totpSecret && totpStatus === "开启" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setIsTotpModalOpen(true)}
                        className={!totpSecret && totpStatus === "开启" ? "h-8 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 cursor-pointer shadow-xs font-medium" : "h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer hover:bg-accent"}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{totpSecret ? "管理密钥" : "添加密钥"}</span>
                      </Button>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            id="btn-direct-authenticator"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDirectUrl("authenticator", "身份验证器设置")}
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150"
                            aria-label="在绑定的 Chrome 中直达身份验证器设置"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                            <span>前往设置</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span>在绑定的 Chrome 中直达身份验证器设置</span>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="totp-readout">
                      <span className="text-xs text-muted-foreground w-full">动态验证码</span>
                      {totpSecret && totpCodeData ? (
                        <>
                          <span className="font-mono-numbers w-[120px] text-[22px] leading-7 font-medium select-text" aria-label={showTotpCode ? "动态验证码" : "动态验证码已隐藏"}>{showTotpCode ? totpCodeData.formatted : "••• •••"}</span>
                          <IconAction label={showTotpCode ? "隐藏动态验证码" : "显示动态验证码"} onClick={() => setShowTotpCode(v => !v)}>{showTotpCode ? <EyeOff /> : <Eye />}</IconAction>
                          <Button variant="ghost" size="xs" className="w-[72px]" onClick={handleCopyTotpCode} aria-label="复制动态验证码">{totpCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{totpCopied ? "已复制" : "复制"}</Button>
                          <span className="inline-flex gap-1.5 items-center ml-2 text-xs text-muted-foreground tabular-nums" aria-label={`${totpRemaining}秒后更新`}>
                            <svg width="14" height="14" viewBox="0 0 16 16" className="-rotate-90" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--border-subtle)" strokeWidth="1.5" /><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="37.7" strokeDashoffset={37.7 * (1 - totpRemaining / 30)} /></svg>
                            <span className="w-6">{totpRemaining}s</span>
                          </span>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 py-0.5">
                          <span className={`text-xs ${totpSecret ? "text-destructive" : "text-muted-foreground"}`}>
                            {totpSecret
                              ? "密钥格式无效"
                              : totpStatus === "开启"
                              ? `未配置本地密钥${totpAddedAt ? `（Google 添加时间：${totpAddedAt}）` : ""}，需手动录入密钥`
                              : "未添加密钥"}
                          </span>
                          {!totpSecret && totpStatus === "开启" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => setIsTotpModalOpen(true)}
                              className="h-6 px-2 text-[11px] gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>立即设置密钥</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="profile-section" aria-labelledby="recovery-heading">
              <h2 id="recovery-heading" className="section-heading">账号找回</h2>
              <div className="profile-fields">
                <div className="profile-field">
                  <span className="profile-label">辅助邮箱</span>
                  <div className="profile-control space-y-2.5">
                    <div className="flex items-center flex-wrap gap-2.5">
                      <SegmentedField aria-label="辅助邮箱" value={hasRecoveryEmail} onChange={setHasRecoveryEmail} options={presenceOptions} readOnly={!isEditing} />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            id="btn-direct-recovery-email"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDirectUrl("recoveryEmail", "辅助邮箱设置")}
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150"
                            aria-label="在绑定的 Chrome 中直达辅助邮箱设置"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                            <span>前往设置</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span>在绑定的 Chrome 中直达辅助邮箱设置</span>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {hasRecoveryEmail === "有" && <div className="recovery-email-fields"><Input aria-label="辅助邮箱地址" type="email" value={recoveryEmail} readOnly={!isEditing} onChange={e => { if (isEditing) setRecoveryEmail(e.target.value); }} placeholder="name@example.com" className={cn("min-w-0", !isEditing && "cursor-default")} /><select aria-label="辅助邮箱验证状态" disabled={!isEditing} className="vault-field w-[112px] shrink-0 px-2 text-[13px]" value={recoveryEmailVerified} onChange={e => { if (isEditing) setRecoveryEmailVerified(e.target.value); }}>{["未填写", "已验证", "未验证"].map(v => <option key={v}>{v}</option>)}</select></div>}
                  </div>
                </div>
                <div className="profile-field"><span className="profile-label">辅助电话</span><div className="profile-control space-y-2.5">
                  <SegmentedField aria-label="辅助电话" value={hasRecoveryPhone} onChange={setHasRecoveryPhone} options={presenceOptions} readOnly={!isEditing} />
                  {hasRecoveryPhone === "有" && (
                    <PhoneInput
                      ariaLabel="辅助电话号码"
                      value={recoveryPhone}
                      onChange={setRecoveryPhone}
                      readOnly={!isEditing}
                      placeholder="例如：147 9292 4955"
                    />
                  )}
                </div></div>
              </div>
            </section>

<section id="section-backup-codes" className="profile-section scroll-mt-6" aria-labelledby="backup-heading">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-3"><h2 id="backup-heading" className="section-heading">备用验证码</h2><span className="text-xs text-muted-foreground tabular-nums">剩余 {currentBatch?.unused_count ?? 0} 条</span></div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        id="btn-direct-backup-codes"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDirectUrl("backupCodes", "备用验证码设置")}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150"
                        aria-label="在绑定的 Chrome 中直达备用验证码设置"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                        <span>前往设置</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <span>在绑定的 Chrome 中直达备用验证码页面</span>
                    </TooltipContent>
                  </Tooltip>
                  <Button variant="outline" size="sm" disabled={!isEditing} onClick={() => setIsBackupImportOpen(true)}><Plus className="w-3.5 h-3.5" />导入备用码</Button>
                </div>
              </div>
              {!currentBatch?.entries?.length ? <p className="text-[13px] text-muted-foreground py-2">暂无备用码</p> : <div className="backup-grid">
                {currentBatch.entries.map((entry, index) => <div key={entry.id} className="h-[46px] flex items-center gap-2 border-b border-border-subtle group px-1.5 -mx-1.5 rounded-sm transition-colors duration-150 hover:bg-accent/40">
                  <span className="text-[11px] text-muted-foreground tabular-nums w-5 shrink-0">{String(entry.sequence_no || index + 1).padStart(2, "0")}</span>
                  <span className={`font-mono-numbers text-[13px] flex-1 min-w-0 whitespace-nowrap ${entry.is_used || entry.is_revoked ? "text-muted-foreground line-through" : "text-foreground"}`}>{revealedCodes[entry.id] ? entry.code.replace(/\s/g, "").replace(/(.{4})/, "$1 ") : "•••• ••••"}</span>
                  <div className="flex items-center shrink-0">
                    <IconAction label={`${revealedCodes[entry.id] ? "隐藏" : "显示"}备用码 ${index + 1}`} onClick={() => handleToggleRevealCode(entry.id)}>{revealedCodes[entry.id] ? <EyeOff /> : <Eye />}</IconAction>
                    <IconAction label={copiedCodeId === entry.id ? "已复制备用码" : `复制备用码 ${index + 1}`} onClick={() => handleCopyCode(entry.id, entry.code)} disabled={entry.is_revoked}>{copiedCodeId === entry.id ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}</IconAction>
                    <Button variant="ghost" size="xs" className="w-[72px] text-muted-foreground" disabled={!isEditing || entry.is_revoked || pendingCodeId === entry.id} onClick={() => handleToggleCodeUsed(entry)} aria-label={`${entry.is_used ? "撤销已用" : "标记已用"}备用码 ${index + 1}`}>{entry.is_revoked ? "已失效" : entry.is_used ? "撤销已用" : "标记已用"}</Button>
                  </div>
                </div>)}
              </div>}
            </section>

            <section className="profile-section" aria-labelledby="passkeys-heading">
              <div className="flex items-center justify-between gap-3"><h2 id="passkeys-heading" className="section-heading">通行密钥与安全密钥</h2><Button variant="outline" size="sm" disabled={!isEditing} onClick={() => { setEditingPasskey(null); setIsPasskeyModalOpen(true); }}><Plus className="w-3.5 h-3.5" />添加记录</Button></div>
              {!account.security_keys?.length ? <p className="text-[13px] text-muted-foreground py-2">暂无记录</p> : <div className="divide-y divide-border-subtle">
                {account.security_keys.map(key => <div key={key.id} className="flex items-center justify-between gap-3 py-3 px-2 -mx-2 rounded-md transition-colors duration-150 hover:bg-accent/40">
                  <div className="flex gap-3 items-center min-w-0"><KeyRound className="w-4 h-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><div className="flex gap-2 items-baseline"><span className="text-[13px] truncate">{key.display_name}</span><span className="text-[11px] text-muted-foreground shrink-0">{key.category}</span></div><p className="text-xs text-muted-foreground truncate mt-0.5">{[key.provider, key.device_name, key.storage_location].filter(Boolean).join(" · ")}</p></div></div>
                  <div className="flex shrink-0"><IconAction label={`编辑 ${key.display_name}`} disabled={!isEditing} onClick={() => { setEditingPasskey(key); setIsPasskeyModalOpen(true); }}><Edit2 /></IconAction><IconAction label={`删除 ${key.display_name}`} disabled={!isEditing} onClick={() => handleDeletePasskey(key.id, key.display_name)}><Trash2 /></IconAction></div>
                </div>)}
              </div>}
            </section>
            </div>

            <div role="tabpanel" id="detail-panel-membership" aria-labelledby="detail-tab-membership" hidden={activeTab !== "membership"} tabIndex={0} className="detail-panel">
              {/* Google AI 生态导航栏：官网直达 + Gemini notebook + Google Flow + colab + jules */}
              <div className="nav-ecosystem-bar mb-5 pb-3 border-b border-border-subtle flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      id="btn-direct-gemini-web"
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLaunchingGemini}
                      onClick={handleLaunchGemini}
                      className="nav-ecosystem-btn h-8 px-3 text-xs gap-1.5 font-normal border-border-subtle text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
                      aria-label="直达 Gemini 官网 (https://gemini.google.com/)"
                    >
                      <GeminiLogoIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="nav-btn-label">Gemini 官网直达</span>
                      <ExternalLink className="nav-btn-ext h-3 w-3 text-muted-foreground shrink-0" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-xs">Gemini 官网直达</span>
                      <span className="text-[11px] text-muted-foreground font-mono">https://gemini.google.com/</span>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      id="btn-direct-gemini-notebook"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenNavigationLink("https://notebook.google.com/notebook", "Gemini notebook")}
                      className="nav-ecosystem-btn h-8 px-3 text-xs gap-1.5 font-normal border-border-subtle text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
                      aria-label="直达 Gemini notebook (https://notebook.google.com/notebook)"
                    >
                      <img src="/branding/nav/notebook.svg" alt="Gemini notebook" className="w-3.5 h-3.5 shrink-0" />
                      <span className="nav-btn-label">Gemini notebook</span>
                      <ExternalLink className="nav-btn-ext h-3 w-3 text-muted-foreground shrink-0" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-xs">Gemini notebook</span>
                      <span className="text-[11px] text-muted-foreground font-mono">https://notebook.google.com/notebook</span>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      id="btn-direct-google-flow"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenNavigationLink("https://flow.google.com/", "Google Flow")}
                      className="nav-ecosystem-btn h-8 px-3 text-xs gap-1.5 font-normal border-border-subtle text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
                      aria-label="直达 Google Flow (https://flow.google.com/)"
                    >
                      <img src="/branding/nav/flow.png" alt="Google Flow" className="w-3.5 h-3.5 dark:hidden shrink-0 object-contain" />
                      <img src="/branding/nav/flow_w.png" alt="Google Flow" className="w-3.5 h-3.5 hidden dark:inline-block shrink-0 object-contain" />
                      <span className="nav-btn-label">Google Flow</span>
                      <ExternalLink className="nav-btn-ext h-3 w-3 text-muted-foreground shrink-0" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-xs">Google Flow</span>
                      <span className="text-[11px] text-muted-foreground font-mono">https://flow.google.com/</span>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      id="btn-direct-colab"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenNavigationLink("https://colab.research.google.com/", "colab")}
                      className="nav-ecosystem-btn h-8 px-3 text-xs gap-1.5 font-normal border-border-subtle text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
                      aria-label="直达 colab (https://colab.research.google.com/)"
                    >
                      <img src="/branding/nav/colab.svg" alt="colab" className="w-3.5 h-3.5 shrink-0" />
                      <span className="nav-btn-label">colab</span>
                      <ExternalLink className="nav-btn-ext h-3 w-3 text-muted-foreground shrink-0" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-xs">colab</span>
                      <span className="text-[11px] text-muted-foreground font-mono">https://colab.research.google.com/</span>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      id="btn-direct-jules"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenNavigationLink("https://jules.google/", "jules")}
                      className="nav-ecosystem-btn h-8 px-3 text-xs gap-1.5 font-normal border-border-subtle text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
                      aria-label="直达 jules (https://jules.google/)"
                    >
                      <img src="/branding/nav/jules.svg" alt="jules" className="w-3.5 h-3.5 shrink-0" />
                      <span className="nav-btn-label">jules</span>
                      <ExternalLink className="nav-btn-ext h-3 w-3 text-muted-foreground shrink-0" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-xs">jules</span>
                      <span className="text-[11px] text-muted-foreground font-mono">https://jules.google/</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>

              <section className="profile-section" aria-labelledby="membership-heading">
                <h2 id="membership-heading" className="section-heading">Gemini 会员</h2>
                <div className="profile-fields">
                  <Field label="Google 会员链接" id="member-google-one-link">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          id="member-google-one-link"
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDirectUrl("googleOne", "Google One 会员中心")}
                          className="h-[38px] w-full px-3.5 justify-between border-border text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Globe className="w-4 h-4 text-blue-500 shrink-0 group-hover:scale-105 transition-transform" />
                            <span className="font-mono-numbers text-[13px] font-medium text-blue-600 dark:text-blue-400 truncate">
                              https://one.google.com/
                            </span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 ml-1 transition-colors" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <span>点击使用绑定的 Chrome 窗口直达 Google One 会员中心</span>
                      </TooltipContent>
                    </Tooltip>
                  </Field>
                  <Field label="会员状态" id="member-status">
                    <select id="member-status" disabled={!isEditing} className="vault-field w-full" value={subStatus} onChange={e => { if (isEditing) setSubStatus(e.target.value); }}>
                      {Array.from(new Set(["未填写", "未开通", "试用", "有效", "已取消但仍有效", "已到期", subStatus])).map(v => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="套餐" id="member-plan">
                    <select id="member-plan" disabled={!isEditing} className="vault-field w-full" value={subPlan} onChange={e => { if (isEditing) setSubPlan(e.target.value); }}>
                      {Array.from(new Set(["未填写", "免费", "AI Plus", "AI Pro", "AI Ultra", "其他", subPlan])).map(v => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="入会日期" id="member-date">
                    <DatePicker id="member-date" disabled={!isEditing} className="w-full" value={subStartDate} onChange={setSubStartDate} aria-label="入会日期" />
                  </Field>
                </div>
              </section>
            </div>

            <div role="tabpanel" id="detail-panel-switcher" aria-labelledby="detail-tab-switcher" hidden={activeTab !== "switcher"} tabIndex={0} className="detail-panel">
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-border-subtle rounded-xl bg-card/30">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                  <ArrowLeftRight className="w-6 h-6" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-1">切号工具</h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  多账号快速切换、Cookie/Session 自动注入与独立隔离环境功能正在开发中。
                </p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  等待添加功能 · 规划中
                </span>
              </div>
            </div>

            <div role="tabpanel" id="detail-panel-quota" aria-labelledby="detail-tab-quota" hidden={activeTab !== "quota"} tabIndex={0} className="detail-panel">
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-border-subtle rounded-xl bg-card/30">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                  <Gauge className="w-6 h-6" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-1">配额查询</h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Google One 存储容量配额、Gemini 2.5/Ultra 高级模型调用额度与使用率看板正在开发中。
                </p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  等待添加功能 · 规划中
                </span>
              </div>
            </div>

            <div role="tabpanel" id="detail-panel-antigravity" aria-labelledby="detail-tab-antigravity" hidden={activeTab !== "antigravity"} tabIndex={0} className="detail-panel">
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-border-subtle rounded-xl bg-card/30">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                  <img src="/branding/antigravity-official.svg" alt="Antigravity" className="w-7 h-7" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-1">Antigravity 专区</h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Antigravity 专属集成、本地知识库与协同开发环境配置正在开发中。
                </p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  等待添加功能 · 规划中
                </span>
              </div>
            </div>
          </fieldset>
        </div>

        <footer className="h-[52px] px-6 xl:px-8 border-t border-border-subtle bg-background flex items-center shrink-0">
          <div className="max-w-[880px] w-full flex items-center justify-between gap-4">
            <div role="status" aria-live="polite" className="text-xs min-w-0">
              {!isEditing ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground select-none">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                  <span>预览中</span>
                </span>
              ) : saveStatus === "saving" ? (
                <span className="text-muted-foreground">保存中…</span>
              ) : saveStatus === "error" ? (
                <span className="inline-flex items-center gap-1.5 text-destructive font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{saveErrorMsg || "保存失败，请重试"}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium select-none">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>未保存</span>
                </span>
              )}
            </div>

            {!isEditing ? (
              <Button
                size="sm"
                onClick={() => setIsEditing(true)}
                className="min-w-[76px] shrink-0"
              >
                编辑
              </Button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saveStatus === "saving"}
                  onClick={handleRequestDiscard}
                >
                  放弃修改
                </Button>
                <Button
                  size="sm"
                  disabled={saveStatus === "saving" || !passwordLoaded}
                  onClick={handleSaveChanges}
                >
                  {saveStatus === "saving" ? "保存中…" : "保存修改"}
                </Button>
              </div>
            )}
          </div>
        </footer>

        {/* 放弃修改再次确认弹窗（防止误触点错） */}
        <Dialog open={isDiscardConfirmOpen} onOpenChange={setIsDiscardConfirmOpen}>
          <DialogContent className="max-w-[320px] p-5 gap-4">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/15 text-rose-500 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
                <DialogTitle className="text-[15px] font-semibold text-foreground">
                  放弃修改？
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                未保存的内容将会丢失。
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 pt-1 w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDiscardConfirmOpen(false)}
                className="flex-1 h-8 cursor-pointer"
              >
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDiscard}
                className="flex-1 h-8 cursor-pointer"
              >
                放弃修改
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <PasskeyModal isOpen={isPasskeyModalOpen} onClose={() => { setIsPasskeyModalOpen(false); setEditingPasskey(null); }} initialData={editingPasskey} onSave={handleSavePasskey} />
        <BackupCodeImportModal isOpen={isBackupImportOpen} onClose={() => setIsBackupImportOpen(false)} accountId={account.id} accountEmail={account.email} onSuccess={async () => { await loadAccountDetail(account.id); await refreshAccounts(); }} />
        <TotpSecretModal
          isOpen={isTotpModalOpen}
          onClose={() => setIsTotpModalOpen(false)}
          currentSecret={totpSecret}
          onApply={async (newSecret) => {
            setTotpSecret(newSecret);
            if (!isEditing) {
              await api.updateAuthInfo(
                account.id,
                Boolean(password),
                password ? password : null,
                twoFactorStatus,
                account.auth?.two_factor_methods || [],
                skipPasswordStatus,
                totpStatus,
                newSecret.trim() ? newSecret.trim() : null,
                totpAddedAt.trim() ? totpAddedAt.trim() : null
              );
              await loadAccountDetail(account.id);
              await refreshAccounts();
              showToast("已保存验证器密钥", "success");
            }
          }}
          onDelete={async () => {
            setTotpSecret("");
            if (!isEditing) {
              await api.updateAuthInfo(
                account.id,
                Boolean(password),
                password ? password : null,
                twoFactorStatus,
                account.auth?.two_factor_methods || [],
                skipPasswordStatus,
                totpStatus,
                null,
                totpAddedAt.trim() ? totpAddedAt.trim() : null
              );
              await loadAccountDetail(account.id);
              await refreshAccounts();
              showToast("已删除验证器密钥", "success");
            }
          }}
        />
        <AutoConfigModal
          isOpen={isAutoConfigOpen}
          onClose={() => setIsAutoConfigOpen(false)}
          accountId={account.id}
          email={account.email}
          currentAuth={{
            twoFactorStatus,
            skipPasswordStatus,
            totpStatus,
            totpAddedAt,
          }}
          currentRecovery={{
            hasRecoveryEmail,
            recoveryEmail,
            recoveryEmailVerified,
            hasRecoveryPhone,
            recoveryPhone,
            recoveryPhoneVerified,
          }}
          currentMembership={{
            status: subStatus,
            plan: subPlan,
            startDate: subStartDate,
          }}
          backupCodesCount={currentBatch?.unused_count ?? 0}
          onApply={handleApplyAutoConfig}
          showToast={showToast}
        />
      </div>
    );
  }
);

