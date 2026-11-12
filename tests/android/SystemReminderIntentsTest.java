package com.nianxiatian.app;

import android.content.Intent;
import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Events;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.TimeZone;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class SystemReminderIntentsTest {
    private final TimeZone zone = TimeZone.getTimeZone("Asia/Shanghai");
    private long at(String local) {
        return LocalDateTime.parse(local).atZone(zone.toZoneId()).toInstant().toEpochMilli();
    }

    @Test public void futureMemoOpensCalendarEditorAtRequestedTime() {
        Intent draft = SystemReminderIntents.calendar("交电费","2027-01-05","09:15","none",
                Collections.emptySet(),at("2026-11-12T16:00"),zone);
        assertEquals(Intent.ACTION_INSERT,draft.getAction());
        assertEquals(Events.CONTENT_URI,draft.getData());
        assertEquals("交电费",draft.getStringExtra(Events.TITLE));
        assertEquals(at("2027-01-05T09:15"),draft.getLongExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME,0));
        assertEquals(at("2027-01-05T09:16"),draft.getLongExtra(CalendarContract.EXTRA_EVENT_END_TIME,0));
        assertFalse(draft.getBooleanExtra(CalendarContract.EXTRA_EVENT_ALL_DAY,true));
        assertFalse(draft.hasExtra(Events.RRULE));
        assertFalse(draft.hasExtra(Events.DESCRIPTION));
    }

    @Test public void seriesStartsAtNextUnfinishedOccurrence() {
        Intent draft = SystemReminderIntents.calendar("周会","2026-11-05","10:00","weekly",
                Collections.singleton("2026-11-12"),at("2026-11-12T09:00"),zone);
        assertEquals("FREQ=WEEKLY",draft.getStringExtra(Events.RRULE));
        assertEquals(at("2026-11-19T10:00"),draft.getLongExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME,0));
    }

    @Test public void externalClockHandlesMidnightAndRefusesWrongDate() {
        long now=at("2026-11-12T23:59:30");
        Intent clock=SystemReminderIntents.clock("试响","2026-11-13","00:01",now,zone);
        assertEquals(AlarmClock.ACTION_SET_ALARM,clock.getAction());
        assertEquals(0,clock.getIntExtra(AlarmClock.EXTRA_HOUR,-1));
        assertEquals(1,clock.getIntExtra(AlarmClock.EXTRA_MINUTES,-1));
        assertFalse(clock.getBooleanExtra(AlarmClock.EXTRA_SKIP_UI,true));
        assertThrows(IllegalArgumentException.class,()->SystemReminderIntents.clock("试响","2026-11-15","00:01",now,zone));
        assertThrows(IllegalArgumentException.class,()->SystemReminderIntents.calendar("旧备忘","2026-11-12","09:00","none",
                Collections.emptySet(),now,zone));
    }
}
