use crate::crypto::key_to_hex;
use crate::models::*;
use chrono::Local;
use rusqlite::{params, Connection, OptionalExtension, Result};
use std::path::Path;
use uuid::Uuid;

pub fn open_encrypted_db<P: AsRef<Path>>(path: P, key_bytes: &[u8]) -> Result<Connection, String> {
    let conn = Connection::open(path.as_ref())
        .map_err(|e| format!("Failed to open database file: {}", e))?;

    let hex_key = key_to_hex(key_bytes);
    let pragma_key_stmt = format!("PRAGMA key = \"x'{}'\";", hex_key);
    conn.execute_batch(&pragma_key_stmt)
        .map_err(|e| format!("Failed to set SQLCipher key: {}", e))?;

    // Verify key by reading sqlite_master
    let check: Result<i64, rusqlite::Error> = conn.query_row(
        "SELECT count(*) FROM sqlite_master;",
        [],
        |row| row.get(0),
    );

    match check {
        Ok(_) => Ok(conn),
        Err(e) => Err(format!("Database unlock failed (invalid key or not encrypted DB): {}", e)),
    }
}

pub fn init_tables(conn: &Connection) -> Result<(), String> {
    let schema = r#"
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS vault_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT,
        purpose TEXT,
        tags TEXT DEFAULT '[]',
        is_favorite INTEGER DEFAULT 0,
        status TEXT DEFAULT '未记录',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_verified_at TEXT,
        data_source TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_info (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        has_password INTEGER DEFAULT 0,
        password_enc TEXT,
        password_updated_at TEXT,
        two_factor_status TEXT DEFAULT '未记录',
        two_factor_methods TEXT DEFAULT '[]',
        skip_password_status TEXT DEFAULT '未记录',
        totp_status TEXT DEFAULT '未记录',
        totp_secret TEXT,
        totp_added_at TEXT,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recovery_info (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        has_recovery_email TEXT DEFAULT '未记录',
        recovery_email TEXT,
        recovery_email_verified TEXT DEFAULT '未记录',
        has_recovery_phone TEXT DEFAULT '未记录',
        recovery_phone TEXT,
        recovery_phone_verified TEXT DEFAULT '未记录',
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_code_batches (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        batch_number INTEGER DEFAULT 1,
        generation_date TEXT,
        created_at TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        source_note TEXT
    );

    CREATE TABLE IF NOT EXISTS backup_code_entries (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL REFERENCES backup_code_batches(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        sequence_no INTEGER NOT NULL,
        is_used INTEGER DEFAULT 0,
        used_at TEXT,
        is_revoked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS security_keys (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category TEXT DEFAULT '通行密钥',
        display_name TEXT NOT NULL,
        provider TEXT DEFAULT 'Google 密码管理工具',
        device_name TEXT,
        device_model TEXT,
        storage_location TEXT,
        created_at TEXT,
        last_used_desc TEXT DEFAULT '未记录',
        creation_type TEXT DEFAULT '未记录',
        status TEXT DEFAULT '正常',
        data_source TEXT,
        observation_time TEXT,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        plan TEXT DEFAULT '未记录',
        custom_plan_name TEXT,
        status TEXT DEFAULT '未记录',
        source TEXT DEFAULT '自行订阅',
        start_date TEXT,
        end_date TEXT,
        next_billing_date TEXT,
        auto_renewal TEXT DEFAULT '未记录',
        cost TEXT,
        currency TEXT DEFAULT 'USD',
        notes TEXT,
        is_current INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        field_name TEXT NOT NULL,
        field_group TEXT,
        field_type TEXT DEFAULT 'text',
        field_value TEXT,
        sort_order INTEGER DEFAULT 0,
        is_sensitive INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        settings_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS account_browser_profiles (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        executable_path TEXT NOT NULL,
        profile_path TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    "#;

    conn.execute_batch(schema)
        .map_err(|e| format!("Failed to initialize schema: {}", e))?;

    // Set schema version
    let _ = conn.execute(
        "INSERT OR IGNORE INTO vault_meta (key, value) VALUES ('schema_version', '1');",
        [],
    );

    // Migration: ensure totp columns exist in auth_info
    let _ = conn.execute("ALTER TABLE auth_info ADD COLUMN totp_status TEXT DEFAULT '未记录'", []);
    let _ = conn.execute("ALTER TABLE auth_info ADD COLUMN totp_secret TEXT", []);
    let _ = conn.execute("ALTER TABLE auth_info ADD COLUMN totp_added_at TEXT", []);
    let _ = conn.execute("ALTER TABLE auth_info ADD COLUMN backup_codes_status TEXT DEFAULT '未记录'", []);
    let _ = conn.execute("ALTER TABLE auth_info ADD COLUMN backup_codes_count INTEGER", []);

    Ok(())
}

pub fn get_accounts_summary(conn: &Connection) -> Result<Vec<AccountSummary>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT 
                a.id, a.email, a.display_name, a.purpose, a.tags, a.is_favorite, a.status,
                COALESCE(auth.two_factor_status, '未记录') as two_factor_status,
                a.last_verified_at, a.data_source, a.updated_at,
                (SELECT plan FROM subscriptions WHERE account_id = a.id AND is_current = 1 LIMIT 1) as sub_plan,
                (SELECT status FROM subscriptions WHERE account_id = a.id AND is_current = 1 LIMIT 1) as sub_status,
                (
                    SELECT COUNT(*) FROM backup_code_entries e 
                    JOIN backup_code_batches b ON e.batch_id = b.id 
                    WHERE b.account_id = a.id AND b.is_active = 1 AND e.is_used = 0 AND e.is_revoked = 0
                ) as unused_codes,
                (
                    SELECT COUNT(*) FROM backup_code_entries e 
                    JOIN backup_code_batches b ON e.batch_id = b.id 
                    WHERE b.account_id = a.id AND b.is_active = 1
                ) as total_codes,
                COALESCE(auth.backup_codes_count, 0) as cloud_backup_count
            FROM accounts a
            LEFT JOIN auth_info auth ON a.id = auth.account_id
            ORDER BY a.is_favorite DESC, a.email ASC
            "#,
        )
        .map_err(|e| format!("Query prepare error: {}", e))?;

    let account_iter = stmt
        .query_map([], |row| {
            let tags_str: String = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            let is_fav: i32 = row.get(5)?;

            let sub_plan: Option<String> = row.get(11)?;
            let sub_status: Option<String> = row.get(12)?;

            let unused_codes: i64 = row.get(13)?;
            let total_codes: i64 = row.get(14)?;
            let cloud_codes: i64 = row.get(15).unwrap_or(0);
            let final_remaining = if total_codes > 0 { unused_codes } else { cloud_codes };
            let final_total = if total_codes > 0 { total_codes } else { cloud_codes };

            Ok(AccountSummary {
                id: row.get(0)?,
                email: row.get(1)?,
                display_name: row.get(2)?,
                purpose: row.get(3)?,
                tags,
                is_favorite: is_fav == 1,
                status: row.get(6)?,
                two_factor_status: row.get(7)?,
                last_verified_at: row.get(8)?,
                data_source: row.get(9)?,
                updated_at: row.get(10)?,
                gemini_plan: sub_plan.unwrap_or_else(|| "未记录".to_string()),
                gemini_status: sub_status.unwrap_or_else(|| "未记录".to_string()),
                backup_codes_remaining: final_remaining,
                backup_codes_total: final_total,
            })
        })
        .map_err(|e| format!("Query error: {}", e))?;

    let mut list = Vec::new();
    for acc in account_iter {
        list.push(acc.map_err(|e| format!("Row map error: {}", e))?);
    }
    Ok(list)
}

pub fn get_account_detail(conn: &Connection, account_id: &str) -> Result<AccountDetail, String> {
    // 1. Basic Account row
    let acc_row = conn.query_row(
        "SELECT id, email, display_name, purpose, tags, is_favorite, status, notes, created_at, updated_at, last_verified_at, data_source FROM accounts WHERE id = ?1",
        params![account_id],
        |row| {
            let tags_str: String = row.get(4)?;
            let is_fav: i32 = row.get(5)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                tags_str,
                is_fav == 1,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, Option<String>>(10)?,
                row.get::<_, Option<String>>(11)?,
            ))
        },
    ).map_err(|e| format!("Account not found: {}", e))?;

    let tags: Vec<String> = serde_json::from_str(&acc_row.4).unwrap_or_default();

    // 2. Auth Info
    let auth = match conn.query_row(
        "SELECT has_password, password_enc, password_updated_at, two_factor_status, two_factor_methods, skip_password_status, updated_at, totp_status, totp_secret, totp_added_at, backup_codes_status, backup_codes_count FROM auth_info WHERE account_id = ?1",
        params![account_id],
        |row| {
            let has_pw: i32 = row.get(0)?;
            let methods_str: String = row.get(4)?;
            let methods: Vec<String> = serde_json::from_str(&methods_str).unwrap_or_default();
            let totp_status: Option<String> = row.get(7).unwrap_or(None);
            let totp_secret: Option<String> = row.get(8).unwrap_or(None);
            let totp_added_at: Option<String> = row.get(9).unwrap_or(None);
            let backup_codes_status: Option<String> = row.get(10).unwrap_or(None);
            let backup_codes_count: Option<i64> = row.get(11).unwrap_or(None);
            Ok(AuthInfo {
                has_password: has_pw == 1,
                password: row.get(1)?,
                password_updated_at: row.get(2)?,
                two_factor_status: row.get(3)?,
                two_factor_methods: methods,
                skip_password_status: row.get(5)?,
                totp_status,
                totp_secret,
                totp_added_at,
                backup_codes_status,
                backup_codes_count,
                updated_at: row.get(6)?,
            })
        },
    ) {
        Ok(a) => a,
        Err(_) => AuthInfo {
            has_password: false,
            password: None,
            password_updated_at: None,
            two_factor_status: "未记录".to_string(),
            two_factor_methods: vec![],
            skip_password_status: "未记录".to_string(),
            totp_status: Some("未记录".to_string()),
            totp_secret: None,
            totp_added_at: None,
            backup_codes_status: Some("未记录".to_string()),
            backup_codes_count: None,
            updated_at: acc_row.9.clone(),
        },
    };

    // 3. Recovery Info
    let recovery = match conn.query_row(
        "SELECT has_recovery_email, recovery_email, recovery_email_verified, has_recovery_phone, recovery_phone, recovery_phone_verified, updated_at FROM recovery_info WHERE account_id = ?1",
        params![account_id],
        |row| {
            Ok(RecoveryInfo {
                has_recovery_email: row.get(0)?,
                recovery_email: row.get(1)?,
                recovery_email_verified: row.get(2)?,
                has_recovery_phone: row.get(3)?,
                recovery_phone: row.get(4)?,
                recovery_phone_verified: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    ) {
        Ok(r) => r,
        Err(_) => RecoveryInfo {
            has_recovery_email: "未记录".to_string(),
            recovery_email: None,
            recovery_email_verified: "未记录".to_string(),
            has_recovery_phone: "未记录".to_string(),
            recovery_phone: None,
            recovery_phone_verified: "未记录".to_string(),
            updated_at: acc_row.9.clone(),
        },
    };

    // 4. Backup code batches & entries
    let mut batches = Vec::new();
    {
        let mut b_stmt = conn
            .prepare("SELECT id, account_id, batch_number, generation_date, created_at, is_active, source_note FROM backup_code_batches WHERE account_id = ?1 ORDER BY batch_number DESC")
            .map_err(|e| format!("Batch prepare error: {}", e))?;

        let b_rows = b_stmt
            .query_map(params![account_id], |row| {
                let is_act: i32 = row.get(5)?;
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i32>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    is_act == 1,
                    row.get::<_, Option<String>>(6)?,
                ))
            })
            .map_err(|e| format!("Batch query error: {}", e))?;

        for b in b_rows {
            let (b_id, b_acc, b_num, b_gen, b_created, b_act, b_note) =
                b.map_err(|e| format!("Batch row error: {}", e))?;

            let mut entries = Vec::new();
            let mut e_stmt = conn
                .prepare("SELECT id, batch_id, account_id, code, sequence_no, is_used, used_at, is_revoked FROM backup_code_entries WHERE batch_id = ?1 ORDER BY sequence_no ASC")
                .map_err(|e| format!("Entries prepare error: {}", e))?;

            let e_rows = e_stmt
                .query_map(params![b_id], |erow| {
                    let is_u: i32 = erow.get(5)?;
                    let is_r: i32 = erow.get(7)?;
                    Ok(BackupCodeEntry {
                        id: erow.get(0)?,
                        batch_id: erow.get(1)?,
                        account_id: erow.get(2)?,
                        code: erow.get(3)?,
                        sequence_no: erow.get(4)?,
                        is_used: is_u == 1,
                        used_at: erow.get(6)?,
                        is_revoked: is_r == 1,
                    })
                })
                .map_err(|e| format!("Entries query error: {}", e))?;

            let mut total = 0;
            let mut unused = 0;
            let mut used = 0;
            let mut revoked = 0;

            for e in e_rows {
                let entry = e.map_err(|e| format!("Entry row error: {}", e))?;
                total += 1;
                if entry.is_revoked {
                    revoked += 1;
                } else if entry.is_used {
                    used += 1;
                } else {
                    unused += 1;
                }
                entries.push(entry);
            }

            batches.push(BackupCodeBatch {
                id: b_id,
                account_id: b_acc,
                batch_number: b_num,
                generation_date: b_gen,
                created_at: b_created,
                is_active: b_act,
                source_note: b_note,
                entries,
                total_count: total,
                unused_count: unused,
                used_count: used,
                revoked_count: revoked,
            });
        }
    }

    // 5. Security keys
    let mut security_keys = Vec::new();
    {
        let mut sk_stmt = conn.prepare(
            "SELECT id, account_id, category, display_name, provider, device_name, device_model, storage_location, created_at, last_used_desc, creation_type, status, data_source, observation_time, notes FROM security_keys WHERE account_id = ?1 ORDER BY created_at DESC"
        ).map_err(|e| format!("Security key prepare error: {}", e))?;

        let sk_rows = sk_stmt.query_map(params![account_id], |row| {
            Ok(SecurityKeyEntry {
                id: row.get(0)?,
                account_id: row.get(1)?,
                category: row.get(2)?,
                display_name: row.get(3)?,
                provider: row.get(4)?,
                device_name: row.get(5)?,
                device_model: row.get(6)?,
                storage_location: row.get(7)?,
                created_at: row.get(8)?,
                last_used_desc: row.get(9)?,
                creation_type: row.get(10)?,
                status: row.get(11)?,
                data_source: row.get(12)?,
                observation_time: row.get(13)?,
                notes: row.get(14)?,
            })
        }).map_err(|e| format!("Security key query error: {}", e))?;

        for sk in sk_rows {
            security_keys.push(sk.map_err(|e| format!("Security key row error: {}", e))?);
        }
    }

    // 6. Subscriptions
    let mut subscriptions = Vec::new();
    {
        let mut sub_stmt = conn.prepare(
            "SELECT id, account_id, plan, custom_plan_name, status, source, start_date, end_date, next_billing_date, auto_renewal, cost, currency, notes, is_current FROM subscriptions WHERE account_id = ?1 ORDER BY is_current DESC, start_date DESC"
        ).map_err(|e| format!("Subscription prepare error: {}", e))?;

        let sub_rows = sub_stmt.query_map(params![account_id], |row| {
            let is_c: i32 = row.get(13)?;
            Ok(SubscriptionEntry {
                id: row.get(0)?,
                account_id: row.get(1)?,
                plan: row.get(2)?,
                custom_plan_name: row.get(3)?,
                status: row.get(4)?,
                source: row.get(5)?,
                start_date: row.get(6)?,
                end_date: row.get(7)?,
                next_billing_date: row.get(8)?,
                auto_renewal: row.get(9)?,
                cost: row.get(10)?,
                currency: row.get(11)?,
                notes: row.get(12)?,
                is_current: is_c == 1,
            })
        }).map_err(|e| format!("Subscription query error: {}", e))?;

        for sub in sub_rows {
            subscriptions.push(sub.map_err(|e| format!("Subscription row error: {}", e))?);
        }
    }

    // 7. Custom Fields
    let mut custom_fields = Vec::new();
    {
        let mut cf_stmt = conn.prepare(
            "SELECT id, account_id, field_name, field_group, field_type, field_value, sort_order, is_sensitive FROM custom_fields WHERE account_id = ?1 ORDER BY sort_order ASC"
        ).map_err(|e| format!("Custom fields prepare error: {}", e))?;

        let cf_rows = cf_stmt.query_map(params![account_id], |row| {
            let is_s: i32 = row.get(7)?;
            Ok(CustomFieldEntry {
                id: row.get(0)?,
                account_id: row.get(1)?,
                field_name: row.get(2)?,
                field_group: row.get(3)?,
                field_type: row.get(4)?,
                field_value: row.get(5)?,
                sort_order: row.get(6)?,
                is_sensitive: is_s == 1,
            })
        }).map_err(|e| format!("Custom field query error: {}", e))?;

        for cf in cf_rows {
            custom_fields.push(cf.map_err(|e| format!("Custom field row error: {}", e))?);
        }
    }

    Ok(AccountDetail {
        id: acc_row.0,
        email: acc_row.1,
        display_name: acc_row.2,
        purpose: acc_row.3,
        tags,
        is_favorite: acc_row.5,
        status: acc_row.6,
        notes: acc_row.7,
        created_at: acc_row.8,
        updated_at: acc_row.9,
        last_verified_at: acc_row.10,
        data_source: acc_row.11,
        auth,
        recovery,
        backup_code_batches: batches,
        security_keys,
        subscriptions,
        custom_fields,
    })
}

pub fn create_account(
    conn: &Connection,
    email: &str,
    display_name: Option<&str>,
) -> Result<String, String> {
    let email_trimmed = email.trim().to_lowercase();
    if email_trimmed.is_empty() {
        return Err("Email cannot be empty".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO accounts (id, email, display_name, purpose, tags, is_favorite, status, created_at, updated_at) VALUES (?1, ?2, ?3, '未记录', '[]', 0, '未记录', ?4, ?4)",
        params![id, email_trimmed, display_name, now],
    ).map_err(|e| format!("Failed to create account (email might already exist): {}", e))?;

    // Create empty auth_info & recovery_info
    let _ = conn.execute(
        "INSERT INTO auth_info (account_id, has_password, two_factor_status, skip_password_status, updated_at) VALUES (?1, 0, '未记录', '未记录', ?2)",
        params![id, now],
    );

    let _ = conn.execute(
        "INSERT INTO recovery_info (account_id, has_recovery_email, recovery_email_verified, has_recovery_phone, recovery_phone_verified, updated_at) VALUES (?1, '未记录', '未记录', '未记录', '未记录', ?2)",
        params![id, now],
    );

    Ok(id)
}

pub fn update_basic_info(
    conn: &Connection,
    account_id: &str,
    email: &str,
    display_name: Option<&str>,
    purpose: Option<&str>,
    tags: &[String],
    is_favorite: bool,
    status: &str,
    notes: Option<&str>,
    last_verified_at: Option<&str>,
    data_source: Option<&str>,
) -> Result<(), String> {
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let tags_json = serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        r#"UPDATE accounts SET 
            email = ?1, display_name = ?2, purpose = ?3, tags = ?4, 
            is_favorite = ?5, status = ?6, notes = ?7, last_verified_at = ?8, 
            data_source = ?9, updated_at = ?10
           WHERE id = ?11"#,
        params![
            email.trim().to_lowercase(),
            display_name,
            purpose,
            tags_json,
            if is_favorite { 1 } else { 0 },
            status,
            notes,
            last_verified_at,
            data_source,
            now,
            account_id,
        ],
    )
    .map_err(|e| format!("Failed to update basic info: {}", e))?;

    Ok(())
}

pub fn update_auth_info(
    conn: &Connection,
    account_id: &str,
    has_password: bool,
    password: Option<&str>,
    two_factor_status: &str,
    two_factor_methods: &[String],
    skip_password_status: &str,
    totp_status: Option<&str>,
    totp_secret: Option<&str>,
    totp_added_at: Option<&str>,
    backup_codes_status: Option<&str>,
    backup_codes_count: Option<i64>,
) -> Result<(), String> {
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let methods_json = serde_json::to_string(two_factor_methods).unwrap_or_else(|_| "[]".to_string());

    let password_updated_at = if password.is_some() {
        Some(now.clone())
    } else {
        None
    };

    conn.execute(
        r#"INSERT INTO auth_info (account_id, has_password, password_enc, password_updated_at, two_factor_status, two_factor_methods, skip_password_status, totp_status, totp_secret, totp_added_at, backup_codes_status, backup_codes_count, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
           ON CONFLICT(account_id) DO UPDATE SET
               has_password = excluded.has_password,
               password_enc = CASE WHEN excluded.password_enc IS NOT NULL THEN excluded.password_enc ELSE auth_info.password_enc END,
               password_updated_at = CASE WHEN excluded.password_updated_at IS NOT NULL THEN excluded.password_updated_at ELSE auth_info.password_updated_at END,
               two_factor_status = excluded.two_factor_status,
               two_factor_methods = excluded.two_factor_methods,
               skip_password_status = excluded.skip_password_status,
               totp_status = excluded.totp_status,
               totp_secret = excluded.totp_secret,
               totp_added_at = CASE WHEN excluded.totp_added_at IS NOT NULL THEN excluded.totp_added_at ELSE auth_info.totp_added_at END,
               backup_codes_status = CASE WHEN excluded.backup_codes_status IS NOT NULL THEN excluded.backup_codes_status ELSE auth_info.backup_codes_status END,
               backup_codes_count = CASE WHEN excluded.backup_codes_count IS NOT NULL THEN excluded.backup_codes_count ELSE auth_info.backup_codes_count END,
               updated_at = excluded.updated_at
        "#,
        params![
            account_id,
            if has_password { 1 } else { 0 },
            password,
            password_updated_at,
            two_factor_status,
            methods_json,
            skip_password_status,
            totp_status.unwrap_or("未记录"),
            totp_secret,
            totp_added_at,
            backup_codes_status.unwrap_or("未记录"),
            backup_codes_count,
            now,
        ],
    ).map_err(|e| format!("Failed to update auth info: {}", e))?;

    let _ = conn.execute("UPDATE accounts SET updated_at = ?1 WHERE id = ?2", params![now, account_id]);
    Ok(())
}

pub fn update_recovery_info(
    conn: &Connection,
    account_id: &str,
    has_recovery_email: &str,
    recovery_email: Option<&str>,
    recovery_email_verified: &str,
    has_recovery_phone: &str,
    recovery_phone: Option<&str>,
    recovery_phone_verified: &str,
) -> Result<(), String> {
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        r#"INSERT INTO recovery_info (account_id, has_recovery_email, recovery_email, recovery_email_verified, has_recovery_phone, recovery_phone, recovery_phone_verified, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
           ON CONFLICT(account_id) DO UPDATE SET
               has_recovery_email = excluded.has_recovery_email,
               recovery_email = excluded.recovery_email,
               recovery_email_verified = excluded.recovery_email_verified,
               has_recovery_phone = excluded.has_recovery_phone,
               recovery_phone = excluded.recovery_phone,
               recovery_phone_verified = excluded.recovery_phone_verified,
               updated_at = excluded.updated_at
        "#,
        params![
            account_id,
            has_recovery_email,
            recovery_email,
            recovery_email_verified,
            has_recovery_phone,
            recovery_phone,
            recovery_phone_verified,
            now,
        ],
    ).map_err(|e| format!("Failed to update recovery info: {}", e))?;

    let _ = conn.execute("UPDATE accounts SET updated_at = ?1 WHERE id = ?2", params![now, account_id]);
    Ok(())
}

pub fn save_subscription(
    conn: &Connection,
    account_id: &str,
    sub: &SubscriptionEntry,
) -> Result<String, String> {
    let sub_id = if sub.id.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        sub.id.clone()
    };

    if sub.is_current {
        let _ = conn.execute(
            "UPDATE subscriptions SET is_current = 0 WHERE account_id = ?1",
            params![account_id],
        );
    }

    conn.execute(
        r#"INSERT INTO subscriptions (id, account_id, plan, custom_plan_name, status, source, start_date, end_date, next_billing_date, auto_renewal, cost, currency, notes, is_current)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
           ON CONFLICT(id) DO UPDATE SET
               plan = excluded.plan,
               custom_plan_name = excluded.custom_plan_name,
               status = excluded.status,
               source = excluded.source,
               start_date = excluded.start_date,
               end_date = excluded.end_date,
               next_billing_date = excluded.next_billing_date,
               auto_renewal = excluded.auto_renewal,
               cost = excluded.cost,
               currency = excluded.currency,
               notes = excluded.notes,
               is_current = excluded.is_current
        "#,
        params![
            sub_id,
            account_id,
            sub.plan,
            sub.custom_plan_name,
            sub.status,
            sub.source,
            sub.start_date,
            sub.end_date,
            sub.next_billing_date,
            sub.auto_renewal,
            sub.cost,
            sub.currency,
            sub.notes,
            if sub.is_current { 1 } else { 0 },
        ],
    ).map_err(|e| format!("Failed to save subscription: {}", e))?;

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let _ = conn.execute("UPDATE accounts SET updated_at = ?1 WHERE id = ?2", params![now, account_id]);
    Ok(sub_id)
}

pub fn save_security_key(
    conn: &Connection,
    account_id: &str,
    card: &SecurityKeyEntry,
) -> Result<String, String> {
    let card_id = if card.id.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        card.id.clone()
    };

    conn.execute(
        r#"INSERT INTO security_keys (id, account_id, category, display_name, provider, device_name, device_model, storage_location, created_at, last_used_desc, creation_type, status, data_source, observation_time, notes)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
           ON CONFLICT(id) DO UPDATE SET
               category = excluded.category,
               display_name = excluded.display_name,
               provider = excluded.provider,
               device_name = excluded.device_name,
               device_model = excluded.device_model,
               storage_location = excluded.storage_location,
               created_at = excluded.created_at,
               last_used_desc = excluded.last_used_desc,
               creation_type = excluded.creation_type,
               status = excluded.status,
               data_source = excluded.data_source,
               observation_time = excluded.observation_time,
               notes = excluded.notes
        "#,
        params![
            card_id,
            account_id,
            card.category,
            card.display_name,
            card.provider,
            card.device_name,
            card.device_model,
            card.storage_location,
            card.created_at,
            card.last_used_desc,
            card.creation_type,
            card.status,
            card.data_source,
            card.observation_time,
            card.notes,
        ],
    ).map_err(|e| format!("Failed to save security key: {}", e))?;

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let _ = conn.execute("UPDATE accounts SET updated_at = ?1 WHERE id = ?2", params![now, account_id]);
    Ok(card_id)
}

pub fn delete_security_key(conn: &Connection, card_id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM security_keys WHERE id = ?1", params![card_id])
        .map_err(|e| format!("Failed to delete security key: {}", e))?;
    Ok(())
}

pub fn add_backup_code_batch(
    conn: &mut Connection,
    account_id: &str,
    codes: &[String],
    generation_date: Option<&str>,
    source_note: Option<&str>,
    is_new_batch: bool,
) -> Result<String, String> {
    let tx = conn.transaction().map_err(|e| format!("Transaction error: {}", e))?;

    let current_max_batch: i32 = tx
        .query_row(
            "SELECT COALESCE(MAX(batch_number), 0) FROM backup_code_batches WHERE account_id = ?1",
            params![account_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let new_batch_num = current_max_batch + 1;
    let batch_id = Uuid::new_v4().to_string();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    if is_new_batch {
        tx.execute(
            "UPDATE backup_code_batches SET is_active = 0 WHERE account_id = ?1",
            params![account_id],
        )
        .map_err(|e| format!("Failed to deactivate previous batches: {}", e))?;
    }

    tx.execute(
        "INSERT INTO backup_code_batches (id, account_id, batch_number, generation_date, created_at, is_active, source_note) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)",
        params![batch_id, account_id, new_batch_num, generation_date, now, source_note],
    ).map_err(|e| format!("Failed to insert batch: {}", e))?;

    let mut seq = 1;
    for code in codes {
        let code_trimmed = code.trim();
        if code_trimmed.is_empty() {
            continue;
        }

        let entry_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO backup_code_entries (id, batch_id, account_id, code, sequence_no, is_used, is_revoked) VALUES (?1, ?2, ?3, ?4, ?5, 0, 0)",
            params![entry_id, batch_id, account_id, code_trimmed, seq],
        ).map_err(|e| format!("Failed to insert entry: {}", e))?;
        seq += 1;
    }

    tx.execute("UPDATE accounts SET updated_at = ?1 WHERE id = ?2", params![now, account_id])
        .map_err(|e| format!("Failed to update account time: {}", e))?;

    tx.commit().map_err(|e| format!("Commit error: {}", e))?;
    Ok(batch_id)
}

pub fn mark_backup_code_used(
    conn: &Connection,
    code_id: &str,
    is_used: bool,
) -> Result<(), String> {
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let used_at = if is_used { Some(now) } else { None };

    conn.execute(
        "UPDATE backup_code_entries SET is_used = ?1, used_at = ?2 WHERE id = ?3",
        params![if is_used { 1 } else { 0 }, used_at, code_id],
    )
    .map_err(|e| format!("Failed to update code state: {}", e))?;

    Ok(())
}

pub fn revoke_backup_code(
    conn: &Connection,
    code_id: &str,
    is_revoked: bool,
) -> Result<(), String> {
    conn.execute(
        "UPDATE backup_code_entries SET is_revoked = ?1 WHERE id = ?2",
        params![if is_revoked { 1 } else { 0 }, code_id],
    )
    .map_err(|e| format!("Failed to update code revoked state: {}", e))?;

    Ok(())
}

pub fn delete_account(conn: &Connection, account_id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM accounts WHERE id = ?1", params![account_id])
        .map_err(|e| format!("Failed to delete account: {}", e))?;
    Ok(())
}

pub fn get_app_settings(conn: &Connection) -> Result<AppSettings, String> {
    let res = conn.query_row(
        "SELECT settings_json FROM app_settings WHERE id = 1",
        [],
        |r| r.get::<_, String>(0),
    );

    match res {
        Ok(json_str) => serde_json::from_str(&json_str)
            .map_err(|e| format!("Failed to parse settings: {}", e)),
        Err(_) => Ok(AppSettings::default()),
    }
}

fn ensure_chrome_account_exists(conn: &Connection, account_id: &str) -> Result<(), String> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM accounts WHERE id = ?1)",
        params![account_id],
        |row| row.get(0),
    ).map_err(|e| format!("无法检查账号：{}", e))?;
    if !exists {
        return Err("账号不存在，请重新选择账号。".to_string());
    }
    Ok(())
}

pub fn get_account_chrome_profile(
    conn: &Connection,
    account_id: &str,
) -> Result<Option<ChromeProfileBinding>, String> {
    ensure_chrome_account_exists(conn, account_id)?;
    conn.query_row(
        "SELECT executable_path, profile_path FROM account_browser_profiles WHERE account_id = ?1",
        params![account_id],
        |row| Ok(ChromeProfileBinding {
            executable_path: row.get(0)?,
            profile_path: row.get(1)?,
        }),
    ).optional().map_err(|e| format!("无法读取 Chrome 配置绑定：{}", e))
}

pub fn save_account_chrome_profile(
    conn: &Connection,
    account_id: &str,
    binding: Option<&ChromeProfileBinding>,
) -> Result<(), String> {
    ensure_chrome_account_exists(conn, account_id)?;
    match binding {
        Some(binding) => {
            conn.execute(
                "INSERT INTO account_browser_profiles (account_id, executable_path, profile_path, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(account_id) DO UPDATE SET executable_path = excluded.executable_path,
                    profile_path = excluded.profile_path, updated_at = excluded.updated_at",
                params![account_id, binding.executable_path, binding.profile_path, Local::now().to_rfc3339()],
            ).map_err(|e| format!("无法保存 Chrome 配置绑定：{}", e))?;
        }
        None => {
            conn.execute("DELETE FROM account_browser_profiles WHERE account_id = ?1", params![account_id])
                .map_err(|e| format!("无法解除 Chrome 配置绑定：{}", e))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod chrome_profile_tests {
    use super::*;

    #[test]
    fn chrome_profile_binding_is_per_account_and_cascades_on_delete() {
        let conn = Connection::open_in_memory().unwrap();
        init_tables(&conn).unwrap();
        let first = create_account(&conn, "first@example.com", None).unwrap();
        let second = create_account(&conn, "second@example.com", None).unwrap();
        let binding = ChromeProfileBinding {
            executable_path: r"C:\Program Files\Google\Chrome\Application\chrome.exe".to_string(),
            profile_path: r"C:\Users\Fixture\AppData\Local\Google\Chrome\User Data\Profile 2".to_string(),
        };
        assert_eq!(get_account_chrome_profile(&conn, &first).unwrap(), None);
        save_account_chrome_profile(&conn, &first, Some(&binding)).unwrap();
        assert_eq!(get_account_chrome_profile(&conn, &first).unwrap(), Some(binding.clone()));
        assert_eq!(get_account_chrome_profile(&conn, &second).unwrap(), None);
        assert!(save_account_chrome_profile(&conn, "missing", Some(&binding)).is_err());
        assert!(get_account_chrome_profile(&conn, "missing").is_err());
        conn.execute("UPDATE accounts SET email = 'renamed@example.com' WHERE id = ?1", params![first]).unwrap();
        assert_eq!(get_account_chrome_profile(&conn, &first).unwrap(), Some(binding.clone()));
        let replacement = ChromeProfileBinding { profile_path: binding.profile_path.replace("Profile 2", "Default"), ..binding };
        save_account_chrome_profile(&conn, &first, Some(&replacement)).unwrap();
        assert_eq!(get_account_chrome_profile(&conn, &first).unwrap(), Some(replacement.clone()));
        save_account_chrome_profile(&conn, &first, None).unwrap();
        assert_eq!(get_account_chrome_profile(&conn, &first).unwrap(), None);
        save_account_chrome_profile(&conn, &first, Some(&replacement)).unwrap();
        delete_account(&conn, &first).unwrap();
        let remaining: i64 = conn.query_row("SELECT COUNT(*) FROM account_browser_profiles", [], |r| r.get(0)).unwrap();
        assert_eq!(remaining, 0);
        assert!(conn.execute("INSERT INTO account_browser_profiles VALUES ('missing', 'exe', 'profile', 'now')", []).is_err());
    }

    #[test]
    fn chrome_profile_schema_migration_is_additive_and_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        init_tables(&conn).unwrap();
        let account_id = create_account(&conn, "existing@example.com", Some("Existing account")).unwrap();
        conn.execute_batch("DROP TABLE account_browser_profiles;").unwrap();
        init_tables(&conn).unwrap();
        init_tables(&conn).unwrap();
        assert_eq!(get_account_detail(&conn, &account_id).unwrap().email, "existing@example.com");
        assert_eq!(get_account_chrome_profile(&conn, &account_id).unwrap(), None);
    }
}

pub fn save_app_settings(conn: &Connection, settings: &AppSettings) -> Result<(), String> {
    let json_str = serde_json::to_string(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    conn.execute(
        "INSERT INTO app_settings (id, settings_json) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json",
        params![json_str],
    ).map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

pub fn seed_mock_data(conn: &mut Connection) -> Result<(), String> {
    let existing_count: i64 = conn
        .query_row("SELECT count(*) FROM accounts", [], |r| r.get(0))
        .unwrap_or(0);

    if existing_count > 0 {
        return Ok(());
    }

    // Account 1: Primary Working Account
    let id1 = create_account(conn, "work.developer.google@example.com", Some("工作主账号 (示例)"))?;
    update_basic_info(
        conn,
        &id1,
        "work.developer.google@example.com",
        Some("工作主账号 (示例)"),
        Some("主力开发与日常协作"),
        &["工作".to_string(), "开发".to_string(), "主力".to_string()],
        true,
        "正常",
        Some("公司分配的 Google Workspace 账号，已开启安全密钥保护。"),
        Some("2026-10-18 14:30:00"),
        Some("人工核对"),
    )?;
    update_auth_info(
        conn,
        &id1,
        true,
        Some("FictionalPass#2026!Demo"),
        "开启",
        &["Google 提示".to_string(), "安全密钥".to_string()],
        "开启",
        Some("开启"),
        Some("JBSWY3DPEHPK3PXP"),
        None,
        Some("开启"),
        Some(10),
    )?;
    update_recovery_info(
        conn,
        &id1,
        "有",
        Some("recovery.work@example-corp.com"),
        "已验证",
        "有",
        Some("+86 13800138000"),
        "已验证",
    )?;

    // Add security keys for Account 1
    save_security_key(
        conn,
        &id1,
        &SecurityKeyEntry {
            id: String::new(),
            account_id: id1.clone(),
            category: "通行密钥".to_string(),
            display_name: "Google 密码管理工具".to_string(),
            provider: "Google 密码管理工具".to_string(),
            device_name: Some("Windows PC (开发机)".to_string()),
            device_model: Some("ThinkPad X1 Carbon".to_string()),
            storage_location: Some("本地安全芯片 (TPM)".to_string()),
            created_at: Some("2026-08-15 10:20:00".to_string()),
            last_used_desc: Some("5 小时前".to_string()),
            creation_type: "手动".to_string(),
            status: "正常".to_string(),
            data_source: Some("网页截图核对".to_string()),
            observation_time: Some("2026-10-20 08:00".to_string()),
            notes: Some("主力设备免密登录凭证".to_string()),
        },
    )?;
    save_security_key(
        conn,
        &id1,
        &SecurityKeyEntry {
            id: String::new(),
            account_id: id1.clone(),
            category: "安全密钥".to_string(),
            display_name: "YubiKey 5C NFC".to_string(),
            provider: "硬件安全密钥".to_string(),
            device_name: Some("黑色钥匙扣硬件密钥".to_string()),
            device_model: Some("Yubico YubiKey 5C".to_string()),
            storage_location: Some("随身钥匙扣".to_string()),
            created_at: Some("2026-03-01 09:00:00".to_string()),
            last_used_desc: Some("2 天前".to_string()),
            creation_type: "手动".to_string(),
            status: "正常".to_string(),
            data_source: Some("物理硬件记录".to_string()),
            observation_time: Some("2026-10-18 14:00".to_string()),
            notes: Some("高级两步验证物理硬件".to_string()),
        },
    )?;

    // Add backup codes batch for Account 1
    let codes1 = vec![
        "9738 3157".to_string(),
        "2717 5386".to_string(),
        "5288 6833".to_string(),
        "4328 7988".to_string(),
        "4620 4984".to_string(),
        "4240 3573".to_string(),
        "9582 9974".to_string(),
        "8729 2357".to_string(),
        "5617 6556".to_string(),
        "3522 2725".to_string(),
    ];
    let batch1_id = add_backup_code_batch(conn, &id1, &codes1, Some("2026年10月20日"), Some("初始化 Google 备用码文本导入 (示例)"), true)?;
    
    // Mark first code used
    let first_code_id: String = conn.query_row(
        "SELECT id FROM backup_code_entries WHERE batch_id = ?1 AND sequence_no = 1",
        params![batch1_id],
        |r| r.get(0),
    ).map_err(|e| format!("Failed to find first code: {}", e))?;
    mark_backup_code_used(conn, &first_code_id, true)?;

    // Add Gemini Subscription for Account 1
    save_subscription(
        conn,
        &id1,
        &SubscriptionEntry {
            id: String::new(),
            account_id: id1.clone(),
            plan: "AI Pro".to_string(),
            custom_plan_name: None,
            status: "有效".to_string(),
            source: "自行订阅".to_string(),
            start_date: Some("2026-01-15".to_string()),
            end_date: Some("2027-01-15".to_string()),
            next_billing_date: Some("2026-11-15".to_string()),
            auto_renewal: "开启".to_string(),
            cost: Some("19.99".to_string()),
            currency: Some("USD".to_string()),
            notes: Some("Google One AI Premium 2TB + Gemini Advanced".to_string()),
            is_current: true,
        },
    )?;

    // Account 2: Personal Google AI Account
    let id2 = create_account(conn, "personal.ai.tester@gmail.com", Some("个人备用 (示例)"))?;
    update_basic_info(
        conn,
        &id2,
        "personal.ai.tester@gmail.com",
        Some("个人备用 (示例)"),
        Some("Gemini API 与模型评测"),
        &["个人".to_string(), "Gemini".to_string()],
        false,
        "正常",
        Some("主要用于测试最新 Gemini 实验功能。"),
        Some("2026-10-10 11:00:00"),
        Some("人工录入"),
    )?;
    update_auth_info(
        conn,
        &id2,
        true,
        Some("P@ssw0rd_Gemini_2026!"),
        "开启",
        &["身份验证器".to_string()],
        "关闭",
        Some("未记录"),
        None,
        None,
        Some("未记录"),
        None,
    )?;
    update_recovery_info(
        conn,
        &id2,
        "有",
        Some("backup-personal@outlook.com"),
        "已验证",
        "无",
        None,
        "未记录",
    )?;

    // Add subscription for Account 2 (Trial)
    save_subscription(
        conn,
        &id2,
        &SubscriptionEntry {
            id: String::new(),
            account_id: id2.clone(),
            plan: "AI Ultra".to_string(),
            custom_plan_name: None,
            status: "试用".to_string(),
            source: "活动赠送".to_string(),
            start_date: Some("2026-10-01".to_string()),
            end_date: Some("2026-11-01".to_string()),
            next_billing_date: Some("2026-11-01".to_string()),
            auto_renewal: "关闭".to_string(),
            cost: Some("0.00".to_string()),
            currency: Some("USD".to_string()),
            notes: Some("30 天活动免费试用，到期后取消自动续费。".to_string()),
            is_current: true,
        },
    )?;

    // Account 3: Newly registered account (Needs completion / 待补充)
    let id3 = create_account(conn, "new.standby.2026@gmail.com", Some("待核验新号 (示例)"))?;
    update_basic_info(
        conn,
        &id3,
        "new.standby.2026@gmail.com",
        Some("待核验新号 (示例)"),
        Some("未记录"),
        &["待补充".to_string()],
        false,
        "待核验",
        Some("新注册账号，尚未补全找回方式与备用码。"),
        None,
        Some("快捷新建"),
    )?;

    Ok(())
}
