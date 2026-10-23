use crate::crypto::{self, decrypt_backup_payload, encrypt_backup_payload};
use crate::db;
use crate::importer::{self, BackupCodesParseResult, StructuredImportResult, StructuredImportRow};
use crate::models::*;
use serde::{Deserialize, Serialize};
use parking_lot::Mutex;
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::State;
use zeroize::Zeroizing;

pub struct AppState {
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub meta_path: PathBuf,
    pub is_unlocked: AtomicBool,
    pub db_conn: Mutex<Option<Connection>>,
    pub master_key: Mutex<Option<Zeroizing<Vec<u8>>>>,
    pub last_activity: Mutex<Instant>,
    pub auto_lock_minutes: Mutex<u32>,
}

impl AppState {
    pub fn new() -> Self {
        let base_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("AccountVault");
        let _ = fs::create_dir_all(&base_dir);

        let db_path = base_dir.join("vault.db");
        let meta_path = base_dir.join("vault.meta");

        Self {
            data_dir: base_dir,
            db_path,
            meta_path,
            is_unlocked: AtomicBool::new(false),
            db_conn: Mutex::new(None),
            master_key: Mutex::new(None),
            last_activity: Mutex::new(Instant::now()),
            auto_lock_minutes: Mutex::new(15),
        }
    }

    pub fn touch_activity(&self) {
        *self.last_activity.lock() = Instant::now();
    }

    pub fn check_idle_lock(&self) {
        let minutes = *self.auto_lock_minutes.lock();
        if minutes > 0 && self.is_unlocked.load(Ordering::SeqCst) {
            let last = *self.last_activity.lock();
            if last.elapsed().as_secs() > (minutes as u64 * 60) {
                self.force_lock();
            }
        }
    }

    pub fn force_lock(&self) {
        self.is_unlocked.store(false, Ordering::SeqCst);
        let mut conn_guard = self.db_conn.lock();
        *conn_guard = None;
        let mut key_guard = self.master_key.lock();
        *key_guard = None;
    }
}

// Helper to ensure vault is unlocked and get DB connection
fn with_db<F, R>(state: &State<Arc<AppState>>, f: F) -> Result<R, String>
where
    F: FnOnce(&Connection) -> Result<R, String>,
{
    state.check_idle_lock();
    if !state.is_unlocked.load(Ordering::SeqCst) {
        return Err("资料库已锁定，请先输入主密码解锁。".to_string());
    }
    state.touch_activity();

    let guard = state.db_conn.lock();
    match guard.as_ref() {
        Some(conn) => f(conn),
        None => Err("资料库连接未建立，请重新解锁。".to_string()),
    }
}

fn with_db_mut<F, R>(state: &State<Arc<AppState>>, f: F) -> Result<R, String>
where
    F: FnOnce(&mut Connection) -> Result<R, String>,
{
    state.check_idle_lock();
    if !state.is_unlocked.load(Ordering::SeqCst) {
        return Err("资料库已锁定，请先输入主密码解锁。".to_string());
    }
    state.touch_activity();

    let mut guard = state.db_conn.lock();
    match guard.as_mut() {
        Some(conn) => f(conn),
        None => Err("资料库连接未建立，请重新解锁。".to_string()),
    }
}

#[tauri::command]
pub fn get_vault_status(state: State<Arc<AppState>>) -> VaultStatus {
    state.check_idle_lock();
    let initialized = state.meta_path.exists() && state.db_path.exists();
    let unlocked = state.is_unlocked.load(Ordering::SeqCst);
    let auto_lock_minutes = *state.auto_lock_minutes.lock();

    VaultStatus {
        initialized,
        unlocked,
        db_path: state.db_path.to_string_lossy().to_string(),
        auto_lock_minutes,
    }
}

#[tauri::command]
pub fn init_vault(state: State<Arc<AppState>>, password: String) -> Result<bool, String> {
    let pw_trimmed = password.trim();
    if pw_trimmed.len() < 6 {
        return Err("主密码长度至少需要 6 个字符。".to_string());
    }

    if state.meta_path.exists() && state.db_path.exists() {
        return Err("资料库已经初始化过，请直接解锁。".to_string());
    }

    let salt = crypto::generate_salt();
    let key = crypto::derive_key(pw_trimmed, &salt)?;

    // Create and init SQLCipher database
    let conn = db::open_encrypted_db(&state.db_path, &key)?;
    db::init_tables(&conn)?;

    // Save meta file
    let meta = VaultMeta {
        schema_version: crypto::SCHEMA_VERSION,
        salt,
        argon2_params: "m=65536,t=3,p=2".to_string(),
        created_at: chrono::Local::now().to_rfc3339(),
        updated_at: chrono::Local::now().to_rfc3339(),
    };

    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize meta: {}", e))?;
    fs::write(&state.meta_path, meta_json)
        .map_err(|e| format!("Failed to save vault meta file: {}", e))?;

    *state.db_conn.lock() = Some(conn);
    *state.master_key.lock() = Some(key);
    state.is_unlocked.store(true, Ordering::SeqCst);
    state.touch_activity();

    Ok(true)
}

#[tauri::command]
pub fn unlock_vault(state: State<Arc<AppState>>, password: String) -> Result<bool, String> {
    if !state.meta_path.exists() || !state.db_path.exists() {
        return Err("尚未初始化资料库，请先设置主密码创建。".to_string());
    }

    let meta_content = fs::read_to_string(&state.meta_path)
        .map_err(|e| format!("Failed to read meta file: {}", e))?;
    let meta: VaultMeta = serde_json::from_str(&meta_content)
        .map_err(|e| format!("Invalid vault meta: {}", e))?;

    let key = crypto::derive_key(password.trim(), &meta.salt)?;

    // Attempt to open and verify SQLCipher connection
    let conn = db::open_encrypted_db(&state.db_path, &key)
        .map_err(|e| {
            if e.contains("file is not a database") || e.contains("invalid key") {
                "主密码错误，请核对后重新输入。".to_string()
            } else {
                e
            }
        })?;
    db::init_tables(&conn)?;

    // Load settings to set auto-lock
    if let Ok(settings) = db::get_app_settings(&conn) {
        *state.auto_lock_minutes.lock() = settings.auto_lock_minutes;
    }

    *state.db_conn.lock() = Some(conn);
    *state.master_key.lock() = Some(key);
    state.is_unlocked.store(true, Ordering::SeqCst);
    state.touch_activity();

    Ok(true)
}

#[tauri::command]
pub fn lock_vault(state: State<Arc<AppState>>) -> bool {
    state.force_lock();
    true
}

#[tauri::command]
pub fn reset_vault(state: State<Arc<AppState>>) -> Result<bool, String> {
    state.force_lock();
    if state.db_path.exists() {
        let _ = fs::remove_file(&state.db_path);
    }
    if state.meta_path.exists() {
        let _ = fs::remove_file(&state.meta_path);
    }
    Ok(true)
}

#[tauri::command]
pub fn change_master_password(
    state: State<Arc<AppState>>,
    old_password: String,
    new_password: String,
) -> Result<bool, String> {
    let new_trimmed = new_password.trim();
    if new_trimmed.len() < 6 {
        return Err("新主密码长度至少需要 6 个字符。".to_string());
    }

    with_db(&state, |conn| {
        // 1. Verify old password against meta
        let meta_content = fs::read_to_string(&state.meta_path)
            .map_err(|e| format!("Failed to read meta: {}", e))?;
        let meta: VaultMeta = serde_json::from_str(&meta_content)
            .map_err(|e| format!("Invalid meta: {}", e))?;

        let old_key = crypto::derive_key(old_password.trim(), &meta.salt)?;
        let _ = db::open_encrypted_db(&state.db_path, &old_key)
            .map_err(|_| "原主密码错误，无法修改。".to_string())?;

        // 2. Generate new salt and derive new key
        let new_salt = crypto::generate_salt();
        let new_key = crypto::derive_key(new_trimmed, &new_salt)?;
        let new_hex_key = crypto::key_to_hex(&new_key);

        // 3. Re-key SQLCipher database
        let rekey_stmt = format!("PRAGMA rekey = \"x'{}'\";", new_hex_key);
        conn.execute_batch(&rekey_stmt)
            .map_err(|e| format!("Failed to rekey database: {}", e))?;

        // 4. Update meta file
        let new_meta = VaultMeta {
            schema_version: meta.schema_version,
            salt: new_salt,
            argon2_params: "m=65536,t=3,p=2".to_string(),
            created_at: meta.created_at,
            updated_at: chrono::Local::now().to_rfc3339(),
        };
        let new_meta_json = serde_json::to_string_pretty(&new_meta)
            .map_err(|e| format!("Failed to serialize meta: {}", e))?;
        fs::write(&state.meta_path, new_meta_json)
            .map_err(|e| format!("Failed to save new meta: {}", e))?;

        *state.master_key.lock() = Some(new_key);
        Ok(true)
    })
}

#[tauri::command]
pub fn get_accounts_summary(state: State<Arc<AppState>>) -> Result<Vec<AccountSummary>, String> {
    with_db(&state, |conn| db::get_accounts_summary(conn))
}

#[tauri::command]
pub fn get_account_detail(
    state: State<Arc<AppState>>,
    account_id: String,
) -> Result<AccountDetail, String> {
    with_db(&state, |conn| db::get_account_detail(conn, &account_id))
}

#[tauri::command]
pub fn get_account_password(
    state: State<Arc<AppState>>,
    account_id: String,
) -> Result<Option<String>, String> {
    with_db(&state, |conn| {
        let pw = conn.query_row(
            "SELECT password_enc FROM auth_info WHERE account_id = ?1",
            rusqlite::params![account_id],
            |r| r.get::<_, Option<String>>(0),
        ).unwrap_or(None);
        Ok(pw)
    })
}

#[tauri::command]
pub fn create_account(
    state: State<Arc<AppState>>,
    email: String,
    display_name: Option<String>,
) -> Result<String, String> {
    with_db(&state, |conn| {
        db::create_account(conn, &email, display_name.as_deref())
    })
}

#[tauri::command]
pub fn update_basic_info(
    state: State<Arc<AppState>>,
    account_id: String,
    email: String,
    display_name: Option<String>,
    purpose: Option<String>,
    tags: Vec<String>,
    is_favorite: bool,
    status: String,
    notes: Option<String>,
    last_verified_at: Option<String>,
    data_source: Option<String>,
) -> Result<bool, String> {
    with_db(&state, |conn| {
        db::update_basic_info(
            conn,
            &account_id,
            &email,
            display_name.as_deref(),
            purpose.as_deref(),
            &tags,
            is_favorite,
            &status,
            notes.as_deref(),
            last_verified_at.as_deref(),
            data_source.as_deref(),
        )?;
        Ok(true)
    })
}

#[tauri::command]
pub fn update_auth_info(
    state: State<Arc<AppState>>,
    account_id: String,
    has_password: bool,
    password: Option<String>,
    two_factor_status: String,
    two_factor_methods: Vec<String>,
    skip_password_status: String,
    totp_status: Option<String>,
    totp_secret: Option<String>,
    totp_added_at: Option<String>,
) -> Result<bool, String> {
    with_db(&state, |conn| {
        db::update_auth_info(
            conn,
            &account_id,
            has_password,
            password.as_deref(),
            &two_factor_status,
            &two_factor_methods,
            &skip_password_status,
            totp_status.as_deref(),
            totp_secret.as_deref(),
            totp_added_at.as_deref(),
        )?;
        Ok(true)
    })
}

#[tauri::command]
pub fn update_recovery_info(
    state: State<Arc<AppState>>,
    account_id: String,
    has_recovery_email: String,
    recovery_email: Option<String>,
    recovery_email_verified: String,
    has_recovery_phone: String,
    recovery_phone: Option<String>,
    recovery_phone_verified: String,
) -> Result<bool, String> {
    with_db(&state, |conn| {
        db::update_recovery_info(
            conn,
            &account_id,
            &has_recovery_email,
            recovery_email.as_deref(),
            &recovery_email_verified,
            &has_recovery_phone,
            recovery_phone.as_deref(),
            &recovery_phone_verified,
        )?;
        Ok(true)
    })
}

#[tauri::command]
pub fn save_subscription(
    state: State<Arc<AppState>>,
    account_id: String,
    subscription: SubscriptionEntry,
) -> Result<String, String> {
    with_db(&state, |conn| {
        db::save_subscription(conn, &account_id, &subscription)
    })
}

#[tauri::command]
pub fn save_security_key(
    state: State<Arc<AppState>>,
    account_id: String,
    security_key: SecurityKeyEntry,
) -> Result<String, String> {
    with_db(&state, |conn| {
        db::save_security_key(conn, &account_id, &security_key)
    })
}

#[tauri::command]
pub fn delete_security_key(state: State<Arc<AppState>>, card_id: String) -> Result<bool, String> {
    with_db(&state, |conn| {
        db::delete_security_key(conn, &card_id)?;
        Ok(true)
    })
}

#[tauri::command]
pub fn add_backup_code_batch(
    state: State<Arc<AppState>>,
    account_id: String,
    codes: Vec<String>,
    generation_date: Option<String>,
    source_note: Option<String>,
    is_new_batch: bool,
) -> Result<String, String> {
    with_db_mut(&state, |conn| {
        db::add_backup_code_batch(
            conn,
            &account_id,
            &codes,
            generation_date.as_deref(),
            source_note.as_deref(),
            is_new_batch,
        )
    })
}

#[tauri::command]
pub fn mark_backup_code_used(
    state: State<Arc<AppState>>,
    code_id: String,
    is_used: bool,
) -> Result<bool, String> {
    with_db(&state, |conn| {
        db::mark_backup_code_used(conn, &code_id, is_used)?;
        Ok(true)
    })
}

#[tauri::command]
pub fn revoke_backup_code(
    state: State<Arc<AppState>>,
    code_id: String,
    is_revoked: bool,
) -> Result<bool, String> {
    with_db(&state, |conn| {
        db::revoke_backup_code(conn, &code_id, is_revoked)?;
        Ok(true)
    })
}

#[tauri::command]
pub fn delete_account(state: State<Arc<AppState>>, account_id: String) -> Result<bool, String> {
    with_db(&state, |conn| {
        db::delete_account(conn, &account_id)?;
        Ok(true)
    })
}

#[tauri::command]
pub fn parse_backup_codes_text(text: String) -> BackupCodesParseResult {
    importer::parse_google_backup_codes_text(&text)
}

#[tauri::command]
pub fn parse_csv_content(csv_text: String) -> Result<Vec<StructuredImportRow>, String> {
    importer::parse_csv_accounts(&csv_text)
}

#[tauri::command]
pub fn import_structured_accounts(
    state: State<Arc<AppState>>,
    rows: Vec<StructuredImportRow>,
) -> Result<StructuredImportResult, String> {
    with_db_mut(&state, |conn| {
        let mut success = 0;
        let mut skipped = 0;
        let mut errors = 0;
        let mut messages = Vec::new();

        for row in rows {
            let email = row.email.trim().to_lowercase();
            if email.is_empty() {
                skipped += 1;
                continue;
            }

            // Check if account already exists
            let existing_id: Result<String, _> = conn.query_row(
                "SELECT id FROM accounts WHERE email = ?1",
                rusqlite::params![email],
                |r| r.get(0),
            );

            let account_id = match existing_id {
                Ok(id) => {
                    // Update existing
                    messages.push(format!("更新已有账号: {}", email));
                    id
                }
                Err(_) => {
                    // Create new
                    match db::create_account(conn, &email, row.display_name.as_deref()) {
                        Ok(id) => {
                            messages.push(format!("新建账号: {}", email));
                            id
                        }
                        Err(e) => {
                            errors += 1;
                            messages.push(format!("创建账号失败 {}: {}", email, e));
                            continue;
                        }
                    }
                }
            };

            // Update details
            let tags: Vec<String> = row
                .tags
                .map(|t| t.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
                .unwrap_or_default();

            let _ = db::update_basic_info(
                conn,
                &account_id,
                &email,
                row.display_name.as_deref(),
                row.purpose.as_deref(),
                &tags,
                false,
                row.status.as_deref().unwrap_or("未记录"),
                row.notes.as_deref(),
                None,
                Some("批量结构化导入"),
            );

            if row.password.is_some() || row.two_factor_status.is_some() {
                let has_pw = row.password.is_some();
                let _ = db::update_auth_info(
                    conn,
                    &account_id,
                    has_pw,
                    row.password.as_deref(),
                    row.two_factor_status.as_deref().unwrap_or("未记录"),
                    &[],
                    "未记录",
                    None,
                    None,
                    None,
                );
            }

            if row.recovery_email.is_some() || row.recovery_phone.is_some() {
                let has_re = if row.recovery_email.is_some() { "有" } else { "未记录" };
                let has_rp = if row.recovery_phone.is_some() { "有" } else { "未记录" };
                let _ = db::update_recovery_info(
                    conn,
                    &account_id,
                    has_re,
                    row.recovery_email.as_deref(),
                    "未记录",
                    has_rp,
                    row.recovery_phone.as_deref(),
                    "未记录",
                );
            }

            if let Some(plan) = row.gemini_plan {
                let _ = db::save_subscription(
                    conn,
                    &account_id,
                    &SubscriptionEntry {
                        id: String::new(),
                        account_id: account_id.clone(),
                        plan,
                        custom_plan_name: None,
                        status: "未记录".to_string(),
                        source: "自行订阅".to_string(),
                        start_date: None,
                        end_date: None,
                        next_billing_date: None,
                        auto_renewal: "未记录".to_string(),
                        cost: None,
                        currency: Some("USD".to_string()),
                        notes: None,
                        is_current: true,
                    },
                );
            }

            success += 1;
        }

        Ok(StructuredImportResult {
            success_count: success,
            skipped_count: skipped,
            error_count: errors,
            messages,
        })
    })
}

#[tauri::command]
pub fn export_encrypted_backup(
    state: State<Arc<AppState>>,
    destination_path: String,
    password: String,
) -> Result<bool, String> {
    with_db(&state, |_conn| {
        // Read the SQLite database file
        let db_bytes = fs::read(&state.db_path)
            .map_err(|e| format!("Failed to read database file for backup: {}", e))?;

        // Encrypt payload with AES-256-GCM using backup password
        let encrypted_pkg = encrypt_backup_payload(&db_bytes, &password)?;

        fs::write(&destination_path, encrypted_pkg)
            .map_err(|e| format!("Failed to write encrypted backup file: {}", e))?;

        Ok(true)
    })
}

#[tauri::command]
pub fn restore_encrypted_backup(
    state: State<Arc<AppState>>,
    backup_path: String,
    password: String,
) -> Result<bool, String> {
    let backup_bytes = fs::read(&backup_path)
        .map_err(|e| format!("Failed to read backup file: {}", e))?;

    // Decrypt database bytes using provided password
    let decrypted_db = decrypt_backup_payload(&backup_bytes, &password)?;

    // Create a safety backup of existing db if exists
    if state.db_path.exists() {
        let backup_snapshot = state.db_path.with_extension(format!(
            "pre_restore_{}.bak",
            chrono::Local::now().format("%Y%m%d_%H%M%S")
        ));
        let _ = fs::copy(&state.db_path, backup_snapshot);
    }

    // Force lock and close current connection
    state.force_lock();

    // Write decrypted database to vault.db
    fs::write(&state.db_path, decrypted_db)
        .map_err(|e| format!("Failed to write restored database: {}", e))?;

    // Verify restored database can be opened
    // Note: The restored DB has its original master password.
    // We update meta with the restore password so subsequent unlocks work seamlessly.
    let salt = crypto::generate_salt();
    let key = crypto::derive_key(&password, &salt)?;

    let conn = db::open_encrypted_db(&state.db_path, &key)
        .map_err(|_| "备份文件已解密，但数据库内部凭据与当前密码不一致。".to_string())?;
    db::init_tables(&conn)?;

    let meta = VaultMeta {
        schema_version: crypto::SCHEMA_VERSION,
        salt,
        argon2_params: "m=65536,t=3,p=2".to_string(),
        created_at: chrono::Local::now().to_rfc3339(),
        updated_at: chrono::Local::now().to_rfc3339(),
    };
    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize restored meta: {}", e))?;
    let _ = fs::write(&state.meta_path, meta_json);

    *state.db_conn.lock() = Some(conn);
    *state.master_key.lock() = Some(key);
    state.is_unlocked.store(true, Ordering::SeqCst);
    state.touch_activity();

    Ok(true)
}

#[tauri::command]
pub fn get_app_settings(state: State<Arc<AppState>>) -> Result<AppSettings, String> {
    with_db(&state, |conn| db::get_app_settings(conn))
}

#[tauri::command]
pub fn save_app_settings(
    state: State<Arc<AppState>>,
    settings: AppSettings,
) -> Result<bool, String> {
    with_db(&state, |conn| {
        db::save_app_settings(conn, &settings)?;
        *state.auto_lock_minutes.lock() = settings.auto_lock_minutes;
        Ok(true)
    })
}

#[tauri::command]
pub fn seed_mock_data(state: State<Arc<AppState>>) -> Result<bool, String> {
    with_db_mut(&state, |conn| {
        db::seed_mock_data(conn)?;
        Ok(true)
    })
}

#[tauri::command]
pub fn open_url(url: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::path::PathBuf;
        use std::process::Command;
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // 1. Prioritize Google Chrome (target for Google Account & user's desired default browser)
        let mut chrome_candidates = Vec::new();

        if let Ok(prog_files) = std::env::var("ProgramFiles") {
            chrome_candidates.push(PathBuf::from(&prog_files).join(r"Google\Chrome\Application\chrome.exe"));
        }
        if let Ok(prog_files_x86) = std::env::var("ProgramFiles(x86)") {
            chrome_candidates.push(PathBuf::from(&prog_files_x86).join(r"Google\Chrome\Application\chrome.exe"));
        }
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            chrome_candidates.push(PathBuf::from(&local_app_data).join(r"Google\Chrome\Application\chrome.exe"));
        }

        // Query registry App Paths for Chrome if not in standard locations
        for hive in &["HKLM", "HKCU"] {
            if let Ok(output) = Command::new("reg")
                .args(["query", &format!(r"{}\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe", hive), "/ve"])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
            {
                if output.status.success() {
                    let text = String::from_utf8_lossy(&output.stdout);
                    for line in text.lines() {
                        if line.contains("REG_SZ") {
                            if let Some(pos) = line.find("REG_SZ") {
                                let path = line[pos + 6..].trim().trim_matches('"');
                                if !path.is_empty() {
                                    chrome_candidates.push(PathBuf::from(path));
                                }
                            }
                        }
                    }
                }
            }
        }

        for candidate in &chrome_candidates {
            if candidate.is_file() {
                if Command::new(candidate).arg(&url).spawn().is_ok() {
                    return Ok(true);
                }
            }
        }

        // 2. If Chrome is not found, launch the true default browser from UserChoice (bypassing Lenovo UserChoiceLatest hijacking)
        let ps_cmd = format!(
            "$p = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice' -ErrorAction SilentlyContinue).Progid; if ($p) {{ $c = (Get-ItemProperty \"HKCR:\\$p\\shell\\open\\command\" -ErrorAction SilentlyContinue).'(default)'; if ($c) {{ $exe = ($c -replace '(?i)\\s*(--single-argument|%1|%\\*).*$','').Trim('\" '); if (Test-Path $exe) {{ Start-Process $exe -ArgumentList '{}'; exit 0 }} }} }}; Start-Process '{}'",
            url.replace("'", "''"),
            url.replace("'", "''")
        );

        if let Ok(status) = Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_cmd])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
        {
            if status.success() {
                return Ok(true);
            }
        }

        // 3. Fallback: cmd /C start "" "<url>"
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(true)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn get_account_chrome_profile(
    state: State<Arc<AppState>>,
    account_id: String,
) -> Result<Option<ChromeProfileBinding>, String> {
    with_db(&state, |conn| db::get_account_chrome_profile(conn, &account_id))
}

#[tauri::command]
pub fn save_account_chrome_profile(
    state: State<Arc<AppState>>,
    account_id: String,
    binding: Option<ChromeProfileBinding>,
) -> Result<bool, String> {
    with_db(&state, |conn| {
        // Check the account before touching the explicitly provided filesystem paths.
        db::get_account_chrome_profile(conn, &account_id)?;
        let validated = binding.map(crate::chrome::validate_binding).transpose()?;
        db::save_account_chrome_profile(conn, &account_id, validated.as_ref())?;
        Ok(true)
    })
}

#[tauri::command]
pub fn open_account_chrome(
    state: State<Arc<AppState>>,
    account_id: String,
    url: Option<String>,
) -> Result<bool, String> {
    with_db(&state, |conn| {
        let binding = db::get_account_chrome_profile(conn, &account_id)?
            .ok_or_else(|| "此账号尚未绑定 Chrome 配置，请先绑定。".to_string())?;
        crate::chrome::open_profile(&binding, url.as_deref())?;
        Ok(true)
    })
}

#[tauri::command]
pub fn auto_detect_chrome_profile(account_email: Option<String>) -> Result<ChromeProfileBinding, String> {
    crate::chrome::auto_detect_profile(account_email.as_deref())
}

#[tauri::command]
pub fn get_active_browser_profile() -> Result<DetectedBrowserProfile, String> {
    crate::chrome::detect_active_browser_profile()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapedSecurityData {
    pub two_factor_status: Option<String>,
    pub two_factor_phone: Option<String>,
    pub two_factor_methods: Option<Vec<String>>,
    pub skip_password_status: Option<String>,
    pub totp_status: Option<String>,
    pub totp_added_at: Option<String>,
    pub has_recovery_phone: Option<String>,
    pub recovery_phone: Option<String>,
    pub recovery_phone_verified: Option<String>,
    pub has_recovery_email: Option<String>,
    pub recovery_email: Option<String>,
    pub recovery_email_verified: Option<String>,
    pub backup_codes_status: Option<String>,
    pub backup_codes_remaining: Option<i32>,
    pub membership_status: Option<String>,
    pub membership_plan: Option<String>,
    pub membership_start_date: Option<String>,
    pub raw_source: Option<String>,
    pub extracted_at: Option<String>,
}

#[tauri::command]
pub fn get_synced_security_data() -> Result<Option<ScrapedSecurityData>, String> {
    Ok(crate::sync_server::get_latest_synced())
}

#[tauri::command]
pub fn clear_synced_security_data() -> Result<bool, String> {
    crate::sync_server::clear_latest_synced();
    Ok(true)
}

#[tauri::command]
pub fn crawl_account_security(
    state: State<Arc<AppState>>,
    account_id: String,
) -> Result<ScrapedSecurityData, String> {
    crate::sync_server::clear_latest_synced();
    let res = with_db(&state, |conn| {
        let binding = db::get_account_chrome_profile(conn, &account_id)?
            .ok_or_else(|| "此账号尚未设置 Chrome 绑定，请先配置个人资料路径。".to_string())?;
        crate::chrome::crawl_security_info(&binding)
    });
    // Ensure memory cache is cleared so other accounts never read stale data
    crate::sync_server::clear_latest_synced();
    res
}
