# 背景插画原稿

这里保留七张 PNG 原图，文件内容与 v2.40 的 `app/images/` 原件一致。此目录不在 `app/` 下，不会进入 APK。当前运行资源是 `app/images/` 中同名的 WebP；旧的 `summer-lake.webp` 已是压缩格式，保持原件。

v3.0 使用 Sharp 0.35.5 / libwebp 1.6.0，质量95、effort6、smartSubsample=true，无裁切、缩放或新绘制。七张原稿合计15,226,644字节，输出合计2,035,254字节。属于高质量有损压缩，不应称作无损；各文件的分辨率、原图和输出大小、SHA-256见 [compression.json](compression.json)。

## 重新导出

日常构建不需要图片编码器，会直接打包已提交的 WebP。需要重新生成时，在仓库根目录执行：

```powershell
npm install --prefix build/image-tools --no-save sharp@0.35.5
node tools/compress-backgrounds.js
node tools/compress-backgrounds.js --check
```

脚本总是读取本目录的 PNG，不能改成从已有 WebP 再次压缩。修改导出参数后，更新大小和质量记录，目视比较星空渐变、水墨纸纹、树枝与科技建筑细线，并检查六套主题的实际页面。原始生成提示词见 `docs/themes.md`、`docs/starry-theme.md` 和 `docs/design-assets.md`。
