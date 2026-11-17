# 星空彼岸（v2.34）

在「我的 → 显示」选择「星空彼岸」。夜蓝、雾紫与暖白文字配合满屏星河和远岸水面，收入为薄荷绿、支出为柔红。大日历、图表、导航与输入弹窗统一配色；金额和表单仍用清楚的实体面板承载。

原「水墨清夏」保留。星空固定夜间外观，切回水墨恢复原来的跟随系统、浅色或深色选择。偏好 `settings.visualStyle` 随本地保存与完整备份恢复，未知值回退为水墨。装饰不联网、不上传记录、不添加动画负担。Android 状态栏、导航栏、WebView 与边缘背景同步夜蓝。

## 最终素材

v3.0 起，以下PNG作为原稿保存在 `design/backgrounds/`；APK实际使用原分辨率的 `app/images/starry-shore.webp`（347,842字节）。生成内容与构图沿用原画，只有文件编码改变；参数见[主题维护](themes.md)。

- 文件：[`app/images/starry-shore.png`](../design/backgrounds/starry-shore.png)，1024 × 1536 PNG，2,438,746 字节。
- 用途：全页背景、首页短封面、外观选择预览；CSS 裁切，不改原图。
- 生成方式：内置 `image_gen` 工具，使用 imagegen 技能；未使用 CLI。无输入参考图，没有嵌入文字或商标。
- CSS：`app/css/starry.css`。新增绘画与既有 SVG 小图标配合，底部导航图标继续使用统一描线图标。

## 最终生成提示词

```text
Use case: stylized-concept. Create one refined atmospheric background illustration for a mobile personal journal and finance app theme named 星空彼岸 (do not render text). Portrait aspect ratio 2:3, high resolution. Quiet starry night above a distant misty shore: deep midnight navy and dusty indigo sky, an airy lavender Milky Way ribbon across the upper third, sparse tiny warm ivory stars, a delicate moon, distant blue violet mountain silhouettes on the far bank, a calm lake with faint silver reflections in the lower half and a few subtle shoreline reeds at the outer bottom edge. Painterly gouache and watercolor grain, sophisticated book-cover illustration, contemplative and spacious, natural hand-painted variation. Most of the center should be smooth dark low-contrast empty space so app cards and text can be placed over it; details concentrate near the top and lower outer edges. Restrained luminosity, no neon, no glowing UI, no science-fiction objects, no people, no buildings, no lettering, no logo, no border, no interface mockup. Full-bleed finished artwork.
```
