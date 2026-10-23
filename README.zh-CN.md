<img src="public/branding/antigravity-v3-dark.svg" width="96" height="96" alt="Antigravity 账号管家" />

# Antigravity Account Manager

**面向 Google Antigravity（反重力）用户的本地账号管家。**

集中管理 Google 账号、验证信息与会员记录，逐步扩展号池、OAuth Refresh Token、额度监控和账号切换能力。

[English](README.md) | **简体中文**

[当前功能](#当前功能) · [功能规划](#功能规划) · [开始使用](#开始使用) · [本地开发](#本地开发)

Windows 桌面应用 · 当前界面为中文 · 持续开发中

## 当前功能

- **账号资料**：管理登录凭据和找回信息，搜索账号，支持 CSV 批量导入。
- **验证信息**：生成 TOTP 动态验证码，整理 Google 备用码，记录通行密钥与安全密钥的设备和状态，不保存 Passkey 私钥。
- **会员记录**：手动维护套餐、会员状态、日期和费用。
- **Chrome 配置**：为账号绑定已有浏览器配置，打开对应的 Google 账号页面。
- **本地资料库**：使用 SQLCipher 加密存储，以主密码解锁，支持手动锁定、自动锁定及深浅主题。

以上资料由用户在本地维护，修改记录不会更改 Google 线上设置，也不会自动核验会员状态。Chrome 配置绑定当前尚不能切换 Antigravity 客户端账号。

已支持加密备份导出，但恢复流程存在已知问题，使用前请阅读[备份与当前限制](#备份与当前限制)。

## 功能规划

下一步将围绕账号可用状态、授权和额度，把管理能力延伸到日常切号流程。以下功能尚未实现。

- [ ] **号池管理**：账号分组、可用状态与健康检查。
- [ ] **刷新令牌**：导入 OAuth 授权，保存 Refresh Token，刷新访问令牌，标记失效或撤销的授权。
- [ ] **额度监控**：查看剩余额度、使用情况和重置时间。
- [ ] **账号切换**：通过支持的接入方式切换 Antigravity 账号。
- [ ] **额度感知轮换**：结合账号可用状态与剩余额度选择账号。
- [ ] **会员状态同步**：在可用接口支持的范围内查询并同步订阅状态。
- [ ] **备份与恢复**：修复恢复流程，完善导出、导入和换机迁移。
- [ ] **中英文界面**：支持简体中文、英文、语言切换与偏好保存。

## 开始使用

对于已有的本地便携版，打开 `dist-app/Antigravity Account Manager.exe`，也可以双击同目录的 `启动 Antigravity Account Manager.bat`。

- 首次使用时创建主密码；从旧版升级的用户继续使用原主密码。
- 新增账号后，在“安全性与登录”“Gemini 会员”页签填写资料，点击“保存修改”。
- 切换账号前，可以选择保存或放弃未保存的修改。
- 顶栏提供导入、设置、主题与锁定操作。
- Chrome 绑定操作见 [Chrome 配置绑定说明](Chrome配置绑定说明.md)。

便携版运行时，`libcrypto-4-x64.dll` 和 `WebView2Loader.dll` 应与主程序放在同一目录。目标电脑还需要 Windows / VC++ x64 运行环境与 WebView2。源码仓库不包含本地 `dist-app/` 目录中的程序和 DLL；从源码构建请按下面的开发说明操作。

## 数据位置与旧版兼容

Windows 版继续使用原有数据位置：

```text
%APPDATA%/AccountVault/
├── vault.db
└── vault.meta
```

`vault.db` 是加密数据库，`vault.meta` 保存解锁所需的盐值和派生参数等元数据。手动迁移时，应在关闭程序后，将两者作为同一组文件保存。

此次更名保留数据目录 `AccountVault`、应用标识 `com.accountvault.desktop`、主题偏好键和 `.acvault` 文件格式，现有资料库继续沿用。它们属于兼容标识，不是仍在使用的产品名称。

## 备份与当前限制

- 数据库使用 SQLCipher；主密码通过 Argon2id 派生密钥，备份外层采用 AES-256-GCM 加密。
- **当前 `.acvault` 恢复实现存在数据库密钥与元数据一致性问题，尚不能作为可靠的换机恢复方案。** 备份导出和解密成功不等于能够重新打开数据库；修复前请勿在唯一的资料库上使用“恢复”。
- 当前备份导出路径固定为 `D:/account_vault_backup_YYYYMMDD.acvault`，尚无保存位置选择器。没有 D 盘、目录不可写或同日重复导出时，需要特别留意错误提示或同名文件覆盖。
- Chrome Profile 内的 Cookie、扩展、浏览记录和实际登录会话由 Chrome 管理；本项目保存的是绑定路径。打开某个配置不保证 Google 网页当前激活的账号与本地记录完全一致。
- 目前未完成跨平台桌面验证；Chrome 配置操作主要面向 Windows。

## 本地开发

### 环境

- Node.js、pnpm。
- Rust 与匹配的 Windows C/C++ 编译工具链（本机现有配置使用 GNU / MinGW）；依赖库架构应与 Rust 目标一致。
- 桌面端需要 WebView2；SQLCipher 编译需要可用的 OpenSSL 开发库及对应运行库。

现有工作目录中的 `.cargo/config.toml` 与 `src-tauri/.cargo/config.toml` 是本机配置，指定了 Cargo 输出位置和 OpenSSL 路径；它们不随源码提交。在其他电脑上，请按本机环境配置 `OPENSSL_DIR`，并保证编译器能找到相应的库。默认 Cargo 输出位于 `src-tauri/target/`；设置了 `CARGO_TARGET_DIR` 或 `build.target-dir` 时，以实际配置为准。

### 安装依赖与浏览器预览

在项目根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

打开 `http://127.0.0.1:1420/`。浏览器预览使用临时演示资料，刷新页面后复原；演示锁屏密码为 `demo`。浏览器预览与桌面资料库分离，不能用于保存真实账号资料，也不会启动电脑上的 Chrome。

| 预览参数 | 用途 |
| --- | --- |
| `?theme=light` | 浅色主题 |
| `?theme=dark` | 深色主题 |
| `?locked=1` | 从演示锁屏开始 |
| `?preview=components` | 组件状态预览 |

### 启动与构建桌面端

```powershell
# 启动桌面开发版
pnpm dev:app

# 检查 TypeScript 并构建前端
pnpm build

# 构建 Windows 桌面可执行文件
pnpm build:app
```

构建产物名称为 `antigravity-account-manager.exe`，位于 Cargo 输出目录的 `release/` 下。制作便携版时，可复制为 `Antigravity Account Manager.exe`，并配齐对应运行库。命令使用 `--no-bundle`，不会生成安装包。

### 现有桌面测试

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --release --lib
```

运行测试时须确保对应 OpenSSL DLL 可被找到。测试覆盖加密、解析和 Chrome 配置绑定等已有逻辑；测试通过并不表示上文所列的备份恢复问题已解决。

## 项目结构

```text
src/                       React 界面与浏览器演示
  components/              账号资料、弹窗与界面组件
  context/                 资料库状态与账号编辑流程
  services/                Tauri 调用与演示数据适配
  utils/                   TOTP、剪贴板等工具
src-tauri/                 Rust 桌面后端
  src/                     资料库、加密、导入与 Chrome 配置
  icons/                   桌面图标
public/                    静态资源与组件示例
docs/                      GitHub 项目展示资料
README.md                  英文首页与中英文摘要
README.zh-CN.md            完整中文说明
DESIGN.md                  界面规范
Chrome配置绑定说明.md        Chrome 使用说明
```

## 参与开发

提交问题时，请说明复现步骤、系统环境和预期行为。账号、密码、验证器密钥、备用码、OAuth Token 与个人资料库不应出现在 Issue、截图或提交内容中；示例请使用虚构资料。

欢迎使用中文或英文提交问题。新增功能时，请同步更新两份 README 的“当前功能”“规划功能”和已知限制，确保两种语言描述的是同一版本。用于 GitHub About 和 Topics 的文案见 [GitHub 展示配置](docs/GITHUB.md)。

## 关于项目

基于 Tauri、React、TypeScript 和 Rust 构建，原名 **Account Vault**。这是独立社区项目，与 Google 无官方隶属关系，也不代表获得官方认可。
