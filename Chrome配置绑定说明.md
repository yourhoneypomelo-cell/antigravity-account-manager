# 打开账号对应的 Chrome 配置

[English](docs/chrome-profiles.en.md) | **简体中文** · [返回项目说明](README.zh-CN.md)

此功能用于 Windows 桌面程序。每个账号可以绑定一个已有 Chrome Profile；绑定保存在本地加密资料库中，按稳定的账号 ID 关联。

## 首次使用

1. 在 Chrome 的配置选择器中，进入你想绑定的那个配置窗口。
2. 在该窗口地址栏输入 `chrome://version`。
3. 复制页面上的 **个人资料路径（Profile Path）** 和 **可执行文件路径（Executable Path）**。
4. 回到 Antigravity Account Manager，选中对应账号，点击账号标题旁的“设置chrome账号绑定”，粘贴两项完整路径并保存。
5. 按钮变为“账号chrome首页”。点击后，程序用绑定的配置打开一个窗口，进入 Google 账号首页。

例如：

| 页面字段 | 示例 |
| --- | --- |
| 个人资料路径 | `C:\Users\Alice\AppData\Local\Google\Chrome\User Data\Profile 3` |
| 可执行文件路径 | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| 自动推导的 user-data-dir | `C:\Users\Alice\AppData\Local\Google\Chrome\User Data` |
| 自动推导的 profile-directory | `Profile 3` |

末尾也可能是 `Default`，必须以目标窗口的实际路径为准。Chrome 显示名称与邮箱不能当作目录名。可执行文件也可能位于用户目录、其他盘或其他 Chrome 通道安装位置，因此直接采用 `chrome://version` 的实际路径。

## 日常使用

- 在账号标题栏点击“账号chrome首页”。右侧小箭头提供“修改chrome账号绑定”；编辑窗口内可以“解除绑定”。
- 绑定窗口中的“保存绑定”立即保存配置路径；账号其他字段仍按原来的“保存修改”流程保存，二者互不清除草稿。
- 已运行的 Chrome 可能接收新的窗口请求并复用已有进程，这是正常行为。
- 若 Chrome 被卸载、Profile 被移动或资料库恢复到另一台电脑，打开时会提示重新核对路径，不会静默切换到其他配置。
- 解除绑定仅移除 Antigravity Account Manager 中的路径关联，不删除 Chrome 的配置文件或浏览记录。

## 登录状态的含义

Chrome Profile 保存自己的浏览记录、Cookie、扩展与站点状态。程序只负责选中已有 Profile，由 Chrome 继续管理这些数据。若该配置中的 Google 会话已退出或失效，仍需在 Chrome 中正常登录。

一个 Chrome Profile 内可以同时登录多个 Google 网页账号；此按钮保证选择绑定的 Profile，不能保证 Google 网页当前激活的账号一定等于 Antigravity Account Manager 的邮箱。建议按日常使用方式给账号绑定配置，并自行核对一次目标窗口。

## 实现位置

- 前端：`src/components/accounts/ChromeProfileControl.tsx`。
- 桌面接口：`get_account_chrome_profile`、`save_account_chrome_profile`、`open_account_chrome`，在 `src-tauri/src/commands.rs`，通过 `lib.rs` 注册。
- 存储：`account_browser_profiles` 一对一表，以 `account_id` 为主键并关联账号；删除账号时级联清理路径关联。
- 启动与路径检查：`src-tauri/src/chrome.rs`。
- 浏览器演示仅在内存中保留绑定，不启动电脑上的 Chrome。

路径推导后的启动形式如下，示例中的目录必须替换为实际路径：

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  '--user-data-dir=C:\Users\Alice\AppData\Local\Google\Chrome\User Data' `
  '--profile-directory=Profile 3' `
  '--new-window' `
  'https://myaccount.google.com/'
```

程序内由 Rust `Command::new(executable).arg(...)` 分别传入参数，不拼接 shell 命令。前端只提交账号 ID：

```ts
await invoke<boolean>('open_account_chrome', { accountId });
```

启动前会检查资料库已解锁、账号和绑定存在、`chrome.exe` 为现有文件、Profile 为现有目录，且目录内有 `Preferences`、父目录有 `Local State`。仅检查这些路径是否存在，不读取其中内容。程序不提取 Cookie、密码或登录令牌。

## 参考资料

- Chromium 官方：[User Data Directory](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md)
- Chromium 官方源码：[配置启动参数](https://github.com/chromium/chromium/blob/main/chrome/common/chrome_switches.h)
- Tauri 官方：[从前端调用 Rust](https://v2.tauri.app/develop/calling-rust/)
