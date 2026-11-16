# 清新山水插画 · v2.29

- 素材：[summer-mist.png](../app/images/summer-mist.png)，2172 × 724，PNG，不透明背景。
- 生成方式：内置 `image_gen` 工具（未使用 CLI 或外部 API 密钥），2026-11-16。
- 用途：首页、资产、工时、账单、时光和我的短页眉。以 CSS 背景载入，渐淡接入雾白底色，装饰不接收点击、不参与读屏；深色模式降低亮度感。卡片与日期格内仍保留清晰的数值。
- 原有暖纸色素材 `summer-lake.webp` 保留，新图单独存放。图片打包在 APK 内，不从远程加载。
- 收支图表仍按真实数值绘制。折线不作曲线拟合，面积填色与折线共用数据点，柱高共用原有零基线，环形图保持原有分类比例。切换页面时各图表的渐变 ID 独立，避免滑动预览互相引用。

## 最终生成提示词

```text
Use case: stylized-concept. Create a production illustration asset for a compact Chinese personal journal and finance app, NOT a UI screenshot. A refined fresh Chinese ink-and-watercolor landscape in a very wide horizontal composition, approximately 3:1 aspect ratio. An airy mist-white sky with generous blank space on the left half, pale celadon and jade green distant mountains over a tranquil lake, delicate willow foliage entering from the top right, and a very small white-walled dark-roofed waterside pavilion on the far right. Hand-painted soft watercolor washes, precise fine brush details on the willow and pavilion, natural irregular pigment edges. Fresh clear morning atmosphere, soft mint green, very pale blue-green, clean off-white; one tiny muted apricot sun as an accent. Ancient Chinese painting sensibility, elegant and contemporary, light and delicate rather than yellowed antique paper. Most details on the right half and along lower edge, so the left can carry app text. Full-bleed landscape artwork with no border, no text, no calligraphy, no seals, no logos, no gradients that look synthetic, no purple, no dark heavy background, no cartoon icons, no UI elements. Keep the upper left extremely light and quiet. Export an opaque image.
```
