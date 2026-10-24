export interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  db_path: string;
  auto_lock_minutes: number;
}

export interface ChromeProfileBinding {
  executable_path: string;
  profile_path: string;
}

export interface DetectedBrowserProfile {
  email: string | null;
  profile_name: string;
  display_name: string | null;
  executable_path: string;
  profile_path: string;
}

export interface ScrapedSecurityData {
  two_factor_status?: string | null;
  two_factor_phone?: string | null;
  two_factor_methods?: string[] | null;
  skip_password_status?: string | null;
  totp_status?: string | null;
  totp_added_at?: string | null;
  has_recovery_phone?: string | null;
  recovery_phone?: string | null;
  recovery_phone_verified?: string | null;
  has_recovery_email?: string | null;
  recovery_email?: string | null;
  recovery_email_verified?: string | null;
  backup_codes_status?: string | null;
  backup_codes_remaining?: number | null;
  membership_status?: string | null;
  membership_plan?: string | null;
  membership_start_date?: string | null;
  raw_source?: string | null;
  extracted_at?: string | null;
}

export interface AccountSummary {
  id: string;
  email: string;
  display_name: string | null;
  purpose: string | null;
  tags: string[];
  is_favorite: boolean;
  status: string;
  two_factor_status: string;
  backup_codes_remaining: number;
  backup_codes_total: number;
  gemini_plan: string;
  gemini_status: string;
  last_verified_at: string | null;
  data_source: string | null;
  updated_at: string;
}

export interface AuthInfo {
  has_password: boolean;
  password?: string | null;
  password_updated_at?: string | null;
  two_factor_status: string; // '未记录' | '开启' | '关闭'
  two_factor_methods: string[];
  skip_password_status: string; // '未记录' | '开启' | '关闭'
  totp_status?: string | null; // '未记录' | '未填写' | '开启' | '关闭'
  totp_secret?: string | null;
  totp_added_at?: string | null;
  backup_codes_status?: string | null; // '未记录' | '开启' | '关闭'
  backup_codes_count?: number | null;
  updated_at: string;
}

export interface RecoveryInfo {
  has_recovery_email: string; // '未记录' | '无' | '有'
  recovery_email: string | null;
  recovery_email_verified: string; // '未记录' | '已验证' | '未验证'
  has_recovery_phone: string; // '未记录' | '无' | '有'
  recovery_phone: string | null;
  recovery_phone_verified: string; // '未记录' | '已验证' | '未验证'
  updated_at: string;
}

export interface BackupCodeEntry {
  id: string;
  batch_id: string;
  account_id: string;
  code: string;
  sequence_no: number;
  is_used: boolean;
  used_at: string | null;
  is_revoked: boolean;
}

export interface BackupCodeBatch {
  id: string;
  account_id: string;
  batch_number: number;
  generation_date: string | null;
  created_at: string;
  is_active: boolean;
  source_note: string | null;
  entries: BackupCodeEntry[];
  total_count: number;
  unused_count: number;
  used_count: number;
  revoked_count: number;
}

export interface SecurityKeyEntry {
  id: string;
  account_id: string;
  category: string; // '通行密钥' | '安全密钥'
  display_name: string;
  provider: string; // 'Google 密码管理工具' | 'Windows Hello' | '硬件安全密钥' | '其他'
  device_name?: string | null;
  device_model?: string | null;
  storage_location?: string | null;
  created_at?: string | null;
  last_used_desc?: string | null; // e.g. "5 小时前", "从未使用", "未记录"
  creation_type: string; // '手动' | 'Android 自动创建' | '未记录'
  status: string; // '正常' | '待核对' | '已撤销' | '设备遗失'
  data_source?: string | null;
  observation_time?: string | null;
  notes?: string | null;
}

export interface SubscriptionEntry {
  id: string;
  account_id: string;
  plan: string; // '未记录' | '免费' | 'AI Plus' | 'AI Pro' | 'AI Ultra' | '自定义套餐'
  custom_plan_name?: string | null;
  status: string; // '未记录' | '试用' | '有效' | '已取消但仍有效' | '已到期'
  source: string; // '自行订阅' | '家庭共享' | '活动赠送' | '其他'
  start_date?: string | null;
  end_date?: string | null;
  next_billing_date?: string | null;
  auto_renewal: string; // '未记录' | '开启' | '关闭'
  cost?: string | null;
  currency?: string | null;
  notes?: string | null;
  is_current: boolean;
}

export interface CustomFieldEntry {
  id: string;
  account_id: string;
  field_name: string;
  field_group?: string | null;
  field_type: string; // 'text' | 'date' | 'number' | 'select' | 'sensitive'
  field_value?: string | null;
  sort_order: number;
  is_sensitive: boolean;
}

export interface AccountDetail {
  id: string;
  email: string;
  display_name: string | null;
  purpose: string | null;
  tags: string[];
  is_favorite: boolean;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
  data_source: string | null;
  auth: AuthInfo;
  recovery: RecoveryInfo;
  backup_code_batches: BackupCodeBatch[];
  security_keys: SecurityKeyEntry[];
  subscriptions: SubscriptionEntry[];
  custom_fields: CustomFieldEntry[];
}

export interface AppSettings {
  auto_lock_minutes: number;
  clipboard_clear_seconds: number;
  mask_timeout_seconds: number;
  dark_mode: boolean;
}

export interface BackupCodesParseResult {
  detected_email: string | null;
  generation_date: string | null;
  codes: string[];
  total_detected: number;
  duplicates_count: number;
  warning_messages: string[];
}

export interface StructuredImportRow {
  email: string;
  display_name?: string | null;
  purpose?: string | null;
  tags?: string | null;
  password?: string | null;
  two_factor_status?: string | null;
  recovery_email?: string | null;
  recovery_phone?: string | null;
  gemini_plan?: string | null;
  status?: string | null;
  notes?: string | null;
}

export interface StructuredImportResult {
  success_count: number;
  skipped_count: number;
  error_count: number;
  messages: string[];
}
