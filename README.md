# 那年夏天 · 个人生活管理 App

记账 · 工时薪资 · 时光日程 · 打卡 · AI 助手（GLM-5.3），一个 App 全搞定。纯本地存储 + 自动备份，无需登录，个人自用。

## 一、安装到手机

1. 下载 `apk/nianxiatian.apk`（或仓库首页 Releases 说明）传到 Android 手机
2. 点击安装，允许"安装未知应用"权限；要求 **Android 7.0+**
3. 以后更新直接在 App 内操作：**我的 → 应用更新 → 检查更新**（从本仓库在线下载安装）

> 本应用与旧「拾光」是两个独立应用（包名不同），互不影响；旧应用可直接卸载。

## 二、核心功能

| 模块 | 功能 |
|------|------|
| 🏠 首页 | 今日手记、待办与打卡概览、本月收支、生活工具；导航栏可直接记账 |
| 💰 资产 | 月概况/预算/净资产（负债默认折叠为「🔒 隐藏资产」）/账户管理/会员订阅（SGD↔CNY 汇率折算） |
| 🕒 工时 | 月历显示每天工时与对应薪资；默认时薪 + 项目时薪 + 单条快照三级计价；总收入/日均收入 |
| 📋 账单 | 收支分析、流水明细和账单日历；周/月/年结余；收支折线和分组柱图、分类占比及明细；按同期对比分类变化、查看两期流水；按备注、分类或账户搜索，可直接跳到历史月份。账单日历按日显示支出、收入、收支或结余，可查单日排行和本月剩余预算 |
| ✨ 时光 | 日历（日程+待办+打卡叠加）/ 今日工作台 / 事项四象限 / 番茄专注（真实时间戳）/ 倒数日 |
| 🤖 AI | GLM-5.3 流式对话；**多会话**（新建/切换/删除）；自然语言记账/建待办/记工时，可撤销 |

**记账规则**：整数分存储；转账/还款不计收支；信用卡刷卡只计一次支出；净资产=资产−负债；一级分类下钻不重复；月总预算与分类预算两套口径。

## 三、数据安全

- **自动备份**：数据变化后自动写入手机「下载/那年夏天备份/nianxiatian-backup.json」——**卸载 App 也不会丢**
- **坚果云自动备份（安卓）**：在「我的 → 数据 → 坚果云自动备份」输入坚果云邮箱和第三方应用密码。连接后，数据变动会排队上传；后台通过 Android 系统联网任务重试。换机后重新连接，选择云端副本并确认恢复。文件在私人网盘的 NianXiaTian 目录，按设备和月内日期轮换保存，最多 31 份/设备。备份不含 AI Key，网盘应用密码保存在本机加密存储中。
- 手动导出：JSON 完整备份 / CSV 账单（Excel 直开）
- 恢复：我的 → 数据 → 导入备份

## 四、AI 配置

我的 → AI 助手 → 填入智谱 BigModel API Key（[open.bigmodel.cn](https://open.bigmodel.cn) 注册获取）→ 测试连接。默认模型 GLM-5.3，可换任何 OpenAI 兼容接口。

## 五、开发与发布

```bash
node tools/serve.js 8765                     # 本地网页调试
UPDATE_NOTE="更新说明" bash tools/build-apk.sh 2.1   # 构建（自动注入版本+生成更新包）
git add -A && git commit -m "v2.1" && git push       # 发布（App 内即可检查到更新）
```

- 构建产物：`那年夏天-v2.1.apk`（本地安装）+ `apk/nianxiatian.apk`（更新包）+ `latest.json`（版本清单）
- 应用内检查更新会在 GitHub Raw 与 GitHub API 之间回退。下载时会校验成品 APK 的 SHA-256、包名、签名与版本。若使用 GitHub Release 分发，构建时设置 `USE_RELEASE_ASSET=1`，并在更新 main 分支清单前，将同一份签名 APK 以 `nianxiatian.apk` 上传到对应的 `v版本号` Release。
- 工具链在 `build/toolchain/`（JDK17 + Android SDK 35，不入库）
- ⚠️ `android/keystore.jks` 已被 .gitignore 排除——**绝不能上传，请异地备份**（丢失后无法覆盖升级）
- 仓库需保持 Public（App 匿名读取更新包）

## 六、目录结构

```
├── app/                 # 前端（HTML/CSS/JS 零依赖）
│   └── js/views/        # home/assets/worktime/bills/life*/expense/focus/countdown/subs/habit/memo/ai/settings
├── android/             # WebView 壳（com.nianxiatian.app）+ 自建 ApkProvider（在线更新安装）
├── tools/               # build-apk.sh / repack.js(arsc修复) / gen-icons.js / serve.js
├── apk/nianxiatian.apk  # 在线更新包（固定路径）
└── latest.json          # 版本清单
```
