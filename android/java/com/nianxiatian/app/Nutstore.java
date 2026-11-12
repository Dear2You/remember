package com.nianxiatian.app;

import android.util.Base64;
import android.util.Xml;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpEntityEnclosingRequestBase;
import org.apache.http.entity.ByteArrayEntity;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.params.HttpConnectionParams;
import org.apache.http.params.BasicHttpParams;
import org.json.JSONArray;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Locale;

// Use Android's platform HTTP client for the WebDAV methods MKCOL and PROPFIND.
@SuppressWarnings("deprecation")
final class Nutstore {
    private static final URI DIRECTORY = URI.create("https://dav.jianguoyun.com/dav/NianXiaTian/");
    private static final String NAME = "summer-[a-f0-9]{12}-[0-3][0-9]\\.json";
    private final String auth;

    Nutstore(String email, String password) {
        auth = "Basic " + Base64.encodeToString((email + ":" + password).getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
    }

    static final class Failure extends IOException {
        final int status;
        Failure(int status) {
            super(status == 401 || status == 403 ? "坚果云拒绝访问，请检查账号和应用密码"
                : status == 429 ? "坚果云请求过于频繁，稍后重试"
                : status == 507 ? "坚果云空间或流量不足" : "坚果云请求失败（HTTP " + status + "）");
            this.status = status;
        }
    }

    private String request(String method, String name, String body) throws Exception {
        if (!name.isEmpty() && !name.matches(NAME)) throw new IOException("无效的备份文件名");
        BasicHttpParams params = new BasicHttpParams();
        HttpConnectionParams.setConnectionTimeout(params, 12000);
        HttpConnectionParams.setSoTimeout(params, 25000);
        params.setBooleanParameter("http.protocol.handle-redirects", false);
        DefaultHttpClient client = new DefaultHttpClient(params);
        // A lost response must not cause a silent replay of a state-changing request.
        client.setHttpRequestRetryHandler((error, count, context) -> false);
        URI uri = name.isEmpty() ? DIRECTORY : DIRECTORY.resolve(name);
        try {
            for (int redirect = 0; redirect < 4; redirect++) {
                HttpEntityEnclosingRequestBase req = new HttpEntityEnclosingRequestBase() {
                    @Override public String getMethod() { return method; }
                };
                req.setURI(uri);
                if (DIRECTORY.getAuthority().equalsIgnoreCase(uri.getAuthority())) req.setHeader("Authorization", auth);
                if ("PROPFIND".equals(method)) req.setHeader("Depth", "1");
                if (body != null) {
                    ByteArrayEntity entity = new ByteArrayEntity(body.getBytes(StandardCharsets.UTF_8));
                    entity.setContentType("PROPFIND".equals(method) ? "application/xml; charset=utf-8" : "application/json; charset=utf-8");
                    req.setEntity(entity);
                }
                HttpResponse response = client.execute(req);
                int code = response.getStatusLine().getStatusCode();
                if ("GET".equals(method) && code >= 300 && code < 400 && response.getFirstHeader("Location") != null) {
                    uri = uri.resolve(response.getFirstHeader("Location").getValue());
                    req.abort();
                    if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getUserInfo() != null) throw new IOException("下载地址无效");
                    continue;
                }
                if (code < 200 || code >= 300) throw new Failure(code);
                HttpEntity entity = response.getEntity();
                if (entity == null || "PUT".equals(method) || "MKCOL".equals(method)) return "";
                try (InputStream in = entity.getContent(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int n;
                    while ((n = in.read(buffer)) != -1) {
                        if (out.size() + n > 32 * 1024 * 1024) throw new IOException("备份过大，请从网盘下载后导入");
                        out.write(buffer, 0, n);
                    }
                    return out.toString("UTF-8");
                }
            }
            throw new IOException("下载重定向次数过多");
        } finally { client.getConnectionManager().shutdown(); }
    }

    JSONArray list(boolean create) throws Exception {
        String props = "<D:propfind xmlns:D=\"DAV:\"><D:prop><D:getlastmodified/></D:prop></D:propfind>";
        String xml;
        try { xml = request("PROPFIND", "", props); }
        catch (Failure e) {
            if (!create || e.status != 404) throw e;
            try { request("MKCOL", "", null); }
            catch (Failure race) { if (race.status != 405) throw race; }
            xml = request("PROPFIND", "", props);
        }
        XmlPullParser parser = Xml.newPullParser();
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true);
        parser.setInput(new StringReader(xml));
        ArrayList<JSONObject> files = new ArrayList<>();
        String name = "";
        long modified = 0;
        SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US);
        boolean multistatus = false;
        for (int event = parser.next(); event != XmlPullParser.END_DOCUMENT; event = parser.next()) {
            if (event != XmlPullParser.START_TAG && event != XmlPullParser.END_TAG) continue;
            if (!"DAV:".equals(parser.getNamespace())) continue;
            String tag = parser.getName();
            if (event == XmlPullParser.START_TAG) {
                if ("multistatus".equals(tag)) multistatus = true;
                if ("response".equals(tag)) { name = ""; modified = 0; }
                if ("href".equals(tag)) {
                    String href = parser.nextText().trim();
                    name = href.substring(href.lastIndexOf('/') + 1);
                }
                if ("getlastmodified".equals(tag)) {
                    String value = parser.nextText().trim();
                    try { modified = format.parse(value).getTime(); }
                    catch (java.text.ParseException ignored) { }
                }
            } else if (event == XmlPullParser.END_TAG && "response".equals(tag) && name.matches(NAME)) {
                files.add(new JSONObject().put("name", name).put("modified", modified));
            }
        }
        if (!multistatus) throw new IOException("坚果云返回了无法识别的目录");
        files.sort((a, b) -> Long.compare(b.optLong("modified"), a.optLong("modified")));
        return new JSONArray(files);
    }

    String download(String name) throws Exception { return request("GET", name, null); }
    void upload(String name, String json) throws Exception { request("PUT", name, json); }
}
