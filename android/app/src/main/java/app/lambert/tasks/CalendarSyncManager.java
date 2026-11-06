package app.lambert.tasks;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.widget.Toast;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Opt-in, one-way Lambert task -> Android calendar synchronization.
 * Never accesses other event contents; only modifies event IDs created and stored by this app.
 * A calendar event can be out of date while the app is closed/offline.
 */
final class CalendarSyncManager {
    static final int PERMISSION_REQUEST = 903;
    private static final String PREFERENCES = "lambert_calendar_sync_v1";
    private static final String OWNER = "owner";
    private static final String CALENDAR = "calendar";
    private static final String PREFIX = "event:";
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final int MAX_TASKS = 150;
    private final Activity activity;
    private String pending;

    CalendarSyncManager(Activity activity) { this.activity = activity; }

    boolean authorized() {
        return activity.checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED
                && activity.checkSelfPermission(Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED;
    }

    void handle(String raw) {
        if (raw == null || raw.length() > 90000) return;
        try {
            JSONObject request = new JSONObject(raw);
            String action = request.optString("action");
            if (!"enable".equals(action) && !"sync".equals(action)) return;
            String owner = request.optString("owner");
            if (!owner.matches("[0-9a-fA-F-]{36}")) return;
            JSONArray tasks = request.optJSONArray("tasks");
            if (tasks == null || tasks.length() > MAX_TASKS) return;
            // Validate the entire snapshot before asking permission or touching the provider.
            parseTasks(tasks);
            if (!authorized()) {
                if ("enable".equals(action)) {
                    pending = raw;
                    activity.requestPermissions(new String[]{Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR}, PERMISSION_REQUEST);
                }
                return;
            }
            if ("enable".equals(action)) chooseCalendar(owner, tasks);
            else applyIfEnabled(owner, tasks);
        } catch (Exception error) {
            if (raw.contains("\"action\":\"enable\"")) Toast.makeText(activity, "日历数据检查失败，请重试", Toast.LENGTH_SHORT).show();
        }
    }

    void permissionResult(int request, int[] grants) {
        if (request != PERMISSION_REQUEST) return;
        String next = pending; pending = null;
        if (grants.length == 2 && grants[0] == PackageManager.PERMISSION_GRANTED && grants[1] == PackageManager.PERMISSION_GRANTED && next != null) handle(next);
        else Toast.makeText(activity, "未授权日历，未创建任何日程", Toast.LENGTH_LONG).show();
    }

    private android.content.SharedPreferences prefs() {
        return activity.getSharedPreferences(PREFERENCES, Activity.MODE_PRIVATE);
    }

    private static class Task {
        final String id, title;
        final LocalDate date;
        Task(String id, String title, LocalDate date) { this.id=id; this.title=title; this.date=date; }
    }

    private ArrayList<Task> parseTasks(JSONArray data) throws Exception {
        ArrayList<Task> out = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (int i=0;i<data.length();i++) {
            JSONObject row = data.getJSONObject(i);
            String id=row.getString("id"),title=row.getString("title").trim(),date=row.getString("date");
            if (id.length()<1 || id.length()>180 || title.isEmpty() || title.length()>300 || !used.add(id) ||
                    !date.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException("invalid_task");
            out.add(new Task(id,title,LocalDate.parse(date)));
        }
        return out;
    }

    private static class CalendarChoice {
        final long id;
        final String name;
        CalendarChoice(long id,String name) {this.id=id;this.name=name;}
    }

    private ArrayList<CalendarChoice> calendars() {
        ArrayList<CalendarChoice> result=new ArrayList<>();
        String[] cols={CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME};
        String selection=CalendarContract.Calendars.VISIBLE+"=1 AND "+CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL+">=?";
        try (Cursor cursor=activity.getContentResolver().query(CalendarContract.Calendars.CONTENT_URI,cols,selection,
                new String[]{String.valueOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR)},null)) {
            if(cursor!=null)while(cursor.moveToNext())result.add(new CalendarChoice(cursor.getLong(0),cursor.getString(1)));
        }
        return result;
    }

    private void chooseCalendar(String owner, JSONArray snapshot) throws Exception {
        ArrayList<CalendarChoice> available=calendars();
        if(available.isEmpty()) {Toast.makeText(activity,"请先在 vivo 日历中启用可写日历",Toast.LENGTH_LONG).show();return;}
        CharSequence[] labels=new CharSequence[available.size()];
        for(int i=0;i<available.size();i++)labels[i]=available.get(i).name;
        new AlertDialog.Builder(activity).setTitle("选择同步目标日历")
            .setSingleChoiceItems(labels,0,(dialog,which)->{
                dialog.dismiss();
                CalendarChoice selected=available.get(which);
                int count=snapshot.length();
                new AlertDialog.Builder(activity).setTitle("开启 Lambert 日历提醒？")
                    .setMessage("将同步 "+count+" 项未来任务到「"+selected.name+"」。每项任务于截止日 11:45、19:00、21:30 提醒。\\n\\n仅管理 Lambert 创建的日程。任务完成或删除后，需要手机再次同步才能取消提醒。")
                    .setNegativeButton("取消",(d,w)->{})
                    .setPositiveButton("开启并同步",(d,w)->{
                        // A different account must never take over a previous account's event map.
                        String previous=prefs().getString(OWNER,"");
                        if(!previous.isEmpty()&&!previous.equals(owner)) {
                            Toast.makeText(activity,"请先处理原账号的日历同步，未修改日程",Toast.LENGTH_LONG).show();
                            return;
                        }
                        prefs().edit().putString(OWNER,owner).putLong(CALENDAR,selected.id).apply();
                        applyIfEnabled(owner,snapshot);
                    }).show();
            })
            .setNegativeButton("取消", (d,w)->{}).show();
    }

    private void applyIfEnabled(String owner,JSONArray snapshot) {
        android.content.SharedPreferences p=prefs();
        if(!owner.equals(p.getString(OWNER,""))||!p.contains(CALENDAR)||!authorized())return;
        try {
            long calendarId=p.getLong(CALENDAR,-1);
            ArrayList<Task> requested=parseTasks(snapshot);
            Map<String,Task> wanted=new HashMap<>();
            for(Task t:requested)wanted.put(t.id,t);
            Map<String,Long> mapped=new HashMap<>();
            for(Map.Entry<String,?> e:p.getAll().entrySet()) {
                if(e.getKey().startsWith(PREFIX)&&e.getValue() instanceof Long)
                    mapped.put(e.getKey().substring(PREFIX.length()),(Long)e.getValue());
            }
            int updated=0;
            // Do not remove an event unless the ID is still in our chosen calendar.
            for(Map.Entry<String,Long> row:mapped.entrySet()) {
                String taskId=row.getKey();long eventId=row.getValue();
                if(!eventExists(eventId,calendarId)){p.edit().remove(PREFIX+taskId).apply();continue;}
                if(!wanted.containsKey(taskId)){
                    activity.getContentResolver().delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,eventId),
                        CalendarContract.Events.CALENDAR_ID+"=?",new String[]{String.valueOf(calendarId)});
                    changes.remove(PREFIX+taskId);
                } else {
                    if(updateEvent(eventId,calendarId,wanted.get(taskId)))updated++;
                }
            }
            for(Task task:requested) {
                if(mapped.containsKey(task.id)&&eventExists(mapped.get(task.id),calendarId))continue;
                long eventId=createEvent(calendarId,task);
                p.edit().putLong(PREFIX+task.id,eventId).apply();
                updated++;
            }
            if(updated>0) Toast.makeText(activity,"Lambert 日历已同步 "+updated+" 项",Toast.LENGTH_SHORT).show();
        } catch(Exception error) {
            Toast.makeText(activity,"日历同步未完成，请在 APP 中重试",Toast.LENGTH_LONG).show();
        }
    }

    private boolean eventExists(long id,long calendarId) {
        try(Cursor c=activity.getContentResolver().query(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,id),
            new String[]{CalendarContract.Events._ID},CalendarContract.Events.CALENDAR_ID+"=?",
            new String[]{String.valueOf(calendarId)},null)){return c!=null&&c.moveToFirst();}
    }

    private ContentValues values(long calendarId,Task t) {
        LocalDateTime start=t.date.atTime(21,30);
        long millis=start.atZone(ZONE).toInstant().toEpochMilli();
        ContentValues v=new ContentValues();
        v.put(CalendarContract.Events.CALENDAR_ID,calendarId);
        v.put(CalendarContract.Events.TITLE,"Lambert｜"+t.title);
        v.put(CalendarContract.Events.DESCRIPTION,"Lambert AI OS 任务日历提醒。手机 APP 同步完成后更新任务状态。");
        v.put(CalendarContract.Events.DTSTART,millis);
        v.put(CalendarContract.Events.DTEND,millis+15*60*1000);
        v.put(CalendarContract.Events.EVENT_TIMEZONE,ZONE.getId());
        v.put(CalendarContract.Events.HAS_ALARM,1);
        return v;
    }

    private long createEvent(long calendarId,Task t) {
        Uri uri=activity.getContentResolver().insert(CalendarContract.Events.CONTENT_URI,values(calendarId,t));
        if(uri==null)throw new IllegalStateException("calendar_insert_failed");
        long id=ContentUris.parseId(uri);
        int[] minutes={585,150,0}; // 11:45, 19:00, 21:30 before 21:30 event
        for(int m:minutes) {
            ContentValues v=new ContentValues();
            v.put(CalendarContract.Reminders.EVENT_ID,id);
            v.put(CalendarContract.Reminders.MINUTES,m);
            v.put(CalendarContract.Reminders.METHOD,CalendarContract.Reminders.METHOD_ALERT);
            activity.getContentResolver().insert(CalendarContract.Reminders.CONTENT_URI,v);
        }
        return id;
    }
    private boolean updateEvent(long id,long calendarId,Task task) {
        return activity.getContentResolver().update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,id),
            values(calendarId,task),CalendarContract.Events.CALENDAR_ID+"=?",
            new String[]{String.valueOf(calendarId)})>0;
    }
}
