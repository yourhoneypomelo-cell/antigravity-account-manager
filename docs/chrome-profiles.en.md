# Open an account's Chrome profile

**English** | [简体中文](../Chrome配置绑定说明.md) · [Back to the project](../README.md)

This feature is for the Windows desktop app. Each account can be linked to an existing Chrome profile. The binding is saved in the encrypted local vault and associated with the account's stable ID.

## First-time setup

1. In Chrome's profile selector, open the profile you want to associate with the account.
2. Visit `chrome://version` in that window.
3. Copy **Profile Path** and **Executable Path** from the page.
4. In Antigravity Account Manager, select the account and click `设置chrome账号绑定` (set up Chrome account binding) beside its heading and enter both full paths.
5. Save the binding. Use the account's Chrome launch button to open its Google account page with that profile.

The current app interface uses Chinese labels. The Chrome controls include `设置chrome账号绑定` (set up binding), `修改chrome账号绑定` (edit binding), `保存绑定` (save binding), `解除绑定` (remove binding), and `账号chrome首页` (open the account page in Chrome).

The existing binding menu also offers `自动抓取并更新` (automatically detect and update). The manual `chrome://version` method lets you explicitly identify the intended profile and executable.

| Field | Example |
| --- | --- |
| Profile Path | `C:\Users\Alice\AppData\Local\Google\Chrome\User Data\Profile 3` |
| Executable Path | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Derived user data directory | `C:\Users\Alice\AppData\Local\Google\Chrome\User Data` |
| Derived profile directory | `Profile 3` |

The profile directory may also be `Default`. Use the paths shown in the intended Chrome window. A profile display name or email address is not a directory name. Chrome may be installed per user or on another drive, so do not assume the example executable path matches your computer.

## Everyday use

- Use the launch button beside the account heading. Its adjacent menu provides binding options.
- Saving a Chrome binding immediately saves its paths. Other account fields still use the separate Save changes action, and their drafts are retained.
- Chrome may route the new window request to an existing browser process.
- If Chrome is uninstalled, the profile is moved, or the vault is moved to another computer, recheck the paths. The app does not silently substitute another profile.
- Removing a binding deletes only this app's path association, not Chrome profile files or browsing history.

## What a profile binding means

Chrome owns the profile's cookies, history, extensions, and login sessions. This app selects an existing profile; sign in through Chrome normally if its Google session has expired.

A single profile can contain multiple signed-in Google accounts. Opening the associated profile does not guarantee that the active Google website account matches the email in this app. Check that association when configuring it.

This feature opens a browser profile. It does not switch accounts inside the Antigravity client.

## Implementation overview

- Frontend: `src/components/accounts/ChromeProfileControl.tsx`.
- Desktop commands: `get_account_chrome_profile`, `save_account_chrome_profile`, and `open_account_chrome` in `src-tauri/src/commands.rs`, registered in `lib.rs`.
- Storage: `account_browser_profiles`, with one binding per account and cascading cleanup when the account is deleted.
- Launching and path checks: `src-tauri/src/chrome.rs`.
- Browser preview: bindings live only in memory; it does not launch the computer's Chrome.

The backend passes executable arguments separately using Rust's command API. Before launching, it checks the unlocked vault, account, binding, executable, profile directory, and the required `Preferences` and `Local State` paths. It does not extract Chrome cookies, passwords, or login tokens.
