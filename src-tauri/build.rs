fn main() {
    let profile = std::env::var("PROFILE").unwrap_or_default();
    if profile == "release" {
        let dist_index = std::path::Path::new("../dist/index.html");
        if !dist_index.exists() {
            panic!("FATAL: Release build requires static frontend assets in '../dist/index.html'. Please run 'pnpm build' first.");
        }
    }

    // Stage the project icon in TEMP for Windows resource tools that cannot
    // reliably read icon paths containing non-ASCII project directory names.
    let local_icon = std::path::PathBuf::from("icons/aam-v3-refined/icon.ico");
    println!("cargo:rerun-if-changed=icons/aam-v3-refined/icon.ico");
    let icon_path = std::env::temp_dir().join("antigravity_account_manager_v3_refined_icon.ico");
    std::fs::copy(&local_icon, &icon_path)
        .expect("failed to stage the Antigravity Account Manager application icon");

    let windows_attrs = tauri_build::WindowsAttributes::new()
        .window_icon_path(icon_path);
    tauri_build::try_build(
        tauri_build::Attributes::new().windows_attributes(windows_attrs),
    )
    .expect("failed to run tauri-build");
}
