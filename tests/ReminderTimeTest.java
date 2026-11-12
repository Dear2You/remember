package com.nianxiatian.app;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.Set;
import java.util.TimeZone;

public final class ReminderTimeTest {
    private static long at(String date, String zone) {
        return LocalDateTime.parse(date).atZone(ZoneId.of(zone)).toInstant().toEpochMilli();
    }

    private static void check(String start, String time, String repeat, Set<String> done, String last,
                              String after, String expected, String zone) {
        long result = ReminderTime.next(start,time,repeat,done,last,at(after,zone),TimeZone.getTimeZone(zone));
        if (result != (expected.isEmpty() ? 0 : at(expected,zone))) throw new AssertionError(start+" "+repeat+" after "+after+": "+result);
    }

    public static void main(String[] args) {
        Set<String> none = Collections.emptySet();
        String sh = "Asia/Shanghai";
        check("2026-11-12","09:00","none",none,"","2026-11-11T18:00","2026-11-12T09:00",sh);
        check("2026-11-12","09:00","none",none,"","2026-11-12T09:00","",sh);
        check("2026-11-11","09:00","daily",Collections.singleton("2026-11-12"),"","2026-11-11T23:59","2026-11-13T09:00",sh);
        check("2026-01-31","09:00","monthly",none,"","2026-02-10T08:00","2026-03-31T09:00",sh);
        check("2026-03-01","09:00","weekly",none,"","2026-03-01T09:01","2026-03-08T09:00","America/New_York");
        check("2026-11-12","09:00","daily",none,"2026-11-12","2026-11-12T08:30","2026-11-13T09:00",sh);
        check("2026-02-30","09:00","daily",none,"","2026-02-01T08:00","",sh);
        System.out.println("Reminder recurrence and local-time checks passed");
    }
}
