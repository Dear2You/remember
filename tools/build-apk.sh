#!/usr/bin/env bash
# ============ 那年夏天 APK 一键构建脚本 ============
# 用法: bash tools/build-apk.sh [版本号，默认 1.0]
# 依赖: build/toolchain/{jdk, android-sdk}（首次由本仓库说明安装），node 用于生成图标
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TC="$ROOT/build/toolchain"
JDK="$TC/jdk"
SDK="$TC/android-sdk"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-35/android.jar"
WORK="$ROOT/build/work"
VERSION_NAME="${1:-1.0}"
if [[ ! "$VERSION_NAME" =~ ^([0-9]{1,4})\.([0-9]{1,2})(\.([0-9]{1,2}))?$ ]]; then
  echo "版本格式应为 主.次 或 主.次.修订" >&2
  exit 1
fi
PATCH_PART="${BASH_REMATCH[4]:-0}"
VERSION_CODE=$((10#${BASH_REMATCH[1]} * 10000 + 10#${BASH_REMATCH[2]} * 100 + 10#$PATCH_PART))

OUT_APK="$ROOT/那年夏天-v$VERSION_NAME.apk"
KEYSTORE="$ROOT/android/keystore.jks"
KS_PASS="nianxiatian-sign-2026"

echo "== 0/7 检查工具链 =="
[ -f "$JDK/bin/javac.exe" ] || [ -f "$JDK/bin/javac" ] || { echo "❌ 缺少 JDK: $JDK"; exit 1; }
[ -f "$PLATFORM" ] || { echo "❌ 缺少 Android platform-35，请先运行 sdkmanager 安装（见 README）"; exit 1; }
[ -f "$BT/aapt2.exe" ] || [ -f "$BT/aapt2" ] || { echo "❌ 缺少 build-tools 34.0.0"; exit 1; }
export JAVA_HOME="$JDK"
JAVA="$JDK/bin/java.exe"; [ -f "$JAVA" ] || JAVA="$JDK/bin/java"
AAPT2="$BT/aapt2.exe"; [ -f "$AAPT2" ] || AAPT2="$BT/aapt2"
ZIPALIGN="$BT/zipalign.exe"; [ -f "$ZIPALIGN" ] || ZIPALIGN="$BT/zipalign"
D8_CP="$BT/lib/d8.jar"
APKSIGNER_CP="$BT/lib/apksigner.jar"
KEYTOOL="$JDK/bin/keytool.exe"; [ -f "$KEYTOOL" ] || KEYTOOL="$JDK/bin/keytool"
echo "   JDK/SDK 就绪"

echo "== 1/7 生成图标 =="
node "$ROOT/tools/gen-icons.js"

echo "== 2/7 准备资源 =="
rm -rf "$WORK"
mkdir -p "$WORK/assets/www" "$WORK/classes" "$WORK/dex" "$WORK/compiled"
# 前端完整复制进 assets/www
cp -r "$ROOT/app/." "$WORK/assets/www/"
# 注入版本号（更新功能对比用）
ROOT_W=$(cygpath -w "$ROOT"); WORK_W=$(cygpath -w "$WORK")
node -e "
const fs = require('fs');
const f = process.argv[1] + '\\\\assets\\\\www\\\\index.html';
fs.writeFileSync(f, fs.readFileSync(f, 'utf8')
  .replace(/window\.__APP_VERSION = '[^']*'/, \"window.__APP_VERSION = '$VERSION_NAME'\")
  .replace(/window\.__APP_CODE = \d+/, 'window.__APP_CODE = $VERSION_CODE'));
" "$WORK_W"
# 生成 latest.json（应用内检查更新的清单）+ 固定路径 apk 副本
# note 经临时文件传 UTF-8，避免 Windows 环境变量 GBK 乱码
printf '%s' "${UPDATE_NOTE:-例行更新}" > "$WORK/note.txt"
node -e "
const fs = require('fs');
const root = process.argv[1], work = process.argv[2];
fs.mkdirSync(root + '\\\\apk', { recursive: true });
let note = '例行更新';
try { note = fs.readFileSync(work + '\\\\note.txt', 'utf8') || note; } catch (e) {}
const cfg = {
  versionCode: $VERSION_CODE, versionName: '$VERSION_NAME',
  apkUrl: 'https://raw.githubusercontent.com/Dear2You/remember/main/apk/nianxiatian.apk?v=$VERSION_CODE',
  note: note
};
fs.writeFileSync(root + '\\\\latest.json', JSON.stringify(cfg, null, 2));
console.log('   latest.json -> v' + cfg.versionName);
" "$ROOT_W" "$WORK_W"
ls "$WORK/assets/www" > /dev/null && echo "   前端资源 $(find "$WORK/assets/www" -type f | wc -l) 个文件"

echo "== 3/7 编译 Java =="
"$JDK/bin/javac.exe" --release 8 -encoding UTF-8 -cp "$PLATFORM" -d "$WORK/classes" "$ROOT"/android/java/com/nianxiatian/app/*.java
[ -f "$WORK/classes/com/nianxiatian/app/MainActivity.class" ] || { echo "❌ javac 编译失败"; exit 1; }
echo "   MainActivity.class OK"

echo "== 4/7 打包 DEX =="
"$JAVA" -cp "$D8_CP" com.android.tools.r8.D8 --release --lib "$PLATFORM" --min-api 24 \
  --output "$WORK/dex" $(find "$WORK/classes" -name "*.class")
[ -f "$WORK/dex/classes.dex" ] || { echo "❌ D8 失败"; exit 1; }
echo "   classes.dex OK"

echo "== 5/7 aapt2 打包资源 =="
"$AAPT2" compile --dir "$ROOT/android/res" -o "$WORK/compiled/res.zip"
"$AAPT2" link -o "$WORK/base.apk" \
  -I "$PLATFORM" \
  --manifest "$ROOT/android/AndroidManifest.xml" \
  --min-sdk-version 24 --target-sdk-version 35 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --auto-add-overlay \
  "$WORK/compiled/res.zip"
[ -f "$WORK/base.apk" ] || { echo "❌ aapt2 link 失败"; exit 1; }
echo "   base.apk $(du -h "$WORK/base.apk" | cut -f1)"

echo "== 6/7 合入 DEX + 前端资产（repack 保证 arsc 未压缩 + 正斜杠路径）+ 对齐 =="
rm -rf "$WORK/unpack" && mkdir -p "$WORK/unpack"
cd "$WORK/unpack"
"$JDK/bin/jar.exe" -xf "$WORK/base.apk"
mkdir -p assets
cp -r "$WORK/assets/www" assets/
cp "$WORK/dex/classes.dex" .
# node 重打包：resources.arsc 必须 STORED（Android 11+ 安装器强制），其余 DEFLATE
node "$ROOT/tools/repack.js" "$WORK/unpack" "$WORK/full.apk"
cd "$ROOT"
BAD=$(unzip -l "$WORK/full.apk" | grep -c '\\' || true)
[ "$BAD" = "0" ] || { echo "❌ zip 内存在反斜杠路径条目"; exit 1; }
ARSC=$(unzip -v "$WORK/full.apk" | grep resources.arsc | grep -c Stored || true)
[ "$ARSC" = "1" ] || { echo "❌ resources.arsc 未以 STORED 存储（Android 11+ 将拒绝安装）"; exit 1; }
"$ZIPALIGN" -f 4 "$WORK/full.apk" "$WORK/aligned.apk"

echo "== 7/7 签名 =="
if [ ! -f "$KEYSTORE" ]; then
  echo "   生成签名密钥（请妥善保管 keystore.jks（那年夏天专属签名，勿上传勿丢失），升级安装需要它）"
  "$KEYTOOL" -genkeypair -keystore "$KEYSTORE" -alias nianxiatian \
    -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=NianXiaTian, OU=Personal, O=NianXiaTian, L=Local, ST=Local, C=CN"
fi
"$JAVA" -cp "$APKSIGNER_CP" com.android.apksigner.ApkSignerTool sign \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --ks "$KEYSTORE" --ks-key-alias nianxiatian \
  --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$OUT_APK" "$WORK/aligned.apk"
"$JAVA" -cp "$APKSIGNER_CP" com.android.apksigner.ApkSignerTool verify --print-certs "$OUT_APK" | head -4

echo ""
cp -f "$OUT_APK" "$ROOT/apk/nianxiatian.apk"
echo "✅ 构建完成: $OUT_APK ($(du -h "$OUT_APK" | cut -f1)) | 更新包: apk/nianxiatian.apk + latest.json（记得 git push 发布更新）"
