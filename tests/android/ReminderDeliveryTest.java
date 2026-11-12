package com.nianxiatian.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Looper;
import java.time.Duration;
import java.util.Date;
import java.util.TimeZone;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlarmManager;
import org.robolectric.shadows.ShadowNotificationManager;
import static org.junit.Assert.*;

/** Run with Robolectric and the application's packaged resources and merged manifest. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class ReminderDeliveryTest {
    private final Context app = RuntimeEnvironment.getApplication();
    private final AlarmManager alarms = app.getSystemService(AlarmManager.class);
    private final ShadowNotificationManager notifications = Shadows.shadowOf(app.getSystemService(NotificationManager.class));
    private final SharedPreferences store = app.getSharedPreferences("reminders",0);

    @Test public void lockscreenTestUsesManifestReceiverWithoutActivityOrWebView() throws Exception {
        notifications.setNotificationsEnabled(true);
        ShadowAlarmManager.setCanScheduleExactAlarms(true);
        ReminderReceiver.clockMode(app,true);
        ReminderReceiver.test(app,true);
        long due = store.getLong("testAt",0);
        assertEquals(due,alarms.getNextAlarmClock().getTriggerTime());
        ShadowAlarmManager manager = Shadows.shadowOf(alarms);
        PendingIntent fire = manager.peekNextScheduledAlarm().operation;
        Intent intent = Shadows.shadowOf(fire).getSavedIntent();
        assertNotNull(app.getPackageManager().getReceiverInfo(intent.getComponent(),0));
        ReminderReceiver.replace(app,"[]");
        assertEquals(due,store.getLong("testAt",0));
        // Move the native test deadline into the past, then deliver the real broadcast token.
        // No Activity or JavaScript is started between registration and notification delivery.
        store.edit().putLong("testAt",System.currentTimeMillis()-10).apply();
        manager.fireAlarm(manager.peekNextScheduledAlarm());
        Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(100));
        Notification n=notifications.getNotification("test:lockscreen",1);
        assertNotNull(n);
        assertEquals("锁屏提醒测试",n.extras.getString(Notification.EXTRA_TITLE));
        assertTrue(store.getLong("testPosted",0)>0);
        assertNull(alarms.getNextAlarmClock());
        assertNull(Shadows.shadowOf(RuntimeEnvironment.getApplication()).getNextStartedActivity());
    }

    @Test public void deniedNotificationAndOvernightDelayDoNotConsumeMemo() throws Exception {
        long due=System.currentTimeMillis()-86400000L;
        String day=ReminderTime.dates(TimeZone.getDefault()).format(new Date(due));
        JSONObject memo=new JSONObject().put("id","late").put("kind","memo").put("title","过期备忘")
                .put("repeat","none").put("date",day).put("time","09:00").put("next",due);
        store.edit().putString("rules",new JSONObject().put("memo:late",memo).toString()).commit();
        ReminderReceiver receiver=new ReminderReceiver();
        Intent boot=new Intent(Intent.ACTION_BOOT_COMPLETED);
        notifications.setNotificationsEnabled(false);
        receiver.onReceive(app,boot);
        assertNull(notifications.getNotification("memo:late",1));
        assertEquals(due,new JSONObject(store.getString("rules","")).getJSONObject("memo:late").getLong("next"));
        notifications.setNotificationsEnabled(true);
        receiver.onReceive(app,boot);
        assertNotNull(notifications.getNotification("memo:late",1));
        assertEquals(0,new JSONObject(store.getString("rules","")).getJSONObject("memo:late").getLong("next"));
        app.getSystemService(NotificationManager.class).cancel("memo:late",1);
        receiver.onReceive(app,boot);
        assertNull(notifications.getNotification("memo:late",1));
    }

    @Test public void clockPreferenceFallsBackWithoutExactAccessAndTestCanBeCancelled() throws Exception {
        notifications.setNotificationsEnabled(true);
        ShadowAlarmManager.setCanScheduleExactAlarms(false);
        ReminderReceiver.clockMode(app,true);
        ReminderReceiver.test(app,true);
        assertEquals("normal",new JSONObject(ReminderReceiver.status(app)).getString("mode"));
        assertNull(alarms.getNextAlarmClock());
        ShadowAlarmManager.setCanScheduleExactAlarms(true);
        new ReminderReceiver().onReceive(app,new Intent(AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED));
        assertNotNull(alarms.getNextAlarmClock());
        ReminderReceiver.test(app,false);
        assertNull(alarms.getNextAlarmClock());
        assertTrue(Shadows.shadowOf(alarms).getScheduledAlarms().isEmpty());
    }
}
