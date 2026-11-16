# 主题与配色（v2.37）

在「我的 → 显示」使用「界面主题」和「主题配色」两个下拉框。平时只显示当前选项，点击才打开列表，不再排列主题预览图或色块。当前六套场景：水墨清夏、星空彼岸、碧海晴空、未来回响、松间晨雾、落日余温；每个场景独立保存原配／海蓝／青绿／雾紫／胭粉／暖杏。背景保持原画，界面表面和点缀随所选配色改变。

## 存储与维护

- `settings.visualStyle` 保存场景，`settings.themePalettes` 是以场景 ID 为键的配色字典。旧数据缺少字段、未知场景／配色会安全回退。完整备份保留偏好。
- `settings.theme` 保留用户的明暗选择。星空和未来固定夜色，水墨、海岸、森林和落日可跟随系统／浅色／深色；切换夜景不会覆盖明暗偏好。
- `appearance.js` 解析有效外观；`themes.css` 提供各场景及配色 token；`starry.css` 保留星空默认变量，并与其他非水墨场景共用面板规则。
- 收入和支出使用独立语义色，不随按钮点缀色互换。分类占比色块只区分类别。
- `MainActivity.setThemeColors` 只接受六位十六进制颜色，前端从实际 CSS 底色同步状态栏、导航栏与 WebView 边缘，保留旧桥接兼容。
- Canvas 图表保存可重绘参数，明暗变化时重绘颜色，移除已离开页面的画布引用。设置页切主题只更新选中态，保留未保存表单与焦点。
- 下拉控件保留原生键盘及系统选项列表；若保存失败，回退设置值与两个下拉框，保持现有界面，不显示未保存的选择。说明文字随当前主题更新。
- `art.js` 提供内联 SVG，主要导航及常用操作按场景绘制不同几何造型，其他分类和账户共用可辨识的物件轮廓与场景边饰。`appearance.js` 更新现有矢量内容，避免固定底栏仍停留在旧主题；保留自定义图标及保存的数据。
- `theme-details.css` 负责图标笔触、边饰、图表纹理和细节，不引入远程图片、动画或额外字体。v2.37 沿用已有背景，新增图标为代码矢量绘制，未生成新位图。

## 图表风格与准确性

| 主题 | 图标语言 | 折线 / 柱图 | 环形图 |
| --- | --- | --- | --- |
| 水墨清夏 | 纸页、印角与柔和笔触 | 方形选点、笔纹直柱 | 断续墨环与小印记 |
| 星空彼岸 | 星轨线框与连点 | 星形选点、真实节点、细光柱 | 轨道外圈与星点 |
| 碧海晴空 | 圆润海玻璃、海浪细线 | 平滑曲线、气泡选点、波纹柱 | 波纹外圈 |
| 未来回响 | 切角面板、方括角与线框 | 菱形选点、网格、分节柱 | 仪表刻度、窄环 |
| 松间晨雾 | 木屋、枝叶、植物手账 | 叶形选点、木纹细柱 | 年轮和叶片 |
| 落日余温 | 拱形小物、晚霞明信片 | 平滑曲线、太阳选点、圆顶柱 | 半圈暮光与地平线细节 |

海岸、落日的面积曲线使用两端水平切线的贝塞尔线段，控制点高度只取真实端点，不生成超过两端的新峰值。其他主题连接真实数值；柱图纹理约束在实际值柱内。环形装饰在扇区之外，扇区角度按金额比例计算。图例与色块共用 CSS 色值；整数分金额、统计口径、隐藏金额行为不变。

`Charts.skin` 集中环宽、标记及柱形参数；环形图绘制后记录几何信息，`donutIndex` 将触点换算到实际绘制坐标，避免旧的固定半径导致不同主题边缘误判。圆心、装饰与扇区空隙不点选。ResizeObserver 在画布宽度变化时重绘，清理脱离页面的观察；无该 API 时仍可正常初次绘制及主题重绘。对应回归见 `tests/charts.test.js`。

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
