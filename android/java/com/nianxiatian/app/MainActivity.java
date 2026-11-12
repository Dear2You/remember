package com.nianxiatian.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {

    private WebView webView;
    private static final int PICK_BACKUP = 1;
    private static final int SAVE_DOCUMENT = 2;
    private android.webkit.ValueCallback<Uri[]> filePicker;
    private String pendingExport;
    private final java.util.concurrent.ExecutorService backupWriter = java.util.concurrent.Executors.newSingleThreadExecutor();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        android.widget.FrameLayout fl = new android.widget.FrameLayout(this);
        fl.addView(webView, new android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(fl);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // localStorage 持久化
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true); // 允许 file:// 页面直接请求接口
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setTextZoom(100);                     // 忽略系统字体缩放
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setDisplayZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // 前端可调用的原生能力：下载 APK 并弹出安装
        webView.addJavascriptInterface(new NativeBridge(), "AndroidBridge");

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setBackgroundColor(0xFFF7FAF8);

        // Android 15+ 强制边缘到边缘：把系统栏高度作为安全衬距（设在容器上，WebView 自身 padding 不可靠）
        final android.widget.FrameLayout container = fl;
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            container.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public android.view.WindowInsets onApplyWindowInsets(View v, android.view.WindowInsets insets) {
                    android.graphics.Insets sys = insets.getInsets(
                            android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
                    v.setPadding(0, sys.top, 0, sys.bottom);
                    return android.view.WindowInsets.CONSUMED;
                }
            });
        } else {
            // API 24-29：fitsSystemWindows 让系统自动留出状态栏
            container.setFitsSystemWindows(true);
        }

        webView.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> result,
                                             FileChooserParams params) {
                if (filePicker != null) filePicker.onReceiveValue(null);
                filePicker = result;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*"); // 文件管理器可能将 JSON 标为纯文本
                try { startActivityForResult(pick, PICK_BACKUP); }
                catch (android.content.ActivityNotFoundException e) {
                    filePicker = null;
                    result.onReceiveValue(null);
                    documentNotice("设备上没有可用的文件选择器");
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && url.startsWith("file://")) return false;
                try {
                    android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_VIEW,
                            android.net.Uri.parse(url));
                    startActivity(i);
                } catch (Exception ignored) { }
                return true;
            }
        });
        webView.loadUrl("file:///android_asset/www/index.html");
        if (android.os.Build.VERSION.SDK_INT >= 30) fl.requestApplyInsets();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // 返回前台时重申请一次安全衬距（横竖屏/分屏切换后也会重算）
        android.widget.FrameLayout fl = (android.widget.FrameLayout) webView.getParent();
        if (fl != null && android.os.Build.VERSION.SDK_INT >= 30) fl.requestApplyInsets();
    }

    private void documentNotice(String message) {
        android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (uri != null && !"content".equals(uri.getScheme())) uri = null;
        if (request == PICK_BACKUP && filePicker != null) {
            filePicker.onReceiveValue(uri == null ? null : new Uri[]{uri});
            filePicker = null;
        } else if (request == SAVE_DOCUMENT) {
            final String content = pendingExport;
            pendingExport = null;
            if (uri == null || content == null) return;
            final Uri target = uri;
            new Thread(() -> {
                try (java.io.OutputStream out = getContentResolver().openOutputStream(target, "wt")) {
                    if (out == null) throw new java.io.IOException();
                    out.write(content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                } catch (Exception e) {
                    runOnUiThread(() -> documentNotice("保存失败，请重新选择位置"));
                    return;
                }
                runOnUiThread(() -> documentNotice("文件已保存"));
            }).start();
        }
    }

    class NativeBridge {
        @JavascriptInterface
        public void saveDocument(String name, String content, boolean csv) {
            runOnUiThread(() -> {
                if (pendingExport != null) return;
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                save.addCategory(Intent.CATEGORY_OPENABLE);
                save.setType(csv ? "text/csv" : "application/json");
                save.putExtra(Intent.EXTRA_TITLE, name);
                pendingExport = content;
                try { startActivityForResult(save, SAVE_DOCUMENT); }
                catch (android.content.ActivityNotFoundException e) {
                    pendingExport = null;
                    documentNotice("设备上没有可用的文件选择器");
                }
            });
        }

        /** 前端主题切换时同步状态栏：深色模式给深底浅字，浅色模式给浅底深字 */
        @JavascriptInterface
        public void setStatusBar(final boolean dark) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        getWindow().setStatusBarColor(dark ? 0xFF19201D : 0xFFF7FAF8);
                        getWindow().setNavigationBarColor(dark ? 0xFF19201D : 0xFFF7FAF8);
                        View decor = getWindow().getDecorView();
                        int vis = decor.getSystemUiVisibility();
                        if (dark) vis &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        else vis |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        decor.setSystemUiVisibility(vis);
                        webView.setBackgroundColor(dark ? 0xFF19201D : 0xFFF7FAF8);
                    } catch (Exception ignored) { }
                }
            });
        }

        /**
         * 自动备份：把完整数据 JSON 写到 公共下载目录/那年夏天备份/nianxiatian-backup.json
         * （MediaStore 方式，API 29+ 免权限；同名覆盖更新。卸载 App 该文件仍在。）
         */
        @JavascriptInterface
        public void writeBackup(final String json) {
            if (android.os.Build.VERSION.SDK_INT < 29) {
                runOnUiThread(new Runnable() { @Override public void run() {
                    webView.loadUrl("javascript:window.__backupDone && window.__backupDone('skip','系统版本过低，请手动导出备份')");
                }});
                return;
            }
            backupWriter.execute(new Runnable() {
                @Override
                public void run() {
                    try {
                        android.content.ContentResolver cr = getContentResolver();
                        final String fname = "nianxiatian-backup.json";
                        android.net.Uri collection = android.provider.MediaStore.Downloads.getContentUri(android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY);
                        // 查同名文件 → 覆盖；没有 → 新建
                        android.net.Uri existing = null;
                        android.database.Cursor c = cr.query(collection, new String[]{android.provider.MediaStore.MediaColumns._ID},
                                android.provider.MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + android.provider.MediaStore.MediaColumns.DISPLAY_NAME + "=?",
                                new String[]{"Download/那年夏天备份/" , fname}, null);
                        if (c != null) { if (c.moveToFirst()) existing = android.content.ContentUris.withAppendedId(collection, c.getLong(0)); c.close(); }
                        byte[] bytes = json.getBytes("UTF-8");
                        if (existing != null) {
                            // 清空后重写（保留原 uri）
                            java.io.OutputStream os = cr.openOutputStream(existing, "wt");
                            os.write(bytes); os.flush(); os.close();
                        } else {
                            android.content.ContentValues cv = new android.content.ContentValues();
                            cv.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, fname);
                            cv.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "application/json");
                            cv.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, "Download/那年夏天备份/");
                            android.net.Uri uri = cr.insert(collection, cv);
                            java.io.OutputStream os = cr.openOutputStream(uri);
                            os.write(bytes); os.flush(); os.close();
                        }
                        runOnUiThread(new Runnable() { @Override public void run() {
                            webView.loadUrl("javascript:window.__backupDone && window.__backupDone('ok','')");
                        }});
                    } catch (final Exception e) {
                        final String msg = org.json.JSONObject.quote(e.toString());
                        runOnUiThread(new Runnable() { @Override public void run() {
                            webView.loadUrl("javascript:window.__backupDone && window.__backupDone('error'," + msg + ")");
                        }});
                    }
                }
            });
        }

        /** 下载 APK 到应用缓存目录，完成后自动弹出系统安装器 */
        @JavascriptInterface
        public void downloadApk(final String urlStr) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    webView.loadUrl("javascript:window.__apkProgress && window.__apkProgress('start')");
                }
            });
            new Thread(new Runnable() {
                @Override
                public void run() {
                    File out = null;
                    try {
                        URL url = new URL(urlStr);
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(30000);
                        conn.setInstanceFollowRedirects(true);
                        if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
                        out = new File(getCacheDir(), "nxt-update.apk");
                        InputStream in = conn.getInputStream();
                        FileOutputStream fos = new FileOutputStream(out);
                        byte[] buf = new byte[16384];
                        int n;
                        while ((n = in.read(buf)) > 0) fos.write(buf, 0, n);
                        fos.close();
                        in.close();
                        // 弹出安装
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    Uri uri = new Uri.Builder().scheme("content")
                                            .authority(getPackageName() + ".apkprovider").build();
                                    Intent it = new Intent(Intent.ACTION_VIEW);
                                    it.setDataAndType(uri, "application/vnd.android.package-archive");
                                    it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                    it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    it.setClipData(android.content.ClipData.newRawUri("apk", uri));
                                    startActivity(it);
                                    webView.loadUrl("javascript:window.__apkProgress && window.__apkProgress('install')");
                                } catch (Exception e) {
                                    toast("打开安装器失败：" + e.getMessage());
                                }
                            }
                        });
                    } catch (final Exception e) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                toast(e.toString());
                            }
                        });
                    }
                }
            }).start();
        }
    }

    private void toast(final String msg) {
        webView.evaluateJavascript("window.__apkProgress && window.__apkProgress(" + org.json.JSONObject.quote("error:" + msg) + ")", null);
    }

    @Override
    public void onBackPressed() {
        // 先尝试关闭网页里的弹层/对话框（JS 返回 true 表示已处理），都关了才后退/退出
        webView.evaluateJavascript("(window.__tryCloseOverlays ? window.__tryCloseOverlays() : false)", new android.webkit.ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                final boolean closed = "true".equals(value == null ? "" : value.trim());
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (closed) return;
                        if (webView != null && webView.canGoBack()) webView.goBack();
                        else finish();
                    }
                });
            }
        });
    }

    @Override
    protected void onDestroy() {
        backupWriter.shutdown();
        if (filePicker != null) filePicker.onReceiveValue(null);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
