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

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        setContentView(webView);

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
    }

    class NativeBridge {
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
            new Thread(new Runnable() {
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
                            java.io.OutputStream os = cr.openOutputStream(existing, "w");
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
                        final String msg = e.getMessage() == null ? "unknown" : e.getMessage().replace("'", "");
                        runOnUiThread(new Runnable() { @Override public void run() {
                            webView.loadUrl("javascript:window.__backupDone && window.__backupDone('error','" + msg + "')");
                        }});
                    }
                }
            }).start();
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
                                webView.loadUrl("javascript:window.__apkProgress && window.__apkProgress('error:" + e.getMessage().replace("'", "") + "')");
                            }
                        });
                    }
                }
            }).start();
        }
    }

    private void toast(final String msg) {
        webView.loadUrl("javascript:window.__apkProgress && window.__apkProgress('error:" + msg.replace("'", "") + "')");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
