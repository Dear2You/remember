package com.nianxiatian.app;

import android.app.AlarmManager;
import android.app.ActivityManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;
import java.util.TimeZone;

public final class ReminderReceiver extends BroadcastReceiver {
    static final String CHANNEL = "personal_reminders", OPEN = "com.nianxiatian.app.OPEN_REMINDER";
    private static final String FIRE = "com.nianxiatian.app.DUE_REMINDERS";
    private static final String TEST = "test:lockscreen";
    private static final int FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    static NotificationManager notifications(Context c) { return c.getSystemService(NotificationManager.class); }

    static void channel(Context c) {
        if (Build.VERSION.SDK_INT >= 26 && notifications(c).getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL,"待办与备忘提醒",NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("按事项设定的时间通知");
            notifications(c).createNotificationChannel(channel);
        }
    }

    static boolean allowed(Context c) {
        if (!notifications(c).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT < 26) return true;
        NotificationChannel channel = notifications(c).getNotificationChannel(CHANNEL);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    static boolean exact(Context c) {
        return Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("reminders",Context.MODE_PRIVATE);
    }

    private static JSONObject load(Context c) throws JSONException {
        return new JSONObject(prefs(c).getString("rules","{}"));
    }

    private static Set<String> skipped(JSONObject r) {
        Set<String> days = new HashSet<>();
        JSONArray list = r.optJSONArray("doneDates");
        if (list != null) for (int i=0;i<list.length();i++) days.add(list.optString(i));
        return days;
    }

    private static long next(JSONObject r, long after) {
        return ReminderTime.next(r.optString("date"),r.optString("time"),r.optString("repeat"),
                skipped(r),r.optString("lastDay"),after,TimeZone.getDefault());
    }

    private static String localDay(long ms) {
        return ReminderTime.dates(TimeZone.getDefault()).format(new Date(ms));
    }

    static synchronized String status(Context c) {
        SharedPreferences p = prefs(c);
        try {
            return new JSONObject().put("enabled",allowed(c)).put("exact",exact(c))
                    .put("restricted",Build.VERSION.SDK_INT >= 28 && c.getSystemService(ActivityManager.class).isBackgroundRestricted())
                    .put("clockMode",p.getBoolean("clockMode",false)).put("nextAt",p.getLong("scheduledAt",0))
                    .put("mode",p.getString("scheduleMode","")).put("lastDue",p.getLong("lastDue",0))
                    .put("lastPosted",p.getLong("lastPosted",0)).put("lastFailure",p.getLong("lastFailure",0))
                    .put("testAt",p.getLong("testAt",0)).put("testDue",p.getLong("testDue",0))
                    .put("testPosted",p.getLong("testPosted",0)).toString();
        } catch (JSONException e) { throw new IllegalStateException(e); }
    }

    static synchronized void clockMode(Context c, boolean on) throws JSONException {
        prefs(c).edit().putBoolean("clockMode",on).apply();
        persistAndSchedule(c,load(c));
    }

    static synchronized void test(Context c, boolean start) throws JSONException {
        channel(c);
        if (start && !allowed(c)) throw new IllegalStateException("请先开启待办与备忘通知");
        long at = start ? System.currentTimeMillis()+60000L : 0;
        prefs(c).edit().putLong("testAt",at).putLong("testDue",at).remove("testPosted").apply();
        notifications(c).cancel(TEST,1);
        persistAndSchedule(c,load(c));
    }

    // The web store is authoritative. Retain pending instants for unchanged rules, even if
    // Android has deferred delivery. Replacing a backup also removes its obsolete alarms.
    static synchronized void replace(Context c, String json) throws JSONException {
        JSONObject old = load(c), fresh = new JSONObject();
        JSONArray input = new JSONArray(json);
        long now = System.currentTimeMillis();
        for (int i=0;i<input.length();i++) {
            JSONObject r = input.getJSONObject(i);
            String kind = r.getString("kind"), id = r.getString("id");
            if (!(kind.equals("task") || kind.equals("memo")) || id.isEmpty()) continue;
            String key = kind + ":" + id;
            JSONObject prev = old.optJSONObject(key);
            boolean same = prev != null && prev.optString("date").equals(r.optString("date"))
                    && prev.optString("time").equals(r.optString("time")) && prev.optString("repeat").equals(r.optString("repeat"));
            long pending = same ? prev.optLong("next") : 0;
            Set<String> done = skipped(r);
            if (same) r.put("lastDay",prev.optString("lastDay"));
            if (prev != null && (!same || !prev.optString("title").equals(r.optString("title")) || done.contains(prev.optString("lastDay"))))
                notifications(c).cancel(key,1);
            if (pending == 0 || done.contains(localDay(pending)) || (pending > now && !done.equals(skipped(prev)))) pending = next(r,now);
            if (same && pending > 0 && pending == prev.optLong("next")) r.put("retryAt",prev.optLong("retryAt"));
            r.put("next",pending);
            fresh.put(key,r);
        }
        for (java.util.Iterator<String> it=old.keys();it.hasNext();) {
            String key = it.next();
            if (!fresh.has(key)) notifications(c).cancel(key,1);
        }
        if (fresh.length()>0) channel(c);
        persistAndSchedule(c,fresh);
    }

    private static void persistAndSchedule(Context c, JSONObject rules) throws JSONException {
        SharedPreferences settings = prefs(c);
        String json = rules.toString();
        if (!json.equals(settings.getString("rules","{}")) && !settings.edit().putString("rules",json).commit())
            throw new IllegalStateException("Reminder storage unavailable");
        long testAt = settings.getLong("testAt",0);
        long earliest = testAt > 0 ? testAt : Long.MAX_VALUE;
        JSONObject first = null;
        for (java.util.Iterator<String> it=rules.keys();it.hasNext();) {
            JSONObject rule = rules.getJSONObject(it.next());
            long due = rule.optLong("next"), at = Math.max(due,rule.optLong("retryAt"));
            if (due > 0 && at < earliest) { earliest=at; first=rule; }
        }
        AlarmManager alarms = c.getSystemService(AlarmManager.class);
        Intent fire = new Intent(c,ReminderReceiver.class).setAction(FIRE).addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
        PendingIntent alarm = PendingIntent.getBroadcast(c,0,fire,FLAGS);
        String mode = "off";
        if (earliest == Long.MAX_VALUE || !allowed(c)) {
            alarms.cancel(alarm);
            earliest = 0;
        } else {
            if (exact(c)) {
                try {
                    if (settings.getBoolean("clockMode",false)) {
                        PendingIntent info = first == null ? open(c,"test","lockscreen",localDay(testAt))
                                : open(c,first.getString("kind"),first.getString("id"),localDay(first.getLong("next")));
                        alarms.setAlarmClock(new AlarmManager.AlarmClockInfo(earliest,info),alarm);
                        mode = "clock";
                    } else {
                        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,earliest,alarm);
                        mode = "exact";
                    }
                } catch (SecurityException ignored) { /* Access can change while scheduling. */ }
            }
            if ("off".equals(mode)) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,earliest,alarm);
                mode = "normal";
            }
        }
        settings.edit().putLong("scheduledAt",earliest).putString("scheduleMode",mode).apply();
    }

    private static PendingIntent open(Context c, String kind, String id, String date) {
        Uri uri = new Uri.Builder().scheme("nianxiatian").authority("reminder").appendPath(kind).appendPath(id).appendPath(date).build();
        Intent view = new Intent(c,MainActivity.class).setAction(OPEN).setData(uri);
        return PendingIntent.getActivity(c,0,view,FLAGS);
    }

    private static boolean post(Context c, String key, String kind, String id, String title,String text,long due) {
        try {
            if (!allowed(c)) return false;
            PendingIntent tap = open(c,kind,id,localDay(due));
            Notification.Builder n = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c,CHANNEL) : new Notification.Builder(c);
            if (Build.VERSION.SDK_INT < 26) n.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_SOUND);
            n.setSmallIcon(c.getResources().getIdentifier("ic_reminder","drawable",c.getPackageName()))
                    .setContentTitle(title).setContentText(text)
                    .setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE)
                    .setContentIntent(tap).setAutoCancel(true).setWhen(due).setShowWhen(true);
            notifications(c).notify(key,1,n.build());
            prefs(c).edit().putLong("lastDue",due).putLong("lastPosted",System.currentTimeMillis()).remove("lastFailure").apply();
            return true;
        } catch (RuntimeException e) {
            prefs(c).edit().putLong("lastFailure",System.currentTimeMillis()).apply();
            android.util.Log.w("Reminders","Notification was not posted",e);
            return false;
        }
    }

    private static synchronized void receive(Context c, String action) throws JSONException {
        JSONObject rules = load(c);
        boolean clockChanged = Intent.ACTION_TIME_CHANGED.equals(action) || Intent.ACTION_TIMEZONE_CHANGED.equals(action);
        long now = System.currentTimeMillis();
        if (rules.length()>0) channel(c);
        SharedPreferences p = prefs(c);
        long testAt = p.getLong("testAt",0);
        if (testAt > 0 && testAt <= now && allowed(c)) {
            boolean posted = post(c,TEST,"test","lockscreen","锁屏提醒测试","这是你设置的一分钟测试通知",testAt);
            p.edit().remove("testAt").putLong("testPosted",posted ? System.currentTimeMillis() : 0).apply();
        }
        for (java.util.Iterator<String> it=rules.keys();it.hasNext();) {
            String key = it.next();
            JSONObject r = rules.getJSONObject(key);
            long due = r.optLong("next");
            boolean repeating = !"none".equals(r.optString("repeat"));
            if (clockChanged && !repeating && due > 0) {
                due = next(r,0);
                r.put("next",due);
            } else if (repeating && (clockChanged || (due > 0 && due <= now && !localDay(due).equals(localDay(now))))) {
                // Catch today's occurrence after reboot or a wall-clock jump without posting older days in a burst.
                java.util.Calendar start = java.util.Calendar.getInstance();
                start.setTimeInMillis(now);
                start.set(java.util.Calendar.HOUR_OF_DAY,0);
                start.set(java.util.Calendar.MINUTE,0);
                start.set(java.util.Calendar.SECOND,0);
                start.set(java.util.Calendar.MILLISECOND,0);
                due = next(r,start.getTimeInMillis()-1);
                r.put("next",due);
            }
            if (due == 0 || due > now || r.optLong("retryAt") > now || !allowed(c)) continue;
            String date = localDay(due);
            String kind = r.getString("kind");
            if (!post(c,key,kind,r.getString("id"),r.optString("title"),
                    (kind.equals("task") ? "待办" : "备忘") + " · " + date + " " + r.optString("time"),due)) {
                r.put("retryAt",now+15*60000L);
                continue;
            }
            r.remove("retryAt");
            r.put("lastDay",date);
            r.put("next",next(r,now));
        }
        persistAndSchedule(c,rules);
    }

    @Override public void onReceive(Context context, Intent intent) {
        // Post locally before returning, while AlarmManager still holds its delivery wake lock.
        try { receive(context.getApplicationContext(),intent.getAction()); }
        catch (Exception e) { android.util.Log.w("Reminders","Could not process reminder alarm",e); }
    }
}
