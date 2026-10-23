#[cfg(test)]
mod test_suite {
    use crate::crypto::{self, decrypt_backup_payload, encrypt_backup_payload};
    use crate::db;
    use crate::importer;

    #[test]
    fn test_argon2_and_sqlcipher_encryption_and_rejection() {
        let temp_dir = std::env::temp_dir().join(format!("av_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("test_vault.db");

        let master_pass = "MyStrongMasterPass#2026";
        let salt = crypto::generate_salt();
        let key = crypto::derive_key(master_pass, &salt).expect("Key derivation failed");

        // 1. Create and initialize database
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

        // 2. Open with WRONG password -> MUST FAIL
        {
            let wrong_key = crypto::derive_key("WrongPassword123!", &salt).expect("Wrong key derivation");
            let result = db::open_encrypted_db(&db_path, &wrong_key);
            assert!(result.is_err(), "Opening SQLCipher DB with wrong key must fail!");
            println!("Verified: wrong password rejected properly: {:?}", result.unwrap_err());
        }

        // 3. Open with CORRECT password -> MUST SUCCEED
        {
            let conn = db::open_encrypted_db(&db_path, &key).expect("Reopen encrypted DB failed");
            let summaries = db::get_accounts_summary(&conn).expect("Get summary failed");
            assert_eq!(summaries.len(), 1);
            assert_eq!(summaries[0].email, "secure.user@gmail.com");

            let detail = db::get_account_detail(&conn, &summaries[0].id).expect("Get detail failed");
            assert_eq!(detail.auth.password.as_deref(), Some("SecretGooglePassword999"));
            assert_eq!(detail.auth.two_factor_status, "开启");
            assert_eq!(detail.auth.skip_password_status, "开启");
            println!("Verified: correct password retrieved secret properly: {}", detail.email);
        }

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_google_backup_codes_sample_parsing() {
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
        println!("Parse result: {:?}", result);

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
    }

    #[test]
    fn test_backup_and_restore_cycle() {
        let payload = b"ACCOUNT_VAULT_SQLITE_CIPHER_DATABASE_BYTES_DUMP";
        let password = "BackupRestoreMasterKey!2026";

        let encrypted = encrypt_backup_payload(payload, password).expect("Encryption failed");
        assert!(&encrypted[..8] == crypto::BACKUP_HEADER_MAGIC);

        // Wrong password fails
        let wrong_result = decrypt_backup_payload(&encrypted, "WrongPassword");
        assert!(wrong_result.is_err());

        // Correct password succeeds
        let decrypted = decrypt_backup_payload(&encrypted, password).expect("Decryption failed");
        assert_eq!(&decrypted[..], payload);
        println!("Verified: Backup export and restore cycle succeeded.");
    }
}
