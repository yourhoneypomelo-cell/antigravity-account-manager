use crate::models::{ChromeProfileBinding, DetectedBrowserProfile};

/// Validate only the two paths explicitly supplied by the user. No Chrome data is read.
pub fn validate_binding(binding: ChromeProfileBinding) -> Result<ChromeProfileBinding, String> {
    #[cfg(target_os = "windows")]
    {
        use std::path::{Component, Path};

        fn clean_path(value: &str) -> String {
            let value = value.trim();
            value.strip_prefix('"').and_then(|v| v.strip_suffix('"')).unwrap_or(value).trim().to_string()
        }

        let binding = ChromeProfileBinding {
            executable_path: clean_path(&binding.executable_path),
            profile_path: clean_path(&binding.profile_path),
        };
        let executable = Path::new(&binding.executable_path);
        let profile = Path::new(&binding.profile_path);
        for path in [executable, profile] {
            if !path.is_absolute() || path.components().any(|part| matches!(part, Component::ParentDir)) {
                return Err("请填写 chrome://version 显示的完整绝对路径，不要使用相对路径。".to_string());
            }
        }
        if !executable.file_name().and_then(|name| name.to_str())
            .is_some_and(|name| name.eq_ignore_ascii_case("chrome.exe")) || !executable.is_file()
        {
            return Err("找不到 chrome.exe，请核对 chrome://version 中的可执行文件路径。".to_string());
        }
        let parent = profile.parent().ok_or_else(|| "Chrome 个人资料路径不完整。".to_string())?;
        let profile_name = profile.file_name().and_then(|name| name.to_str())
            .filter(|name| !name.is_empty())
            .ok_or_else(|| "Chrome 个人资料路径缺少配置文件夹名称。".to_string())?;
        if profile_name == "Guest Profile" || profile_name == "System Profile" {
            return Err("请选择常规 Chrome 个人资料，访客和系统配置不能绑定账号。".to_string());
        }
        if !profile.is_dir() || !profile.join("Preferences").is_file() || !parent.join("Local State").is_file() {
            return Err("未找到现有 Chrome 个人资料，请粘贴 chrome://version 中的个人资料路径（包含 Default 或 Profile 文件夹）。".to_string());
        }
        Ok(binding)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = binding;
        Err("打开指定 Chrome 配置目前仅支持 Windows 桌面版。".to_string())
    }
}

#[cfg(target_os = "windows")]
fn profile_command(binding: &ChromeProfileBinding, url: Option<&str>) -> Result<std::process::Command, String> {
    use std::path::Path;
    use std::process::Command;

    // Revalidate at launch: moving/removing Chrome must never open a different profile.
    let binding = validate_binding(binding.clone())?;
    let profile = Path::new(&binding.profile_path);
    let user_data_dir = profile.parent().ok_or_else(|| "Chrome 个人资料路径不完整。".to_string())?;
    let profile_name = profile.file_name().ok_or_else(|| "Chrome 个人资料路径不完整。".to_string())?;

    let mut data_arg = std::ffi::OsString::from("--user-data-dir=");
    data_arg.push(user_data_dir);
    let mut profile_arg = std::ffi::OsString::from("--profile-directory=");
    profile_arg.push(profile_name);

    let target_url = match url {
        Some(u) if u.starts_with("https://") || u.starts_with("http://") => u,
        _ => "https://myaccount.google.com/",
    };

    let mut command = Command::new(binding.executable_path);
    command.arg(data_arg)
        .arg(profile_arg)
        .arg("--new-window")
        .arg(target_url);
    Ok(command)
}

pub fn open_profile(binding: &ChromeProfileBinding, url: Option<&str>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // No shell, no free-form arguments, no profile/default-browser fallback.
        profile_command(binding, url)?.spawn()
            .map_err(|e| format!("无法启动绑定的 Chrome 配置，请检查路径和访问权限：{}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (binding, url);
        Err("打开指定 Chrome 配置目前仅支持 Windows 桌面版。".to_string())
    }
}

pub fn auto_detect_profile(account_email: Option<&str>) -> Result<ChromeProfileBinding, String> {
    #[cfg(target_os = "windows")]
    {
        use std::path::PathBuf;
        use std::process::Command;

        // 1. Locate Chrome executable
        let mut candidates = Vec::new();
        if let Ok(prog_files) = std::env::var("ProgramFiles") {
            candidates.push(PathBuf::from(&prog_files).join(r"Google\Chrome\Application\chrome.exe"));
        }
        if let Ok(prog_files_x86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(PathBuf::from(&prog_files_x86).join(r"Google\Chrome\Application\chrome.exe"));
        }
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(&local_app_data).join(r"Google\Chrome\Application\chrome.exe"));
        }

        let exe_path = candidates.into_iter().find(|p| p.is_file())
            .ok_or_else(|| "未在系统中检测到 Google Chrome 浏览器安装路径。".to_string())?;

        // 2. Locate User Data and Local State
        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "无法获取 LOCALAPPDATA 环境变量。".to_string())?;
        let user_data_dir = PathBuf::from(local_app_data).join(r"Google\Chrome\User Data");
        let local_state_path = user_data_dir.join("Local State");

        if !local_state_path.is_file() {
            return Err("未找到 Chrome Local State 配置文件，请确认 Chrome 是否已正常运行过。".to_string());
        }

        let local_state_content = std::fs::read_to_string(&local_state_path)
            .map_err(|e| format!("读取 Chrome 配置文件失败：{}", e))?;
        let data: serde_json::Value = serde_json::from_str(&local_state_content)
            .map_err(|e| format!("解析 Chrome Local State 失败：{}", e))?;

        let profile_obj = data.get("profile");
        let info_cache = profile_obj.and_then(|p| p.get("info_cache")).and_then(|ic| ic.as_object());
        let last_used = profile_obj.and_then(|p| p.get("last_used")).and_then(|lu| lu.as_str());

        let mut chosen_profile: Option<String> = None;

        // A. Match by email
        if let Some(target_email) = account_email {
            let target_email_clean = target_email.trim().to_lowercase();
            if !target_email_clean.is_empty() {
                if let Some(cache) = info_cache {
                    for (dir_name, prof_val) in cache {
                        if let Some(user_name) = prof_val.get("user_name").and_then(|u| u.as_str()) {
                            if user_name.trim().to_lowercase() == target_email_clean {
                                chosen_profile = Some(dir_name.clone());
                                break;
                            }
                        }
                    }
                }
            }
        }

        // B. Fallback to last_used
        if chosen_profile.is_none() {
            if let Some(lu) = last_used {
                if let Some(cache) = info_cache {
                    if cache.contains_key(lu) {
                        chosen_profile = Some(lu.to_string());
                    }
                }
            }
        }

        // C. Fallback to last_active_profiles
        if chosen_profile.is_none() {
            if let Some(active_arr) = profile_obj.and_then(|p| p.get("last_active_profiles")).and_then(|a| a.as_array()) {
                for item in active_arr {
                    if let Some(s) = item.as_str() {
                        if let Some(cache) = info_cache {
                            if cache.contains_key(s) {
                                chosen_profile = Some(s.to_string());
                                break;
                            }
                        }
                    }
                }
            }
        }

        let chosen_profile_dir = chosen_profile.unwrap_or_else(|| "Default".to_string());
        let full_profile_path = user_data_dir.join(&chosen_profile_dir);

        // D. Open chrome://version in that profile
        let mut profile_arg = std::ffi::OsString::from("--profile-directory=");
        profile_arg.push(&chosen_profile_dir);
        let _ = Command::new(&exe_path)
            .arg(profile_arg)
            .arg("chrome://version")
            .spawn();

        let binding = ChromeProfileBinding {
            executable_path: exe_path.to_string_lossy().to_string(),
            profile_path: full_profile_path.to_string_lossy().to_string(),
        };

        validate_binding(binding)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = account_email;
        Err("自动抓取 Chrome 配置目前仅支持 Windows 平台。".to_string())
    }
}

pub fn detect_active_browser_profile() -> Result<DetectedBrowserProfile, String> {
    #[cfg(target_os = "windows")]
    {
        use std::path::PathBuf;

        // 1. Locate Chrome executable
        let mut candidates = Vec::new();
        if let Ok(prog_files) = std::env::var("ProgramFiles") {
            candidates.push(PathBuf::from(&prog_files).join(r"Google\Chrome\Application\chrome.exe"));
        }
        if let Ok(prog_files_x86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(PathBuf::from(&prog_files_x86).join(r"Google\Chrome\Application\chrome.exe"));
        }
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(&local_app_data).join(r"Google\Chrome\Application\chrome.exe"));
        }

        let exe_path = candidates.into_iter().find(|p| p.is_file())
            .ok_or_else(|| "未在系统中检测到 Google Chrome 浏览器安装路径。".to_string())?;

        // 2. Locate User Data and Local State
        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "无法获取 LOCALAPPDATA 环境变量。".to_string())?;
        let user_data_dir = PathBuf::from(local_app_data).join(r"Google\Chrome\User Data");
        let local_state_path = user_data_dir.join("Local State");

        if !local_state_path.is_file() {
            return Err("未找到 Chrome Local State 配置文件，请确认 Chrome 是否已正常运行过。".to_string());
        }

        let local_state_content = std::fs::read_to_string(&local_state_path)
            .map_err(|e| format!("读取 Chrome 配置文件失败：{}", e))?;
        let data: serde_json::Value = serde_json::from_str(&local_state_content)
            .map_err(|e| format!("解析 Chrome Local State 失败：{}", e))?;

        let profile_obj = data.get("profile");
        let info_cache = profile_obj.and_then(|p| p.get("info_cache")).and_then(|ic| ic.as_object());
        let last_used = profile_obj.and_then(|p| p.get("last_used")).and_then(|lu| lu.as_str());

        let mut chosen_dir: Option<String> = None;
        if let Some(lu) = last_used {
            if let Some(cache) = info_cache {
                if cache.contains_key(lu) {
                    chosen_dir = Some(lu.to_string());
                }
            }
        }
        if chosen_dir.is_none() {
            if let Some(active_arr) = profile_obj.and_then(|p| p.get("last_active_profiles")).and_then(|a| a.as_array()) {
                for item in active_arr {
                    if let Some(s) = item.as_str() {
                        if let Some(cache) = info_cache {
                            if cache.contains_key(s) {
                                chosen_dir = Some(s.to_string());
                                break;
                            }
                        }
                    }
                }
            }
        }

        let profile_name = chosen_dir.unwrap_or_else(|| "Default".to_string());
        let full_profile_path = user_data_dir.join(&profile_name);

        let mut detected_email: Option<String> = None;
        let mut display_name: Option<String> = None;

        if let Some(cache) = info_cache {
            if let Some(prof_info) = cache.get(&profile_name) {
                if let Some(u) = prof_info.get("user_name").and_then(|u| u.as_str()) {
                    let u_trimmed = u.trim();
                    if !u_trimmed.is_empty() && u_trimmed.contains('@') {
                        detected_email = Some(u_trimmed.to_string());
                    }
                }
                if let Some(n) = prof_info.get("name").and_then(|n| n.as_str()) {
                    let n_trimmed = n.trim();
                    if !n_trimmed.is_empty() {
                        display_name = Some(n_trimmed.to_string());
                    }
                }
            }
        }

        let binding = ChromeProfileBinding {
            executable_path: exe_path.to_string_lossy().to_string(),
            profile_path: full_profile_path.to_string_lossy().to_string(),
        };

        let validated = validate_binding(binding)?;

        Ok(DetectedBrowserProfile {
            email: detected_email,
            profile_name,
            display_name,
            executable_path: validated.executable_path,
            profile_path: validated.profile_path,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("自动抓取 Chrome 配置目前仅支持 Windows 平台。".to_string())
    }
}

fn find_python_executable() -> std::path::PathBuf {
    use std::path::PathBuf;
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let p311 = PathBuf::from(&local_app_data).join(r"Programs\Python\Python311\python.exe");
        if p311.is_file() {
            return p311;
        }
        let p_glob = PathBuf::from(&local_app_data).join("Programs").join("Python");
        if let Ok(entries) = std::fs::read_dir(p_glob) {
            for entry in entries.flatten() {
                let candidate = entry.path().join("python.exe");
                if candidate.is_file() {
                    return candidate;
                }
            }
        }
    }
    PathBuf::from("python")
}

fn find_crawler_script() -> Option<std::path::PathBuf> {
    use std::path::PathBuf;

    // 1. Check beside current executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p1 = parent.join("security_crawler.py");
            if p1.is_file() {
                return Some(p1);
            }
            let p2 = parent.join("scripts").join("security_crawler.py");
            if p2.is_file() {
                return Some(p2);
            }
        }
    }

    // 2. Check working directory and known source locations
    let candidates = [
        "security_crawler.py",
        "scripts/security_crawler.py",
        "src-tauri/scripts/security_crawler.py",
        "../security_crawler.py",
        "../src-tauri/scripts/security_crawler.py",
    ];

    for c in &candidates {
        let p = PathBuf::from(c);
        if p.is_file() {
            return Some(p);
        }
    }

    None
}

pub fn crawl_security_info(binding: &ChromeProfileBinding) -> Result<crate::commands::ScrapedSecurityData, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let binding = validate_binding(binding.clone())?;

        // 1. Check if sync_server already has recently captured live data
        if let Some(synced) = crate::sync_server::get_latest_synced() {
            return Ok(synced);
        }

        // 2. Try automated background crawling using real Chrome login profile
        if let Some(script_path) = find_crawler_script() {
            log::info!("Executing automated security crawler: {:?}", script_path);
            let python_bin = find_python_executable();
            let mut cmd = Command::new(&python_bin);
            cmd.arg(&script_path)
                .arg("--profile-path")
                .arg(&binding.profile_path)
                .arg("--executable")
                .arg(&binding.executable_path)
                .arg("--headless")
                .creation_flags(CREATE_NO_WINDOW);

            match cmd.output() {
                Ok(output) => {
                    if output.status.success() {
                        let stdout_str = String::from_utf8_lossy(&output.stdout);
                        if let Ok(data) = serde_json::from_str::<crate::commands::ScrapedSecurityData>(stdout_str.trim()) {
                            log::info!("Successfully crawled security info via Chrome automation!");
                            return Ok(data);
                        } else {
                            log::warn!("Crawler stdout JSON parse error: {}", stdout_str);
                            return Err(format!("解析抓取结果失败: {}", stdout_str.trim()));
                        }
                    } else {
                        let stderr_str = String::from_utf8_lossy(&output.stderr);
                        log::warn!("Crawler script failed: {}", stderr_str);
                        return Err(format!("后台自动抓取未完成: {}", stderr_str.trim()));
                    }
                }
                Err(e) => {
                    log::warn!("Failed to spawn python crawler: {}", e);
                    return Err(format!("启动后台抓取进程失败: {}", e));
                }
            }
        } else {
            return Err("未找到后台爬虫脚本，请检查程序安装完整性。".to_string());
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = binding;
        Err("该功能仅支持 Windows 平台。".to_string())
    }
}

#[cfg(all(test, target_os = "windows"))]
mod chrome_profile_tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    struct Fixture { root: PathBuf, binding: ChromeProfileBinding }
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("av_chrome_test_{}", uuid::Uuid::new_v4()));
            let app_dir = root.join("Chrome 应用 & tools");
            let data = root.join("User Data 测试");
            let profile = data.join("Profile 7");
            fs::create_dir_all(&app_dir).unwrap();
            fs::create_dir_all(&profile).unwrap();
            let executable = app_dir.join("chrome.exe");
            fs::write(&executable, b"not an executable; never spawned").unwrap();
            fs::write(data.join("Local State"), b"{}").unwrap();
            fs::write(profile.join("Preferences"), b"{}").unwrap();
            Self { root, binding: ChromeProfileBinding {
                executable_path: executable.to_string_lossy().into_owned(),
                profile_path: profile.to_string_lossy().into_owned(),
            } }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            // Exact fresh test directory, never a user browser profile.
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn chrome_profile_arguments_preserve_spaces_unicode_and_directory_parent() {
        let fixture = Fixture::new();
        let command = profile_command(&fixture.binding, None).unwrap();
        assert_eq!(command.get_program(), std::ffi::OsStr::new(&fixture.binding.executable_path));
        let args: Vec<_> = command.get_args().map(|arg| arg.to_string_lossy().into_owned()).collect();
        assert_eq!(args, vec![
            format!("--user-data-dir={}", fixture.root.join("User Data 测试").display()),
            "--profile-directory=Profile 7".to_string(),
            "--new-window".to_string(),
            "https://myaccount.google.com/".to_string(),
        ]);
    }

    #[test]
    fn chrome_profile_rejects_missing_or_wrong_paths_instead_of_creating_profiles() {
        let fixture = Fixture::new();
        let mut binding = fixture.binding.clone();
        binding.profile_path = "Profile 7".to_string();
        assert!(validate_binding(binding).is_err());
        let mut binding = fixture.binding.clone();
        binding.profile_path = fixture.root.join("User Data 测试").display().to_string();
        assert!(validate_binding(binding).is_err());
        let mut binding = fixture.binding.clone();
        let wrong_exe = fixture.root.join("tools.exe");
        fs::write(&wrong_exe, b"fixture").unwrap();
        binding.executable_path = wrong_exe.display().to_string();
        assert!(validate_binding(binding).is_err());
        fs::remove_file(PathBuf::from(&fixture.binding.profile_path).join("Preferences")).unwrap();
        assert!(profile_command(&fixture.binding, None).is_err());
        fs::write(PathBuf::from(&fixture.binding.profile_path).join("Preferences"), b"{}").unwrap();
        fs::remove_file(fixture.root.join("User Data 测试").join("Local State")).unwrap();
        assert!(profile_command(&fixture.binding, None).is_err());
    }

    #[test]
    fn chrome_profile_accepts_quoted_paths_and_revalidates_executable() {
        let fixture = Fixture::new();
        let quoted = ChromeProfileBinding {
            executable_path: format!(" \"{}\" ", fixture.binding.executable_path),
            profile_path: format!("\"{}\"", fixture.binding.profile_path),
        };
        assert_eq!(validate_binding(quoted).unwrap(), fixture.binding);
        fs::remove_file(&fixture.binding.executable_path).unwrap();
        assert!(profile_command(&fixture.binding, None).is_err());
    }
}
