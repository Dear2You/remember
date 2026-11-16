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

## v2.31 整页水墨底图

`app/images/summer-scroll.png` 是使用内置 `image_gen` 生成的竖幅浅青水墨底图。它作为整页背景随 APK 分发，正文叠在浅色纸面上，深色模式降低背景透明度；不从网络加载。底部导航和记账弹窗沿用 `app/js/art.js` 的本地 SVG 图标。

最终生成提示词：

```text
Use case: stylized-concept. Asset type: a vertical full-screen background illustration for a refined Chinese personal journal mobile app. Create an airy continuous Chinese ink-and-watercolor landscape on clean mist-white paper, 2:3 portrait composition. Very pale celadon mountain silhouettes dissolve into a lake with soft blue-green reflections; delicate willow leaves enter only near the upper right edge, faint shoreline grasses and a tiny waterside pavilion near the lower right edge. A tiny muted apricot sun near the distant upper hills. Spread subtle hand-painted pigment across the whole height so it feels like one complete landscape, with large near-white quiet open areas through the central 70 percent for readable UI text. Most fine details cluster near the edges and lower part. Low contrast, fresh early morning, elegant Chinese brush painting, watery irregular edges, pale sage and cool white rather than aged yellow paper. No text, no lettering, no seals, no people, no app UI, no frame, no logos, no mockup. Opaque background.
```

## v2.30 界面延续

复用同一幅浅青山水，首页将日期与本月收支合成一张账页，工作摘要使用细窄的便签边饰，待办与最近流水使用行间细线。保持小标题、短卡片和自然月默认页。

`app/js/art.js` 为本地 SVG 图标集合，细描边搭配低透明度填色。账户图标在资产、管理和记账选择中统一呈现，保存的图标值仍沿用旧值，备份格式不变。默认分类在账单与记账一级分类中共用图案，自定义图标保留。便笺、票签、表盘与折叠菜单的样式放在 `app/css/journal.css`；没有新增远程图片、字体或依赖。
