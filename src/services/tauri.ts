import { invoke } from "@tauri-apps/api/core";
import { VaultStatus, AccountSummary, AccountDetail, SubscriptionEntry, SecurityKeyEntry, AppSettings, BackupCodeBatch, BackupCodeEntry, BackupCodesParseResult, StructuredImportRow, StructuredImportResult, ChromeProfileBinding, DetectedBrowserProfile, ScrapedSecurityData } from "../types";

export const isTauri = typeof window !== "undefined" && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
export const isBrowserPreview = !isTauri;

// Browser preview only: fixtures and edits live in memory, never in the user's vault.
const copy = <T,>(value: T): T => structuredClone(value);
const now = () => new Date().toISOString();
let nextId = 100;
const id = (prefix: string) => `${prefix}-${++nextId}`;
const defaultSettings: AppSettings = { auto_lock_minutes: 15, clipboard_clear_seconds: 30, mask_timeout_seconds: 15, dark_mode: false };
let previewSettings = copy(defaultSettings);
let previewInitialized = true;
let previewUnlocked = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("locked") !== "1";
let previewPassword = "demo";

function blankAccount(accountId: string, email: string, displayName: string | null): AccountDetail {
  return {
    id: accountId, email, display_name: displayName, purpose: null, tags: [], is_favorite: false,
    status: "未填写", notes: null, created_at: now(), updated_at: now(), last_verified_at: null, data_source: "演示数据",
    auth: { has_password: false, password: null, two_factor_status: "未填写", two_factor_methods: [], skip_password_status: "未填写", totp_status: "未填写", totp_secret: null, updated_at: now() },
    recovery: { has_recovery_email: "未填写", recovery_email: null, recovery_email_verified: "未填写", has_recovery_phone: "未填写", recovery_phone: null, recovery_phone_verified: "未填写", updated_at: now() },
    backup_code_batches: [], security_keys: [], subscriptions: [], custom_fields: [],
  };
}

function countBatch(batch: BackupCodeBatch): BackupCodeBatch {
  return { ...batch, total_count: batch.entries.length, unused_count: batch.entries.filter(e => !e.is_used && !e.is_revoked).length,
    used_count: batch.entries.filter(e => e.is_used).length, revoked_count: batch.entries.filter(e => e.is_revoked).length };
}

function fixtureAccounts(): AccountDetail[] {
  const work = blankAccount("acc-1", "alex.work@example.com", "工作账号");
  work.status = "正常";
  work.auth = { ...work.auth, has_password: true, password: "Demo-only-password!", two_factor_status: "开启", skip_password_status: "开启", totp_status: "开启", totp_secret: "JBSWY3DPEHPK3PXP" };
  work.recovery = { ...work.recovery, has_recovery_email: "有", recovery_email: "recovery@example.com", recovery_email_verified: "已验证", has_recovery_phone: "无" };
  work.subscriptions = [{ id: "sub-1", account_id: work.id, plan: "AI Pro", status: "有效", source: "自行订阅", start_date: "2026-09-20", end_date: null, next_billing_date: null, auto_renewal: "未填写", is_current: true }];
  work.backup_code_batches = [countBatch({ id: "batch-1", account_id: work.id, batch_number: 1, generation_date: "2026-10-20", created_at: "2026-10-20", is_active: true, source_note: "演示备用码", total_count: 0, unused_count: 0, used_count: 0, revoked_count: 0,
    entries: Array.from({ length: 10 }, (_, i) => ({ id: `code-${i + 1}`, batch_id: "batch-1", account_id: work.id, code: `${1000 + i} ${2000 + i}`, sequence_no: i + 1, is_used: i < 2, used_at: i < 2 ? "2026-10-20" : null, is_revoked: false })) })];
  work.security_keys = [{ id: "key-1", account_id: work.id, category: "通行密钥", display_name: "工作电脑", provider: "Windows Hello", device_name: "演示设备", creation_type: "手动", status: "正常", last_used_desc: "未填写", data_source: "演示数据" }];
  const research = blankAccount("acc-2", "research@example.com", "模型评测");
  research.auth = { ...research.auth, has_password: true, password: "Research-demo-only!", two_factor_status: "关闭", skip_password_status: "关闭", totp_status: "关闭" };
  research.recovery = { ...research.recovery, has_recovery_email: "无", has_recovery_phone: "有", recovery_phone: "+1 202 555 0100" };
  research.subscriptions = [{ id: "sub-2", account_id: research.id, plan: "AI Ultra", status: "试用", source: "活动赠送", start_date: null, auto_renewal: "关闭", is_current: true }];
  return [work, research, blankAccount("acc-3", "personal@example.com", "备用账号")];
}

let previewAccounts = isBrowserPreview ? fixtureAccounts() : [];
const previewChromeProfiles = new Map<string, ChromeProfileBinding>();
if (isBrowserPreview) {
  previewChromeProfiles.set("acc-1", {
    profile_path: "C:\\Users\\DemoUser\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 3",
    executable_path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
}
function requireUnlocked() {
  if (!previewInitialized || !previewUnlocked) throw new Error("请先解锁演示账号库");
}
function accountFor(accountId: string) {
  requireUnlocked();
  const account = previewAccounts.find(a => a.id === accountId);
  if (!account) throw new Error("账号不存在");
  return account;
}
function codeFor(codeId: string): { account: AccountDetail; batch: BackupCodeBatch; entry: BackupCodeEntry } {
  requireUnlocked();
  for (const account of previewAccounts) for (const batch of account.backup_code_batches) {
    const entry = batch.entries.find(e => e.id === codeId);
    if (entry) return { account, batch, entry };
  }
  throw new Error("备用码不存在");
}
function validateEmail(email: string, excludeId?: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("请输入有效邮箱");
  if (previewAccounts.some(a => a.id !== excludeId && a.email.toLowerCase() === email.toLowerCase())) throw new Error("这个邮箱已经存在");
}
function summaryFor(account: AccountDetail): AccountSummary {
  const batches = account.backup_code_batches.filter(b => b.is_active).map(countBatch);
  const subscription = account.subscriptions.find(s => s.is_current);
  return { id: account.id, email: account.email, display_name: account.display_name, purpose: account.purpose, tags: copy(account.tags), is_favorite: account.is_favorite, status: account.status,
    two_factor_status: account.auth.two_factor_status, backup_codes_remaining: batches.reduce((n, b) => n + b.unused_count, 0), backup_codes_total: batches.reduce((n, b) => n + b.total_count, 0),
    gemini_plan: subscription?.plan || "未填写", gemini_status: subscription?.status || "未填写", last_verified_at: account.last_verified_at, data_source: account.data_source, updated_at: account.updated_at };
}
function unsupportedFileOperation(): never { throw new Error("浏览器演示不支持资料库文件操作，请在桌面应用中使用"); }

function parsePreviewCodes(text: string): BackupCodesParseResult {
  const normalized = text.replace(/^\uFEFF/, "");
  const email = normalized.match(/[A-Z0-9_.+-]+@[A-Z0-9-]+\.[A-Z0-9.-]+/i)?.[0] || null;
  const date = normalized.match(/(?:生成时间|Generated|Date)[：:\s]*(\d{4}[年\-/.]\d{1,2}[月\-/.]\d{1,2}日?)/i)?.[1] || null;
  const candidates = Array.from(normalized.matchAll(/(?<![\w])(?:\d{4}[ \t]+\d{4}|\d{8})(?![\w])/g), m => m[0].replace(/\s/g, ""));
  const codes = Array.from(new Set(candidates)).map(c => `${c.slice(0, 4)} ${c.slice(4)}`);
  return { detected_email: email, generation_date: date, codes, total_detected: codes.length, duplicates_count: candidates.length - codes.length, warning_messages: codes.length && codes.length !== 10 ? [`识别到 ${codes.length} 条备用码，请核对。`] : [] };
}

function parsePreviewCsv(text: string): StructuredImportRow[] {
  const records: string[][] = [];
  let record: string[] = [], field = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (ch === "," && !quoted) { record.push(field.trim()); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      record.push(field.trim()); if (record.some(Boolean)) records.push(record); record = []; field = "";
    } else field += ch;
  }
  if (quoted) throw new Error("CSV 引号未闭合");
  record.push(field.trim()); if (record.some(Boolean)) records.push(record);
  const headers = records.shift()?.map(h => h.toLowerCase()) || [];
  const aliases: Record<keyof StructuredImportRow, string[]> = {
    email: ["email", "邮箱", "google邮箱", "账号", "account"], display_name: ["name", "display_name", "备注名", "名称"], purpose: ["purpose", "用途"], tags: ["tags", "标签", "分组"], password: ["password", "密码"], two_factor_status: ["two_factor", "2fa", "两步验证", "两步验证状态"], recovery_email: ["recovery_email", "辅助邮箱"], recovery_phone: ["recovery_phone", "辅助电话", "辅助手机"], gemini_plan: ["gemini", "gemini_plan", "订阅", "订阅套餐"], status: ["status", "账号状态", "状态"], notes: ["notes", "note", "备注", "说明"],
  };
  if (!headers.some(h => aliases.email.includes(h))) throw new Error("CSV 必须包含邮箱列");
  return records.map(values => {
    const row: StructuredImportRow = { email: "" };
    (Object.keys(aliases) as (keyof StructuredImportRow)[]).forEach(key => { const index = headers.findIndex(h => aliases[key].includes(h)); if (index >= 0 && values[index]) row[key] = values[index]; });
    return row;
  }).filter(row => row.email);
}

export const api = {
  getVaultStatus: async (): Promise<VaultStatus> => {
    if (!isTauri) return { initialized: previewInitialized, unlocked: previewUnlocked, db_path: "浏览器演示 · 仅保存在内存", auto_lock_minutes: previewSettings.auto_lock_minutes };
    return await invoke<VaultStatus>("get_vault_status");
  },
  initVault: async (password: string): Promise<boolean> => {
    if (!isTauri) { if (!password) throw new Error("请输入主密码"); previewPassword = password; previewInitialized = true; previewUnlocked = true; return true; }
    return await invoke<boolean>("init_vault", { password });
  },
  unlockVault: async (password: string): Promise<boolean> => {
    if (!isTauri) { if (password !== previewPassword) throw new Error("演示密码为 demo"); previewUnlocked = true; return true; }
    return await invoke<boolean>("unlock_vault", { password });
  },
  lockVault: async (): Promise<boolean> => {
    if (!isTauri) { previewUnlocked = false; return true; }
    return await invoke<boolean>("lock_vault");
  },
  resetVault: async (): Promise<boolean> => {
    if (!isTauri) { previewAccounts = []; previewInitialized = false; previewUnlocked = false; previewPassword = ""; previewSettings = copy(defaultSettings); return true; }
    return await invoke<boolean>("reset_vault");
  },
  changeMasterPassword: async (oldPassword: string, newPassword: string): Promise<boolean> => {
    if (!isTauri) { requireUnlocked(); if (oldPassword !== previewPassword) throw new Error("原密码不正确"); if (!newPassword) throw new Error("请输入新密码"); previewPassword = newPassword; return true; }
    return await invoke<boolean>("change_master_password", { oldPassword, newPassword });
  },
  getAccountsSummary: async (): Promise<AccountSummary[]> => {
    if (!isTauri) { requireUnlocked(); return previewAccounts.map(summaryFor); }
    return await invoke<AccountSummary[]>("get_accounts_summary");
  },
  getAccountDetail: async (accountId: string): Promise<AccountDetail> => {
    if (!isTauri) { const detail = copy(accountFor(accountId)); detail.backup_code_batches = detail.backup_code_batches.map(countBatch); return detail; }
    return await invoke<AccountDetail>("get_account_detail", { accountId });
  },
  getAccountPassword: async (accountId: string): Promise<string | null> => {
    if (!isTauri) return accountFor(accountId).auth.password || null;
    return await invoke<string | null>("get_account_password", { accountId });
  },
  createAccount: async (email: string, displayName?: string): Promise<string> => {
    if (!isTauri) { requireUnlocked(); validateEmail(email.trim()); const account = blankAccount(id("acc"), email.trim(), displayName || null); previewAccounts.push(account); return account.id; }
    return await invoke<string>("create_account", { email, displayName: displayName || null });
  },
  deleteAccount: async (accountId: string): Promise<boolean> => {
    if (!isTauri) { accountFor(accountId); previewAccounts = previewAccounts.filter(a => a.id !== accountId); return true; }
    return await invoke<boolean>("delete_account", { accountId });
  },
  updateBasicInfo: async (accountId: string, email: string, displayName: string | null, purpose: string | null, tags: string[], isFavorite: boolean, status: string, notes: string | null, lastVerifiedAt: string | null, dataSource: string | null): Promise<boolean> => {
    if (!isTauri) { const account = accountFor(accountId); validateEmail(email, accountId); Object.assign(account, { email, display_name: displayName, purpose, tags: copy(tags), is_favorite: isFavorite, status, notes, last_verified_at: lastVerifiedAt, data_source: dataSource, updated_at: now() }); return true; }
    return await invoke<boolean>("update_basic_info", { accountId, email, displayName, purpose, tags, isFavorite, status, notes, lastVerifiedAt, dataSource });
  },
  updateAuthInfo: async (accountId: string, hasPassword: boolean, password: string | null, twoFactorStatus: string, twoFactorMethods: string[], skipPasswordStatus: string, totpStatus?: string | null, totpSecret?: string | null, totpAddedAt?: string | null): Promise<boolean> => {
    if (!isTauri) { const account = accountFor(accountId); account.auth = { ...account.auth, has_password: hasPassword, password, two_factor_status: twoFactorStatus, two_factor_methods: copy(twoFactorMethods), skip_password_status: skipPasswordStatus, totp_status: totpStatus || "未记录", totp_secret: totpSecret || null, totp_added_at: totpAddedAt || null, updated_at: now() }; account.updated_at = now(); return true; }
    return await invoke<boolean>("update_auth_info", { accountId, hasPassword, password, twoFactorStatus, twoFactorMethods, skipPasswordStatus, totpStatus: totpStatus || "未记录", totpSecret: totpSecret || null, totpAddedAt: totpAddedAt || null });
  },
  updateRecoveryInfo: async (accountId: string, hasRecoveryEmail: string, recoveryEmail: string | null, recoveryEmailVerified: string, hasRecoveryPhone: string, recoveryPhone: string | null, recoveryPhoneVerified: string): Promise<boolean> => {
    if (!isTauri) { const account = accountFor(accountId); account.recovery = { has_recovery_email: hasRecoveryEmail, recovery_email: recoveryEmail, recovery_email_verified: recoveryEmailVerified, has_recovery_phone: hasRecoveryPhone, recovery_phone: recoveryPhone, recovery_phone_verified: recoveryPhoneVerified, updated_at: now() }; account.updated_at = now(); return true; }
    return await invoke<boolean>("update_recovery_info", { accountId, hasRecoveryEmail, recoveryEmail, recoveryEmailVerified, hasRecoveryPhone, recoveryPhone, recoveryPhoneVerified });
  },
  saveSubscription: async (accountId: string, subscription: SubscriptionEntry): Promise<string> => {
    if (!isTauri) { const account = accountFor(accountId); const saved = { ...copy(subscription), id: subscription.id || id("sub"), account_id: accountId }; if (saved.is_current) account.subscriptions.forEach(s => { s.is_current = false; }); const index = account.subscriptions.findIndex(s => s.id === saved.id); if (index >= 0) account.subscriptions[index] = saved; else account.subscriptions.push(saved); account.updated_at = now(); return saved.id; }
    return await invoke<string>("save_subscription", { accountId, subscription });
  },
  saveSecurityKey: async (accountId: string, securityKey: SecurityKeyEntry): Promise<string> => {
    if (!isTauri) { const account = accountFor(accountId); const saved = { ...copy(securityKey), id: securityKey.id || id("key"), account_id: accountId }; const index = account.security_keys.findIndex(k => k.id === saved.id); if (index >= 0) account.security_keys[index] = saved; else account.security_keys.push(saved); account.updated_at = now(); return saved.id; }
    return await invoke<string>("save_security_key", { accountId, securityKey });
  },
  deleteSecurityKey: async (cardId: string): Promise<boolean> => {
    if (!isTauri) { requireUnlocked(); const account = previewAccounts.find(a => a.security_keys.some(k => k.id === cardId)); if (!account) throw new Error("密钥记录不存在"); account.security_keys = account.security_keys.filter(k => k.id !== cardId); return true; }
    return await invoke<boolean>("delete_security_key", { cardId });
  },
  addBackupCodeBatch: async (accountId: string, codes: string[], generationDate: string | null, sourceNote: string | null, isNewBatch: boolean): Promise<string> => {
    if (!isTauri) { const account = accountFor(accountId); const batchId = id("batch"); if (isNewBatch) account.backup_code_batches.forEach(b => { b.is_active = false; }); const entries = codes.map(c => c.trim()).filter(Boolean).map((code, i) => ({ id: id("code"), batch_id: batchId, account_id: accountId, code, sequence_no: i + 1, is_used: false, used_at: null, is_revoked: false })); account.backup_code_batches.push(countBatch({ id: batchId, account_id: accountId, batch_number: Math.max(0, ...account.backup_code_batches.map(b => b.batch_number)) + 1, generation_date: generationDate, created_at: now(), is_active: true, source_note: sourceNote, entries, total_count: 0, unused_count: 0, used_count: 0, revoked_count: 0 })); account.updated_at = now(); return batchId; }
    return await invoke<string>("add_backup_code_batch", { accountId, codes, generationDate, sourceNote, isNewBatch });
  },
  markBackupCodeUsed: async (codeId: string, isUsed: boolean): Promise<boolean> => {
    if (!isTauri) { const { entry } = codeFor(codeId); entry.is_used = isUsed; entry.used_at = isUsed ? now() : null; return true; }
    return await invoke<boolean>("mark_backup_code_used", { codeId, isUsed });
  },
  revokeBackupCode: async (codeId: string, isRevoked: boolean): Promise<boolean> => {
    if (!isTauri) { codeFor(codeId).entry.is_revoked = isRevoked; return true; }
    return await invoke<boolean>("revoke_backup_code", { codeId, isRevoked });
  },
  parseBackupCodesText: async (text: string): Promise<BackupCodesParseResult> => {
    if (!isTauri) return parsePreviewCodes(text);
    return await invoke<BackupCodesParseResult>("parse_backup_codes_text", { text });
  },
  parseCsvContent: async (csvText: string): Promise<StructuredImportRow[]> => {
    if (!isTauri) return parsePreviewCsv(csvText);
    return await invoke<StructuredImportRow[]>("parse_csv_content", { csvText });
  },
  importStructuredAccounts: async (rows: StructuredImportRow[]): Promise<StructuredImportResult> => {
    if (!isTauri) {
      requireUnlocked();
      const result: StructuredImportResult = { success_count: 0, skipped_count: 0, error_count: 0, messages: [] };
      for (const row of rows) {
        if (previewAccounts.some(a => a.email.toLowerCase() === row.email.trim().toLowerCase())) { result.skipped_count++; continue; }
        try {
          validateEmail(row.email.trim()); const account = blankAccount(id("acc"), row.email.trim(), row.display_name || null);
          account.purpose = row.purpose || null; account.notes = row.notes || null; account.status = row.status || "未填写";
          account.auth.password = row.password || null; account.auth.has_password = Boolean(row.password); account.auth.two_factor_status = row.two_factor_status || "未填写";
          if (row.recovery_email) { account.recovery.has_recovery_email = "有"; account.recovery.recovery_email = row.recovery_email; }
          if (row.recovery_phone) { account.recovery.has_recovery_phone = "有"; account.recovery.recovery_phone = row.recovery_phone; }
          if (row.gemini_plan) account.subscriptions.push({ id: id("sub"), account_id: account.id, plan: row.gemini_plan, status: "未填写", source: "未填写", auto_renewal: "未填写", is_current: true });
          previewAccounts.push(account); result.success_count++;
        } catch { result.error_count++; result.messages.push("有一行邮箱格式不正确，未导入。"); }
      }
      return result;
    }
    return await invoke<StructuredImportResult>("import_structured_accounts", { rows });
  },
  exportEncryptedBackup: async (destinationPath: string, password: string): Promise<boolean> => {
    if (!isTauri) return unsupportedFileOperation();
    return await invoke<boolean>("export_encrypted_backup", { destinationPath, password });
  },
  restoreEncryptedBackup: async (backupPath: string, password: string): Promise<boolean> => {
    if (!isTauri) return unsupportedFileOperation();
    return await invoke<boolean>("restore_encrypted_backup", { backupPath, password });
  },
  getAppSettings: async (): Promise<AppSettings> => {
    if (!isTauri) { requireUnlocked(); return copy(previewSettings); }
    return await invoke<AppSettings>("get_app_settings");
  },
  saveAppSettings: async (settings: AppSettings): Promise<boolean> => {
    if (!isTauri) { requireUnlocked(); previewSettings = copy(settings); return true; }
    return await invoke<boolean>("save_app_settings", { settings });
  },
  seedMockData: async (): Promise<boolean> => {
    if (!isTauri) {
      requireUnlocked();
      for (const fixture of fixtureAccounts()) {
        if (previewAccounts.some(a => a.email === fixture.email)) continue;
        fixture.id = id("acc");
        fixture.subscriptions.forEach(s => { s.id = id("sub"); s.account_id = fixture.id; });
        fixture.security_keys.forEach(k => { k.id = id("key"); k.account_id = fixture.id; });
        fixture.backup_code_batches.forEach(b => {
          b.id = id("batch"); b.account_id = fixture.id;
          b.entries.forEach(e => { e.id = id("code"); e.account_id = fixture.id; e.batch_id = b.id; });
        });
        previewAccounts.push(fixture);
      }
      return true;
    }
    return await invoke<boolean>("seed_mock_data");
  },
  openUrl: async (url: string): Promise<boolean> => {
    if (!isTauri) { window.open(url, "_blank", "noopener,noreferrer"); return true; }
    return await invoke<boolean>("open_url", { url });
  },
  getAccountChromeProfile: async (accountId: string): Promise<ChromeProfileBinding | null> => {
    if (!isTauri) { accountFor(accountId); return copy(previewChromeProfiles.get(accountId) || null); }
    return await invoke<ChromeProfileBinding | null>("get_account_chrome_profile", { accountId });
  },
  saveAccountChromeProfile: async (accountId: string, binding: ChromeProfileBinding | null): Promise<boolean> => {
    if (!isTauri) {
      accountFor(accountId);
      if (binding) previewChromeProfiles.set(accountId, copy(binding));
      else previewChromeProfiles.delete(accountId);
      return true;
    }
    return await invoke<boolean>("save_account_chrome_profile", { accountId, binding });
  },
  openAccountChrome: async (accountId: string, url?: string): Promise<boolean> => {
    if (!isTauri) {
      accountFor(accountId);
      if (url) {
        window.open(url, "_blank");
        return true;
      }
      throw new Error("浏览器演示无法启动本机 Chrome，请在桌面程序中使用。");
    }
    return await invoke<boolean>("open_account_chrome", { accountId, url: url || null });
  },
  autoDetectChromeProfile: async (accountEmail?: string): Promise<ChromeProfileBinding> => {
    if (!isTauri) {
      return {
        executable_path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        profile_path: "C:\\Users\\DemoUser\\AppData\\Local\\Google\\Chrome\\User Data\\Default",
      };
    }
    return await invoke<ChromeProfileBinding>("auto_detect_chrome_profile", { accountEmail: accountEmail || null });
  },
  getActiveBrowserProfile: async (): Promise<DetectedBrowserProfile> => {
    if (!isTauri) {
      return {
        email: "alex.work@example.com",
        profile_name: "Profile 1",
        display_name: "Work Profile",
        executable_path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        profile_path: "C:\\Users\\DemoUser\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1",
      };
    }
    return await invoke<DetectedBrowserProfile>("get_active_browser_profile");
  },
  crawlAccountSecurity: async (accountId: string): Promise<ScrapedSecurityData> => {
    if (!isTauri) {
      accountFor(accountId);
      // In browser preview, do not return fake mock data. Prompt user to paste or use probe.
      throw new Error("CHROME_OPENED_WAITING_PROBE:已为您在 Chrome 打开安全中心页面。请在页面使用探针脚本或复制页面内容完成真实同步。");
    }
    return await invoke<ScrapedSecurityData>("crawl_account_security", { accountId });
  },
  getSyncedSecurityData: async (): Promise<ScrapedSecurityData | null> => {
    if (!isTauri) return null;
    return await invoke<ScrapedSecurityData | null>("get_synced_security_data");
  },
  clearSyncedSecurityData: async (): Promise<boolean> => {
    if (!isTauri) return true;
    return await invoke<boolean>("clear_synced_security_data");
  },
};
