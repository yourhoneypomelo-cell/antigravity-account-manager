pub mod commands;
pub mod chrome;
pub mod crypto;
pub mod db;
pub mod importer;
pub mod models;
pub mod sync_server;

#[cfg(test)]
mod tests;

use commands::AppState;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(AppState::new());

    // Start background sync server for in-browser probe synchronization
    sync_server::start_sync_server();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::get_vault_status,
            commands::init_vault,
            commands::unlock_vault,
            commands::lock_vault,
            commands::reset_vault,
            commands::change_master_password,
            commands::get_accounts_summary,
            commands::get_account_detail,
            commands::get_account_password,
            commands::create_account,
            commands::update_basic_info,
            commands::update_auth_info,
            commands::update_recovery_info,
            commands::save_subscription,
            commands::save_security_key,
            commands::delete_security_key,
            commands::add_backup_code_batch,
            commands::mark_backup_code_used,
            commands::revoke_backup_code,
            commands::delete_account,
            commands::parse_backup_codes_text,
            commands::parse_csv_content,
            commands::import_structured_accounts,
            commands::export_encrypted_backup,
            commands::restore_encrypted_backup,
            commands::get_app_settings,
            commands::save_app_settings,
            commands::seed_mock_data,
            commands::open_url,
            commands::get_account_chrome_profile,
            commands::save_account_chrome_profile,
            commands::open_account_chrome,
            commands::auto_detect_chrome_profile,
            commands::get_active_browser_profile,
            commands::crawl_account_security,
            commands::get_synced_security_data,
            commands::clear_synced_security_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Antigravity Account Manager application");
}
