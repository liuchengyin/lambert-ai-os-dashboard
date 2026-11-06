package app.lambert.tasks;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.CalendarContract;
import android.widget.Toast;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import org.json.JSONException;
import org.json.JSONObject;

final class CalendarEventEditor {
    private CalendarEventEditor() {}

    static Intent createIntent(String payload) throws JSONException {
        if (payload == null || payload.length() > 4096) {
            throw new IllegalArgumentException("Invalid calendar request");
        }
        JSONObject event = new JSONObject(payload);
        String title = event.getString("title").trim();
        if (title.isEmpty() || title.length() > 300) {
            throw new IllegalArgumentException("Invalid task title");
        }
        Intent intent = new Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI)
                .putExtra(CalendarContract.Events.TITLE, title);
        String date = event.getString("date");
        if (!date.isEmpty()) {
            if (!date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) {
                throw new IllegalArgumentException("Invalid task date");
            }
            LocalDate day = LocalDate.parse(date);
            intent.putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, true);
            intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, utcMidnight(day));
            intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, utcMidnight(day.plusDays(1)));
        }
        return intent;
    }

    private static long utcMidnight(LocalDate date) {
        return date.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli();
    }

    static void open(Activity activity, String payload) {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        try {
            activity.startActivity(createIntent(payload));
        } catch (ActivityNotFoundException | SecurityException e) {
            Toast.makeText(activity, "手机没有可用的日历应用", Toast.LENGTH_LONG).show();
        } catch (JSONException | IllegalArgumentException | DateTimeParseException e) {
            Toast.makeText(activity, "请检查任务标题和日期", Toast.LENGTH_SHORT).show();
        }
    }
}
