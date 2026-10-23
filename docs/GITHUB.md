# GitHub 展示与双语维护 / Bilingual GitHub presentation

## 名称 / Names

- Repository: `antigravity-account-manager`
- Product: **Antigravity Account Manager**
- 中文名称：**Antigravity 账号管家**

产品英文名保持一致。中文描述中可使用“Google Antigravity（反重力）账号管理”，方便读者理解；“反重力”在此是中文检索表述，不另设一个英文品牌。

Keep one product name. Use the Chinese name and natural Chinese descriptions alongside it, rather than creating separate identities for each language.

## About：推荐中英文简介 / Recommended bilingual description

复制以下单行文案到 GitHub 仓库的 About / Description：

> Local account manager for Google Antigravity: credentials, 2FA and subscription records. Planned: account pools, refresh tokens, quota monitoring and account switching. 反重力账号管家：管理账号、验证信息与会员记录，规划号池、刷新令牌、额度监控与切号。

英文和中文分别使用完整句子；简介保留定位、当前能力和核心规划。详细功能放在两份 README 的功能与规划章节，不在开头逐词翻译或堆叠术语。

The description separates current capabilities from planned features. Keep it concise and update it as those capabilities ship.

GitHub 普通仓库搜索默认匹配名称、简介和 Topics；搜索 README 内容需要使用 `in:readme`。因此 About 也应包含中英文核心词，不能只依靠翻译文件。

GitHub repository searches without an `in` qualifier search names, descriptions, and topics. Use `in:readme` when searching README contents. This is a search matching strategy, not a guarantee that an AI agent or external search engine will rank or recommend the project.

## Topics：当前定位 / Current scope

```text
antigravity google-antigravity account-manager credential-manager
google-account 2fa totp backup-codes subscription-management
chrome-profile tauri react typescript rust windows ai-coding developer-tools
```

Topics 使用英文小写字母、数字和连字符，当前共 17 个。中文检索词写在 About 和 README 的正常介绍中。账号池、Token、额度与切号实现后，再逐步补充或替换为 `account-pool`、`oauth2`、`refresh-token`、`quota-management`、`account-switcher`；总数保持在 20 个以内。

Use lowercase English topic identifiers. Add or replace topics as features become available, keeping the total at 20 or fewer.

## 文档入口 / Documentation entry points

- [README.md](../README.md)：英文首页，保留一行中文摘要与中文入口。English landing page with a short Chinese summary and language link.
- [README.zh-CN.md](../README.zh-CN.md)：完整中文说明，并链接回英文首页。Full Simplified Chinese documentation with an English link.
- [English Chrome guide](chrome-profiles.en.md) / [中文 Chrome 说明](../Chrome配置绑定说明.md)：两种语言的操作说明。

GitHub 首页由 `README.md` 提供，再通过顶部的相对链接切换语言。不要依赖文件命名自动按访客语言切换。请勿在 `.github/` 添加另一个 `README.md`，以免覆盖根目录的首页展示。

Language navigation uses explicit relative links; it does not depend on automatic visitor-language detection. Avoid adding another `README.md` under `.github/`, because GitHub gives that location precedence over the root README.

## 自然描述需求 / Describe use cases naturally

| 中文需求 / Chinese wording | English wording | 状态 / Status |
| --- | --- | --- |
| Antigravity 账号管理、反重力账号管理 | Antigravity account manager | 当前本地资料管理 / Current local records |
| 谷歌账号验证资料、两步验证、备用码 | Google account credentials, 2FA, TOTP, backup codes | 当前功能 / Available |
| 会员状态、订阅记录 | Subscription records, membership status | 手动记录 / Manual records |
| 账号池、号池、多账号管理 | Account pool, multi-account management | 多账号资料可用，调度规划中 / Records available, scheduling planned |
| 刷新令牌、Refresh Token | OAuth refresh token management | 规划中 / Planned |
| 额度管理、配额监控、剩余额度 | Quota monitoring, quota management, usage tracking | 规划中 / Planned |
| 切号器、切换账号、账号轮换 | Account switcher, account switching, account rotation | 规划中 / Planned |

把术语放在能解释用户需求的句子、功能表和问答中。无需堆砌重复关键词、隐藏文字，也无需把 SEO 词写进 `AGENTS.md`。Agent 是否发现或推荐项目，还取决于它的检索工具、公开索引、项目能力和文档证据。

Use these terms in meaningful feature descriptions and questions. A keyword list, hidden text, or `AGENTS.md` is not a substitute for clear public documentation.

## 更新约定 / Maintenance

1. 功能变化时，同步更新两份 README 的当前能力、规划和限制。Update capabilities, plans, and limitations in both READMEs together.
2. 当前应用界面仍为中文；英文文档提供控件对照。实现语言切换后再声明英文 UI 可用。The app UI is currently Chinese; only claim English UI support after it ships.
3. 中英文截图使用演示资料，并注明对应版本。Use demonstration data in screenshots and identify the version.
4. 欢迎中文或英文 Issue；示例与截图去除真实凭据。Accept issues in either language and remove real credentials from examples.
5. 发布版本时提供中英文更新摘要、安装入口和已知问题。Include release summaries, installation instructions, and known issues in both languages.

本地 `dist-app/`、构建输出、测试日志和备份目录由 `.gitignore` 排除。上述文案已经准备好，但需要在 GitHub 仓库创建后填写 About / Topics。保存这些文档不会自动修改 GitHub 的仓库设置。

## 依据 / References

- [GitHub: Searching for repositories](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories)
- [GitHub: Classifying your repository with topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)
- [GitHub: About the repository README file](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
