use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultMeta {
    pub schema_version: i32,
    pub salt: String,
    pub argon2_params: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStatus {
    pub initialized: bool,
    pub unlocked: bool,
    pub db_path: String,
    pub auto_lock_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountSummary {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub purpose: Option<String>,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub status: String,
    pub two_factor_status: String,
    pub backup_codes_remaining: i64,
    pub backup_codes_total: i64,
    pub gemini_plan: String,
    pub gemini_status: String,
    pub last_verified_at: Option<String>,
    pub data_source: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountDetail {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub purpose: Option<String>,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_verified_at: Option<String>,
    pub data_source: Option<String>,

    pub auth: AuthInfo,
    pub recovery: RecoveryInfo,
    pub backup_code_batches: Vec<BackupCodeBatch>,
    pub security_keys: Vec<SecurityKeyEntry>,
    pub subscriptions: Vec<SubscriptionEntry>,
    pub custom_fields: Vec<CustomFieldEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthInfo {
    pub has_password: bool,
    pub password: Option<String>,
    pub password_updated_at: Option<String>,
    pub two_factor_status: String,
    pub two_factor_methods: Vec<String>,
    pub skip_password_status: String,
    pub totp_status: Option<String>,
    pub totp_secret: Option<String>,
    pub totp_added_at: Option<String>,
    pub backup_codes_status: Option<String>,
    pub backup_codes_count: Option<i64>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryInfo {
    pub has_recovery_email: String,
    pub recovery_email: Option<String>,
    pub recovery_email_verified: String,
    pub has_recovery_phone: String,
    pub recovery_phone: Option<String>,
    pub recovery_phone_verified: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupCodeBatch {
    pub id: String,
    pub account_id: String,
    pub batch_number: i32,
    pub generation_date: Option<String>,
    pub created_at: String,
    pub is_active: bool,
    pub source_note: Option<String>,
    pub entries: Vec<BackupCodeEntry>,
    pub total_count: i64,
    pub unused_count: i64,
    pub used_count: i64,
    pub revoked_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupCodeEntry {
    pub id: String,
    pub batch_id: String,
    pub account_id: String,
    pub code: String,
    pub sequence_no: i32,
    pub is_used: bool,
    pub used_at: Option<String>,
    pub is_revoked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityKeyEntry {
    pub id: String,
    pub account_id: String,
    pub category: String,
    pub display_name: String,
    pub provider: String,
    pub device_name: Option<String>,
    pub device_model: Option<String>,
    pub storage_location: Option<String>,
    pub created_at: Option<String>,
    pub last_used_desc: Option<String>,
    pub creation_type: String,
    pub status: String,
    pub data_source: Option<String>,
    pub observation_time: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionEntry {
    pub id: String,
    pub account_id: String,
    pub plan: String,
    pub custom_plan_name: Option<String>,
    pub status: String,
    pub source: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub next_billing_date: Option<String>,
    pub auto_renewal: String,
    pub cost: Option<String>,
    pub currency: Option<String>,
    pub notes: Option<String>,
    pub is_current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomFieldEntry {
    pub id: String,
    pub account_id: String,
    pub field_name: String,
    pub field_group: Option<String>,
    pub field_type: String,
    pub field_value: Option<String>,
    pub sort_order: i32,
    pub is_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub auto_lock_minutes: u32,
    pub clipboard_clear_seconds: u32,
    pub mask_timeout_seconds: u32,
    pub dark_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChromeProfileBinding {
    pub executable_path: String,
    pub profile_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedBrowserProfile {
    pub email: Option<String>,
    pub profile_name: String,
    pub display_name: Option<String>,
    pub executable_path: String,
    pub profile_path: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_lock_minutes: 15,
            clipboard_clear_seconds: 30,
            mask_timeout_seconds: 15,
            dark_mode: false,
        }
    }
}
