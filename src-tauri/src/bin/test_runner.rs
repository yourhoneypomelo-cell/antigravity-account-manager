use antigravity_account_manager_lib::crypto::{self, decrypt_backup_payload, encrypt_backup_payload};
use antigravity_account_manager_lib::db;
use antigravity_account_manager_lib::importer;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--seed") {
        println!("=== 初始化标准演示环境与测试数据 (密码: 123456) ===");
        let base_dir = dirs::data_dir().unwrap().join("AccountVault");
        let _ = std::fs::create_dir_all(&base_dir);
        let db_path = base_dir.join("vault.db");
        let meta_path = base_dir.join("vault.meta");

        let master_pass = "123456";
        let salt = crypto::generate_salt();
        let key = crypto::derive_key(master_pass, &salt).expect("derive key failed");

        let meta = antigravity_account_manager_lib::models::VaultMeta {
            schema_version: 1,
            salt,
            argon2_params: "m=65536,t=3,p=2".to_string(),
            created_at: chrono::Local::now().to_rfc3339(),
            updated_at: chrono::Local::now().to_rfc3339(),
        };
        std::fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap()).unwrap();

        let mut conn = db::open_encrypted_db(&db_path, &key).expect("open db failed");
        db::init_tables(&conn).expect("init tables failed");
        db::seed_mock_data(&mut conn).expect("seed mock failed");
        println!("  -> 成功初始化演示资料库！主密码已设为: 123456");
        return;
    }

    println!("=== 开始运行 Antigravity Account Manager 核心安全与加密测试 ===");

    // Test 1: Argon2 + SQLCipher Encryption & Wrong Key Rejection
    {
        println!("\n[测试 1] 验证 Argon2 密钥派生与 SQLCipher 数据库加密防爆破...");
        let temp_dir = std::env::temp_dir().join(format!("av_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("test_vault.db");

        let master_pass = "MyStrongMasterPass#2026";
        let salt = crypto::generate_salt();
        let key = crypto::derive_key(master_pass, &salt).expect("Key derivation failed");

        // Create and initialize database
        {
            let conn = db::open_encrypted_db(&db_path, &key).expect("Open encrypted DB failed");
            db::init_tables(&conn).expect("Init tables failed");

            let acc_id = db::create_account(&conn, "secure.user@gmail.com", Some("测试账号"))
                .expect("Create account failed");
            db::update_auth_info(
                &conn,
                &acc_id,
                true,
                Some("SecretGooglePassword999"),
                "开启",
                &["Google 提示".to_string()],
                "开启",
                None,
                None,
                None,
            ).expect("Update auth failed");
        }

        // Open with WRONG password -> MUST FAIL
        {
            let wrong_key = crypto::derive_key("WrongPassword123!", &salt).expect("Wrong key derivation");
            let result = db::open_encrypted_db(&db_path, &wrong_key);
            assert!(result.is_err(), "Opening SQLCipher DB with wrong key must fail!");
            println!("  -> 验证通过: 错误密码解锁被 SQLCipher 正确拦截: {:?}", result.unwrap_err());
        }

        // Open with CORRECT password -> MUST SUCCEED
        {
            let conn = db::open_encrypted_db(&db_path, &key).expect("Reopen encrypted DB failed");
            let summaries = db::get_accounts_summary(&conn).expect("Get summary failed");
            assert_eq!(summaries.len(), 1);
            assert_eq!(summaries[0].email, "secure.user@gmail.com");

            let detail = db::get_account_detail(&conn, &summaries[0].id).expect("Get detail failed");
            assert_eq!(detail.auth.password.as_deref(), Some("SecretGooglePassword999"));
            assert_eq!(detail.auth.two_factor_status, "开启");
            assert_eq!(detail.auth.skip_password_status, "开启");
            println!("  -> 验证通过: 正确主密码成功解锁，读取凭据正常: {}", detail.email);
        }

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    // Test 2: Google Backup Codes Sample Parsing
    {
        println!("\n[测试 2] 验证真实 Google 备用码文本格式智能解析...");
        let sample_text = r#"保存您的备用验证码
请将这些备用验证码放在一个安全无虞且便于取用的地方。

1. 9738 3157		 6. 4240 3573
2. 2717 5386		 7. 9582 9974
3. 5288 6833		 8. 8729 2357
4. 4328 7988		 9. 5617 6556
5. 4620 4984		10. 3522 2725

(alex.demo2026@gmail.com)

* 每个备用验证码只能使用一次。
* 需要获取更多验证码？请访问 https://g.co/2sv
* 这些验证码的生成时间：2026年10月20日。"#;

        let result = importer::parse_google_backup_codes_text(sample_text);
        assert_eq!(result.detected_email.as_deref(), Some("alex.demo2026@gmail.com"));
        assert_eq!(result.generation_date.as_deref(), Some("2026年10月20日"));
        assert_eq!(result.total_detected, 10);
        assert_eq!(result.duplicates_count, 0);

        let expected = vec![
            "9738 3157", "4240 3573",
            "2717 5386", "9582 9974",
            "5288 6833", "8729 2357",
            "4328 7988", "5617 6556",
            "4620 4984", "3522 2725",
        ];

        for code in &expected {
            assert!(result.codes.contains(&code.to_string()), "Code {} not found in parsed result", code);
        }
        println!("  -> 验证通过: 成功识别 10 条两列排列备用码、提取邮箱 alex.demo2026@gmail.com 与生成日期 2026年10月20日");
    }

    // Test 3: Backup & Restore Cycle
    {
        println!("\n[测试 3] 验证 AES-256-GCM 加密备份与恢复完整链路...");
        let payload = b"ACCOUNT_VAULT_SQLITE_CIPHER_DATABASE_BYTES_DUMP";
        let password = "BackupRestoreMasterKey!2026";

        let encrypted = encrypt_backup_payload(payload, password).expect("Encryption failed");
        assert!(&encrypted[..8] == crypto::BACKUP_HEADER_MAGIC);

        // Wrong password fails
        let wrong_result = decrypt_backup_payload(&encrypted, "WrongPassword");
        assert!(wrong_result.is_err());
        println!("  -> 验证通过: 错误密码恢复备份失败，拒绝非法解密");

        // Correct password succeeds
        let decrypted = decrypt_backup_payload(&encrypted, password).expect("Decryption failed");
        assert_eq!(&decrypted[..], payload);
        println!("  -> 验证通过: 正确密码成功解密还原，数据完整无误");
    }

    println!("\n=== ALL SECURITY & STORAGE CHECKS PASSED SUCCESSFULLY! ===");
}
