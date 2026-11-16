# 主题与配色（v2.36）

在「我的 → 显示」使用「界面主题」和「主题配色」两个下拉框。平时只显示当前选项，点击才打开列表，不再排列主题预览图或色块。当前六套场景：水墨清夏、星空彼岸、碧海晴空、未来回响、松间晨雾、落日余温；每个场景独立保存原配／海蓝／青绿／雾紫／胭粉／暖杏。背景保持原画，界面表面和点缀随所选配色改变。

## 存储与维护

- `settings.visualStyle` 保存场景，`settings.themePalettes` 是以场景 ID 为键的配色字典。旧数据缺少字段、未知场景／配色会安全回退。完整备份保留偏好。
- `settings.theme` 保留用户的明暗选择。星空和未来固定夜色，水墨、海岸、森林和落日可跟随系统／浅色／深色；切换夜景不会覆盖明暗偏好。
- `appearance.js` 解析有效外观；`themes.css` 提供各场景及配色 token；`starry.css` 保留星空默认变量，并与其他非水墨场景共用面板规则。
- 收入和支出使用独立语义色，不随按钮点缀色互换。分类占比色块只区分类别。
- `MainActivity.setThemeColors` 只接受六位十六进制颜色，前端从实际 CSS 底色同步状态栏、导航栏与 WebView 边缘，保留旧桥接兼容。
- Canvas 图表保存可重绘参数，明暗变化时重绘颜色，移除已离开页面的画布引用。设置页切主题只更新选中态，保留未保存表单与焦点。
- 下拉控件保留原生键盘及系统选项列表；若保存失败，回退设置值与两个下拉框，保持现有界面，不显示未保存的选择。说明文字随当前主题更新。

## 图表风格与准确性

海岸的面积曲线使用两端水平切线的贝塞尔线段，控制点的高度只取真实端点，不生成超过两端的新峰值。科技主题保留真实直线走势，增加微光、细网格、方柱和外圈刻度。环形图的刻度为装饰，实际扇区始终按金额比例计算；微小分类不会被装饰环吞掉。类别图例与扇区共用 CSS 色值。图表交互、整数分金额和隐藏金额行为不变。

森林主题使用植物色阶、叶形标记、细横线和外圈年轮；落日主题使用暖色分类、柔和面积曲线和双线外圈。装饰在扇区外侧，不改变角度或金额。落日曲线沿用海岸的不越界插值。

## 新插画与最终提示词

两张素材均使用内置 `image_gen` 工具、imagegen 技能生成，无输入参考图；未使用 CLI。最终素材随 APK 打包，离线使用，无远程图片请求。原水墨、星空素材保留；星空原提示词见 [starry-theme.md](starry-theme.md)。

- [碧海晴空](../app/images/coastal-sky.png)：1024 × 1536 PNG，应用全页背景、首页封面和选择预览。
- [未来回响](../app/images/future-horizon.png)：1024 × 1536 PNG，应用全页背景、首页封面和选择预览。

### 碧海晴空

```text
Use case: stylized-concept. Asset type: full-bleed portrait background illustration for an elegant daily journal and budget mobile app. Primary request: blue sea and sunny sky, a fresh refined coastal atmosphere. Scene: a spacious pale azure sky with a few softly painted white clouds at the top, a distant blue island and bright turquoise sea, a thin line of white surf and delicate pale sand near the bottom. Hand-painted watercolor and gouache with subtle paper grain, polished editorial travel illustration, restful natural daylight. Portrait 2:3. Keep the middle broad and quiet with low-contrast translucent sea color so interface panels can overlay it; concentrate scenic detail near upper and lower edges. Color palette sky blue, sea glass cyan, warm white, a little sandy cream. Avoid people, boats, text, logos, icons, UI elements, frames, strong lens flares, neon and busy repeated wave patterns. A finished background illustration, no interface mockup.
```

### 未来回响

```text
Use case: stylized-concept. Asset type: portrait background art for a refined futuristic personal productivity mobile app. Primary request: a quiet future-technology world in deep blue and icy cyan. Scene: an ultra-distant graceful silver-blue city skyline on the horizon near the lower third, subtle pale cyan illuminated architecture and restrained curved orbital light traces toward the upper edges, dark smooth atmospheric sky and faint reflective surface at the bottom. Sophisticated architectural concept illustration, soft cinematic depth, crisp delicate structural lines, calm believable materials, a little cool white starlight. Portrait 2:3. Leave the central vertical area extremely uncluttered, low contrast dark blue negative space for readable app panels. Decorative structures stay near the bottom and outer edges. Avoid text, numbers, dashboards, interface elements, glowing buttons, people, vehicles, robots, logos, magenta cyberpunk clutter and intense neon. This is finished atmospheric artwork, not a screenshot or UI mockup.
```

## v2.36 新插画

以下素材均由内置 `image_gen` 工具生成，使用 imagegen 技能，无输入参考图，未使用 CLI。随 APK 本地打包；原素材保留。

- [松间晨雾](../app/images/forest-mist.png)：1024 × 1536 PNG，用于全页背景和首页短封面。
- [落日余温](../app/images/sunset-glow.png)：1024 × 1536 PNG，用于全页背景和首页短封面。

### 松间晨雾最终提示词

```text
Use case: stylized-concept. Asset type: full-bleed portrait background illustration for a refined daily journal and budget app, theme called Morning Mist in the Pines. Primary request: a refreshing quiet woodland morning in sage green, mist white and muted moss. Scene: slender pine trees at the outer sides, a few delicate fern fronds near the bottom edges, pale layered forest hills dissolving into morning mist toward the open center, soft dappled early sunlight. Hand-painted watercolor and gouache, elegant botanical travel-journal illustration with subtle paper texture. Portrait 2:3. Keep the broad center spacious and pale with extremely low contrast for readable interface panels; place detailed branches and vegetation mainly near the upper and lower edges. No text, no UI, no frame, no people, no animals, no buildings, no logos, no neon. Finished atmospheric artwork.
```

### 落日余温最终提示词

```text
Use case: stylized-concept. Asset type: full-bleed portrait background art for an elegant personal journal and budget mobile app, theme named Last Light. Primary request: a gentle sunset atmosphere in warm apricot, peach, dusty rose and creamy ivory. Scene: delicate layers of peach and rose clouds in the upper sky, a small soft golden sun near a distant low mauve hill horizon in the lower quarter, calm reflective lake and fine grasses at the bottom outer edge. Sophisticated hand-painted gouache and watercolor, refined travel-journal feeling with subtle paper grain, luminous but restful evening light. Portrait 2:3. Make the broad center softly luminous, pale and low contrast so readable interface panels can overlay it. Concentrate scenic detail in the top and bottom margins. Avoid saturated orange flooding the whole scene, intense glare, text, logo, people, boats, buildings, frames, UI and icons. Finished illustrated backdrop, no mockup.
```
