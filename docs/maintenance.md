# 维护与换机说明

这份说明用于新电脑、新对话或其他维护者接手项目。应用功能由代码和手册保存，继续开发不依赖旧对话。不要把旧对话里的一次授权当作新会话的所有操作授权；以当前用户请求确定范围。

## 给新对话的开场文字

> 请接手维护 https://github.com/Dear2You/remember 。先读取根目录 AGENTS.md、docs/maintenance.md、README.md 和 app/ai-guide.md，核对本地改动及线上版本。保留现有数据与签名，使用样例测试，不要重写整个项目。本次要做的是：〔在这里填写需求，例如更新新一年的法定节假日和调休数据〕。

## 已发布基线与入口

本说明更新于2026-11-17，当前应用为 **v3.0 / 30000**，发布代码以 `v3.0` 标签为准。用户要求版本从3.x开始，界面功能框与图表恢复v2.39，图片使用原分辨率的高质量压缩版本。之后的文档提交可能比这个标签新；接手时总是再核对 `latest.json`、`app/index.html`、Git 标签和 GitHub Releases，不把这个快照当作永久最新版本。

- 公开仓库：[Dear2You/remember](https://github.com/Dear2You/remember)。应用内更新依赖公开读取清单和安装包。
- 包名：`com.nianxiatian.app`。Android最低API24、目标API35，原生Java外壳加载随包附带的HTML/CSS/JavaScript。
- 前端运行：仓库根目录执行 `node tools/serve.js 8765`，打开 `http://localhost:8765`；直接打开 `app/index.html` 也可做本地浏览器测试。原生提醒、安装及系统栏仍需原生构建／设备验证。
- 前端入口：`app/index.html`、`app/js/app.js`；存储及迁移：`app/js/store.js`；页面：`app/js/views/`；Android桥接与后台能力：`android/java/com/nianxiatian/app/`。
- 业务能力及按钮操作：[应用功能手册](../app/ai-guide.md)。应用内AI读取由它生成的 `app/js/ai-guide.generated.js`；根目录 `AGENTS.md` 则供开发助手接手使用。

## 常见修改去哪里找

| 工作 | 入口与说明 |
| --- | --- |
| 月薪、工作日、跨月计薪、出勤与到账 | `app/js/payroll.js`、`app/js/views/payroll.js`、[工资与日历规则](work-calendar.md) |
| 自动续期、暂停、删除排除与未来方案更新 | `app/js/salary-renewal.js`、`tests/salary-renewal.test.js` |
| 农历、节日、节气与时光大日历 | `app/js/calendar-info.js`、`app/js/views/lifecal.js`、`app/css/almanac.css`；离线农历库位于 `app/js/vendor/` |
| 账单、手续费、预算、存钱及信用消费 | `app/js/store.js`、相关 `app/js/views/`、[消费与存钱规则](spending-and-saving.md) |
| 星空主题及插画 | `app/css/starry.css`、`app/images/starry-shore.webp`、[素材与提示词](starry-theme.md) |
| 多主题、独立配色、图标与图表 | `app/js/appearance.js`、`app/js/art.js`、`app/css/themes.css`、`app/css/theme-details.css`、`app/js/charts.js`、`app/js/finance-report.js`；六套主题通过设置页下拉选择，各自记住配色。环形图绘制与点选共用几何信息，见[主题维护与素材](themes.md) |
| 手机窄留白、日历与弹窗遮挡 | `app/css/edge-layout.css`；页面两侧8px、底栏两侧6px与底部4px，核对日历格内文字、弹窗保存区、键盘与导航安全区 |
| 背景压缩与原图维护 | `design/backgrounds/` 存原始PNG，`app/images/` 存运行用WebP，`tools/compress-backgrounds.js` 从原图导出并记录哈希。原图与编码器不进入APK；不要再次压缩已有WebP，详见[原稿维护说明](../design/backgrounds/README.md) |
| 更新下载、提醒及云备份 | Android目录中的相应Java类，以及前端 `app/js/` 中对应模块；入口和限制看功能手册 |
| 验证依据 | `tests/`、`docs/qa-*.md`；临时截图和测试产物在忽略的 `build/` 下，不应作为换机后唯一依据 |

## 每年更新法定节假日与调休

当前v3.0内置2026、2027年；没有独立联网更新假日表的功能。新年度安排尚未收录时，工资自动续期停止在缺少数据的区间并提示，不按普通周末猜排班。

1. 查阅该年度国务院办公厅正式通知或可核验的政府转载，核对通知年份、发布日期、放假起止日和补班日。不要把网络预测或仅有农历节日的日期表当作调休安排。
2. 更新 `app/js/payroll.js` 顶部 `WorkCalendar.schedules`。`off` 是含首尾的月日区间，`on` 是补班日；补班优先于普通周末。当前 `off` 下标对应元旦、春节、清明、劳动、端午、中秋、国庆，若新通知合并假期，还要核对 `dayInfo` 名称映射。
3. 时光假日标签与工资排班共用该数据。核对 `app/js/calendar-info.js` 的读取行为及 `app/js/views/lifecal.js` 中假日年份提示和来源链接，更新应用手册和 `docs/work-calendar.md` 的来源、收录年份及用法。
4. 在相关日期／工资测试中验证春节、调休周末、跨年21日至20日周期、2月，以及日历标签与应出勤日期一致。未知年份的用例应使用仍未收录的年份，不能因为增加新年数据就删除这项保护。
5. 核对自动续期能继续生成，保留已经开始、已有出勤或到账、手动编辑以及手动删除的方案。最后依正常流程发布新应用版本。用户更新并打开后自动补齐，无需每月手工创建。

## 换电脑必须区分的三类东西

| 内容 | 保存位置与迁移方式 |
| --- | --- |
| 源码、说明、公开发布的APK | 已在GitHub；新电脑克隆仓库可取回 |
| 手机账单、出勤、日程等个人数据 | 保存在手机及用户自己的备份里；换手机应按功能手册从坚果云或完整JSON恢复。Git仓库不保存这些个人数据 |
| APK签名私钥与密码配置 | `android/keystore.jks` 和 `.private/signing.json` 均被Git忽略，**不在GitHub**。从加密签名备份恢复；解锁口令另行保管，详见[签名备份说明](signing-backup.md) |

签名文件可放在本人保管的U盘或经过加密的私人备份中，密码另行妥善保管；不要放进公开仓库、普通账单JSON或聊天附件。**仅克隆仓库不足以恢复正式发布能力。** GitHub账号授权也需要在新机器重新配置，不复制或公开输出令牌。

原发布证书SHA-256（公开校验信息，不是私钥）：

```text
b08fc9b85314e227d8d97779db460830a7acfeac58e2e3c88fcde9c64ea5827f
```

新机器正式构建前先恢复原密钥和 `.private/signing.json`，运行 `bash tools/build-apk.sh --check-signing` 核对证书。私有配置仅由 `tools/sign-apk.js` 读取，密码通过子进程环境变量传递；不要将配置打印到日志。缺少原件或证书不一致时构建会停止，不再自动生成新钥。公开证书或已签APK不能代替私钥完成签名。

## 构建、验证与发布顺序

构建依赖Node、Git Bash、JDK及Android SDK。现有脚本使用仓库下 `build/toolchain/` 的JDK和Android SDK，平台为35、build-tools为34.0.0。工具链不在Git中，新电脑需按脚本实际查找路径从官方来源重新配置。具体子路径从脚本读取，不依赖旧电脑的绝对路径。

1. 查看 `git status`，保留用户未提交改动。先完成修改和相应测试。更新应用版本时同步 `app/index.html` 的版本名／版本码以及 `app/ai-guide.md` 首条版本记录和现行操作说明，执行 `node tools/build-ai-guide.js`。
2. 发布前执行 `node --test --test-reporter=dot tests/*.test.js`。界面要检查窄屏、弹窗、输入与金额隐藏，并用样例数据做目视核对；在相应 `docs/qa-版本.md` 写清结果和未验证部分。
3. 确认原密钥在位。构建会递归清理 `build/work`：先确认绝对路径确为当前仓库下的这个目录，且不是目录链接，再执行构建。

   ```bash
   USE_RELEASE_ASSET=1 UPDATE_NOTE="本版实际更新说明" bash tools/build-apk.sh 新版本号
   ```

4. 构建得到 `那年夏天-v版本.apk`、`apk/nianxiatian.apk`、`latest.json`。用apksigner核对新旧签名相同，用aapt核对包名及版本。验证APK SHA-256与清单一致，清单的Git blob指向同一APK；解包核对前端资源，运行涉及改动的实际包资源验收。不要只检查源码网页。
5. 将代码、文档、生成手册、更新包及清单提交到Git，创建新的 `v版本号` 标签。**先推新标签，让新资产可用后再推main更新清单。** 不强推旧标签。
6. 通过GitHub Releases或可用的CLI/API，为已推送的新标签创建草稿Release，上传同一份APK，资产名固定为 `nianxiatian.apk`。核对上传大小、SHA-256后发布。若重试，先检查已有Release和资产；不删除或替换已发布安装包。
7. 确认Release为已发布且 `immutable=true`，公开下载URL与 `latest.json` 的 `apkUrl` 相同。实际下载主地址与清单的备用Git blob，比对完整文件或SHA-256。然后推main，确认公开main清单已更新、main及标签指向预期提交。检查工作区状态。

此流程不依赖本机 `build/preview-*` 内的临时发布脚本。应用更改才需要新APK；仅维护文档的提交保持现有版本和清单，不制造空更新。

## 已知边界

- 尚无独立在线假日数据更新；若以后要做，需要实现数据来源校验、离线缓存、失败回退和已确认工资保护，不能只改提示语就宣称支持。
- 自动续期在打开、回到前台及可见跨日时检查，关闭应用期间不依赖后台定时常驻；下一次打开会补齐。
- Android提醒、键盘和系统栏需要真机条件才能完整验收；不要将浏览器模拟结果写成用户手机上已验证。

后续改变这些行为或发布流程时同步本文。应用内部AI的功能变化仍要另行维护 `app/ai-guide.md` 及生成文件。
