package com.nianxiatian.app;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class CloudBackup {
    private static final int JOB = 21807;
    private static final String KEY = "nianxiatian.nutstore";
    private static CloudBackup instance;
    static synchronized CloudBackup get(Context context) {
        if (instance == null) instance = new CloudBackup(context.getApplicationContext());
        return instance;
    }
    final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor();
    private final SharedPreferences prefs;
    private final AtomicFile pending;
    private final Context context;
    private final JobScheduler jobs;
    private ScheduledFuture<?> foreground;
    private long revision;
    private long lastAttempt;
    private String queuedHash = "";

    private CloudBackup(Context app) {
        context = app;
        prefs = app.getSharedPreferences("nutstore", Context.MODE_PRIVATE);
        pending = new AtomicFile(new File(app.getNoBackupFilesDir(), "cloud-pending.json"));
        jobs = (JobScheduler) app.getSystemService(Context.JOB_SCHEDULER_SERVICE);
    }
    private SecretKey key(boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY)) return (SecretKey) store.getKey(KEY, null);
        if (!create) throw new IllegalStateException("请重新连接坚果云");
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private static String encode(byte[] bytes) { return Base64.encodeToString(bytes, Base64.NO_WRAP); }
    private Nutstore client() throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, Base64.decode(prefs.getString("iv", ""), 0)));
        byte[] password = cipher.doFinal(Base64.decode(prefs.getString("secret", ""), 0));
        return new Nutstore(prefs.getString("email", ""), new String(password, StandardCharsets.UTF_8));
    }
    JSONArray connect(String email, String password) throws Exception {
        if (email.isEmpty() || password.isEmpty()) throw new IllegalArgumentException("请填写邮箱和应用密码");
        JSONArray files = new Nutstore(email, password).list(true);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key(true));
        String secret = encode(cipher.doFinal(password.getBytes(StandardCharsets.UTF_8)));
        synchronized (this) {
            disconnect();
            if (!prefs.edit().putString("email", email).putString("iv", encode(cipher.getIV()))
                .putString("secret", secret).commit()) throw new java.io.IOException("无法保存连接设置");
        }
        return files;
    }
    JSONArray list() throws Exception { return client().list(false); }
    String download(String name) throws Exception { return client().download(name); }
    synchronized boolean hasPending() { return !prefs.getBoolean("blocked", false) && prefs.getBoolean("enabled", false) && pending.getBaseFile().exists(); }
    synchronized JSONObject status() throws Exception {
        return new JSONObject().put("email", prefs.getString("email", ""))
            .put("enabled", prefs.getBoolean("enabled", false)).put("last", prefs.getLong("last", 0))
            .put("pending", pending.getBaseFile().exists()).put("error", prefs.getString("error", ""));
    }
    synchronized void pause() {
        prefs.edit().putBoolean("enabled", false).remove("hash").remove("device").remove("error").commit();
        revision++; queuedHash = "";
        jobs.cancel(JOB);
        if (foreground != null) foreground.cancel(false);
        foreground = null;
        pending.delete();
    }
    synchronized void disconnect() { pause(); prefs.edit().clear().commit(); }
    synchronized void enable() throws Exception {
        if (prefs.getString("email", "").isEmpty()) throw new IllegalStateException("请先连接坚果云");
        if (!prefs.getBoolean("enabled", false)) {
            String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            prefs.edit().putBoolean("enabled", true).putString("device", id).commit();
        }
    }

    synchronized void enqueue(String data) throws Exception {
        if (!prefs.getBoolean("enabled", false)) return;
        byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
        String hash = encode(MessageDigest.getInstance("SHA-256").digest(bytes));
        boolean exists = pending.getBaseFile().exists();
        if (!exists && hash.equals(prefs.getString("hash", ""))) return;
        if (!exists || !hash.equals(queuedHash)) {
            FileOutputStream stream = pending.startWrite();
            try { stream.write(bytes); pending.finishWrite(stream); }
            catch (java.io.IOException e) { pending.failWrite(stream); throw e; }
            queuedHash = hash; revision++;
        }
        if (prefs.getBoolean("blocked", false)) return;
        if (jobs.getPendingJob(JOB) == null) {
            jobs.schedule(new JobInfo.Builder(JOB, new ComponentName(context, CloudBackupJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true)
                .setMinimumLatency(60000).setBackoffCriteria(60000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
        }
        if (foreground == null || foreground.isDone()) {
            long delay = Math.max(8000, Math.max(lastAttempt, prefs.getLong("last", 0)) + 60000 - System.currentTimeMillis());
            foreground = worker.schedule(() -> upload(), Math.min(delay, 60000), TimeUnit.MILLISECONDS);
        }
    }

    // All network operations share one worker. A change arriving during a PUT stays queued.
    boolean upload() {
        long captured;
        byte[] data;
        String device;
        synchronized (this) {
            if (!prefs.getBoolean("enabled", false) || prefs.getBoolean("blocked", false)) return false;
            lastAttempt = System.currentTimeMillis();
            captured = revision;
            device = prefs.getString("device", "");
            if (!pending.getBaseFile().exists()) return false;
        }
        try {
            synchronized (this) { data = pending.readFully(); }
            Date now = new Date();
            SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            iso.setTimeZone(TimeZone.getTimeZone("UTC"));
            String day = new SimpleDateFormat("dd", Locale.US).format(now);
            String json = "{\"app\":\"nianxiatian\",\"version\":4,\"exportedAt\":\"" + iso.format(now)
                + "\",\"data\":" + new String(data, StandardCharsets.UTF_8) + "}";
            client().upload("summer-" + device + "-" + day + ".json", json);
            synchronized (this) {
                if (!device.equals(prefs.getString("device", ""))) return false;
                prefs.edit().putLong("last", now.getTime()).remove("error")
                    .putString("hash", encode(MessageDigest.getInstance("SHA-256").digest(data))).commit();
                if (captured != revision) {
                    if (foreground != null) foreground.cancel(false);
                    foreground = worker.schedule(() -> upload(), 60, TimeUnit.SECONDS);
                    return true;
                }
                pending.delete(); queuedHash = "";
                return false;
            }
        } catch (Exception e) {
            synchronized (this) {
                if (!device.equals(prefs.getString("device", ""))) return false;
                if (e instanceof Nutstore.Failure) {
                    int code = ((Nutstore.Failure) e).status;
                    if (code == 401 || code == 403) {
                        prefs.edit().putBoolean("blocked", true).putString("error", "授权已失效，请断开后重新连接").commit();
                        return false;
                    }
                }
                recordError(e);
            }
            return true;
        }
    }
    void recordError(Exception error) {
        prefs.edit().putString("error", errorText(error)).apply();
    }
    static String errorText(Exception e) {
        if (e instanceof Nutstore.Failure || e instanceof IllegalArgumentException || e instanceof IllegalStateException)
            return e.getMessage() == null ? "请检查云备份设置" : e.getMessage();
        return "操作未完成，请检查网络、应用密码或设备存储后重试";
    }
}
