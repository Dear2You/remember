package com.nianxiatian.app;

import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

final class ReminderTime {
    private ReminderTime() {}

    static SimpleDateFormat dates(TimeZone zone) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(zone);
        f.setLenient(false);
        return f;
    }

    // Day rules use local calendar dates so a weekly reminder keeps its wall time across DST.
    static long next(String start, String time, String repeat, Set<String> skipped, String lastDay,
                     long after, TimeZone zone) {
        if (!start.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || !time.matches("([01][0-9]|2[0-3]):[0-5][0-9]")) return 0;
        SimpleDateFormat dates = dates(zone);
        Date first = dates.parse(start, new ParsePosition(0));
        if (first == null) return 0;
        Calendar day = Calendar.getInstance(zone);
        day.setTime(first);
        int weekday = day.get(Calendar.DAY_OF_WEEK), monthDay = day.get(Calendar.DAY_OF_MONTH);
        if (day.getTimeInMillis() < after && !"none".equals(repeat)) day.setTimeInMillis(after);
        day.set(Calendar.HOUR_OF_DAY,12);
        int hour = Integer.parseInt(time.substring(0,2)), minute = Integer.parseInt(time.substring(3));
        while (true) {
            String date = dates.format(day.getTime());
            boolean matches;
            switch (repeat) {
                case "daily": case "none": matches = true; break;
                case "weekly": matches = weekday == day.get(Calendar.DAY_OF_WEEK); break;
                case "monthly": matches = monthDay == day.get(Calendar.DAY_OF_MONTH); break;
                default: return 0;
            }
            if (matches && date.compareTo(lastDay) > 0 && !skipped.contains(date)) {
                Calendar at = (Calendar)day.clone();
                at.set(Calendar.HOUR_OF_DAY,hour);
                at.set(Calendar.MINUTE,minute);
                at.set(Calendar.SECOND,0);
                at.set(Calendar.MILLISECOND,0);
                if (at.getTimeInMillis() > after) return at.getTimeInMillis();
            }
            if ("none".equals(repeat)) return 0;
            day.add(Calendar.DATE,1);
        }
    }
}
