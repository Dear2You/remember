package com.nianxiatian.app;

import android.content.Intent;
import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Events;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

final class SystemReminderIntents {
    private SystemReminderIntents() {}

    static Intent clock(String title, String date, String time, long now, TimeZone zone) {
        String today = ReminderTime.dates(zone).format(new Date(now));
        long at = ReminderTime.next(today,time,"daily",Collections.emptySet(),"",now,zone);
        if (at == 0 || !ReminderTime.dates(zone).format(new Date(at)).equals(date))
            throw new IllegalArgumentException("时钟仅接收最近一次这个时刻，指定日期可交给手机日历");
        return new Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_MESSAGE,title)
                .putExtra(AlarmClock.EXTRA_HOUR,Integer.parseInt(time.substring(0,2)))
                .putExtra(AlarmClock.EXTRA_MINUTES,Integer.parseInt(time.substring(3)))
                .putExtra(AlarmClock.EXTRA_SKIP_UI,false);
    }

    static Intent calendar(String title, String date, String time, String repeat, Set<String> done,
                           long now, TimeZone zone) {
        long at = ReminderTime.next(date,time,repeat,done,"",now,zone);
        if (at == 0) throw new IllegalArgumentException("请选择未来的日历提醒时间");
        Intent draft = new Intent(Intent.ACTION_INSERT,Events.CONTENT_URI)
                .putExtra(Events.TITLE,title)
                .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME,at)
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME,at + 60000L)
                .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY,false)
                .putExtra(Events.AVAILABILITY,Events.AVAILABILITY_FREE);
        if (!"none".equals(repeat)) draft.putExtra(Events.RRULE,"FREQ=" + repeat.toUpperCase(Locale.US));
        return draft;
    }
}
