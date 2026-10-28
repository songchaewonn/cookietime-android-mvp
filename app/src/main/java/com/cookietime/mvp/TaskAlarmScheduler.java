package com.cookietime.mvp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;

final class TaskAlarmScheduler {
    private TaskAlarmScheduler() {}
    static void sync(Context context, String tasksJson, String settingsJson) {
        try {
            android.content.SharedPreferences prefs=context.getSharedPreferences("cookie-native",Context.MODE_PRIVATE);
            String signature=tasksJson+"|"+settingsJson;
            if(signature.equals(prefs.getString("alarm-signature",""))) return;
            AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
            Set<String> previous=prefs.getStringSet("alarm-ids",new HashSet<>());
            for(String id:previous) cancel(context,alarm,Integer.parseInt(id));
            Set<String> next=new HashSet<>(); JSONArray tasks=new JSONArray(tasksJson); JSONObject settings=new JSONObject(settingsJson); long now=System.currentTimeMillis();
            JSONArray configured=settings.optJSONArray("countdownLeads"); Set<Integer> leads=new HashSet<>();
            if(configured!=null) for(int i=0;i<configured.length();i++) leads.add(configured.optInt(i));
            leads.add(0);
            boolean countdown=settings.optBoolean("countdown",true), reminders=settings.optBoolean("reminder",true);
            boolean reminder24=settings.optBoolean("reminder24h",true), reminder3=settings.optBoolean("reminder3h",true);
            for(int i=0;i<tasks.length();i++) {
                JSONObject task=tasks.getJSONObject(i); if(task.optBoolean("done",false)) continue;
                String title=task.optString("title","할 일"), taskId=task.optString("id",title);
                String start=task.optString("start","");
                if(countdown && !start.isEmpty()) {
                    long startAt=LocalDateTime.parse(start).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                    for(int lead:leads) schedule(context,alarm,next,taskId,title,"start",lead,startAt-lead*60_000L,task.optInt("snoozes",0),now);
                }
                String due=task.optString("due","");
                if(reminders && !due.isEmpty()) {
                    long dueAt=LocalDateTime.parse(due).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                    if(reminder24) schedule(context,alarm,next,taskId,title,"deadline",1440,dueAt-24*60*60_000L,0,now);
                    if(reminder3) schedule(context,alarm,next,taskId,title,"deadline",180,dueAt-3*60*60_000L,0,now);
                }
            }
            prefs.edit().putStringSet("alarm-ids",next).putString("alarm-signature",signature).apply();
        } catch(Exception ignored) { }
    }
    private static void schedule(Context context,AlarmManager alarm,Set<String> next,String taskId,String title,String kind,int lead,long at,int snoozes,long now) {
        if(at<=now) return;
        int request=(taskId+":"+kind+":"+lead).hashCode(); next.add(String.valueOf(request));
        Intent intent=new Intent(context,CountdownReceiver.class).putExtra("title",title).putExtra("taskId",taskId).putExtra("kind",kind).putExtra("minutes",lead).putExtra("snoozes",snoozes);
        PendingIntent pending=PendingIntent.getBroadcast(context,request,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        try { if(Build.VERSION.SDK_INT>=31 && !alarm.canScheduleExactAlarms()) alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending); else alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending); }
        catch(SecurityException denied) { alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending); }
    }
    static void snooze(Context context,String taskId,String title,int snoozes) {
        if(snoozes>=2) return;
        long at=System.currentTimeMillis()+5*60_000L; AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        int request=(taskId+":snooze").hashCode(); Intent intent=new Intent(context,CountdownReceiver.class).putExtra("title",title).putExtra("taskId",taskId).putExtra("kind","start").putExtra("minutes",0).putExtra("snoozes",snoozes+1);
        PendingIntent pending=PendingIntent.getBroadcast(context,request,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        try { alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending); } catch(SecurityException denied) { alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending); }
        Set<String> ids=new HashSet<>(context.getSharedPreferences("cookie-native",Context.MODE_PRIVATE).getStringSet("alarm-ids",new HashSet<>()));ids.add(String.valueOf(request));context.getSharedPreferences("cookie-native",Context.MODE_PRIVATE).edit().putStringSet("alarm-ids",ids).apply();
    }
    private static void cancel(Context context, AlarmManager alarm, int request) {
        PendingIntent pending=PendingIntent.getBroadcast(context,request,new Intent(context,CountdownReceiver.class),PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);
        if(pending!=null) alarm.cancel(pending);
    }
}
