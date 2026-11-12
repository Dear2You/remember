package com.nianxiatian.app;

import android.app.AlarmManager;
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
        long earliest = Long.MAX_VALUE;
        for (java.util.Iterator<String> it=rules.keys();it.hasNext();) {
            long at = rules.getJSONObject(it.next()).optLong("next");
            if (at > 0) earliest = Math.min(earliest,at);
        }
        AlarmManager alarms = c.getSystemService(AlarmManager.class);
        PendingIntent alarm = PendingIntent.getBroadcast(c,0,new Intent(c,ReminderReceiver.class).setAction(FIRE),FLAGS);
        if (earliest == Long.MAX_VALUE || !allowed(c)) { alarms.cancel(alarm); return; }
        if (exact(c)) {
            try { alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,earliest,alarm); return; }
            catch (SecurityException ignored) { /* Special access can change while scheduling. */ }
        }
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,earliest,alarm);
    }

    private static void post(Context c, String key, JSONObject r, String date) {
        String kind = r.optString("kind"), id = r.optString("id");
        Uri uri = new Uri.Builder().scheme("nianxiatian").authority("reminder").appendPath(kind).appendPath(id).appendPath(date).build();
        Intent view = new Intent(c,MainActivity.class).setAction(OPEN).setData(uri);
        PendingIntent tap = PendingIntent.getActivity(c,0,view,FLAGS);
        Notification.Builder n = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c,CHANNEL) : new Notification.Builder(c);
        if (Build.VERSION.SDK_INT < 26) n.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_SOUND);
        n.setSmallIcon(c.getResources().getIdentifier("ic_reminder","drawable",c.getPackageName()))
                .setContentTitle(r.optString("title")).setContentText((kind.equals("task") ? "待办" : "备忘") + " · " + date + " " + r.optString("time"))
                .setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE)
                .setContentIntent(tap).setAutoCancel(true).setWhen(r.optLong("next")).setShowWhen(true);
        notifications(c).notify(key,1,n.build());
    }

    private static synchronized void receive(Context c, String action) throws JSONException {
        JSONObject rules = load(c);
        boolean clockChanged = Intent.ACTION_TIME_CHANGED.equals(action) || Intent.ACTION_TIMEZONE_CHANGED.equals(action);
        long now = System.currentTimeMillis();
        if (rules.length()>0) channel(c);
        for (java.util.Iterator<String> it=rules.keys();it.hasNext();) {
            String key = it.next();
            JSONObject r = rules.getJSONObject(key);
            long due = r.optLong("next");
            if (clockChanged || (due > 0 && due <= now && !localDay(due).equals(localDay(now)))) {
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
            if (due == 0 || due > now) continue;
            String date = localDay(due);
            if (allowed(c) && date.equals(localDay(now))) {
                try { post(c,key,r,date); } catch (SecurityException ignored) { }
            }
            r.put("lastDay",date);
            r.put("next",next(r,now));
        }
        persistAndSchedule(c,rules);
    }

    @Override public void onReceive(Context context, Intent intent) {
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try { receive(context.getApplicationContext(),intent.getAction()); }
            catch (Exception e) { android.util.Log.w("Reminders","Could not restore reminders",e); }
            finally { pending.finish(); }
        }).start();
    }
}
