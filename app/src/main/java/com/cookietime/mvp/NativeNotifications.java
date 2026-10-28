package com.cookietime.mvp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.Manifest;
import android.content.pm.PackageManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

final class NativeNotifications {
    static final String CHANNEL="cookie-reminders";
    private NativeNotifications() {}
    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            manager.createNotificationChannel(new NotificationChannel(CHANNEL,"쿠키타임 알림",NotificationManager.IMPORTANCE_DEFAULT));
        }
    }
    static Notification focusNotification(Context context) {
        Intent open=new Intent(context,MainActivity.class);
        PendingIntent pending=PendingIntent.getActivity(context,7,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("쿠키타임 집중 보호 중")
                .setContentText("선택한 앱을 확인하고 있어요. 알림을 눌러 종료할 수 있어요.")
                .setContentIntent(pending).setOngoing(true).build();
    }
    static void showCountdown(Context context, String title, int minutes, String taskId, int snoozes, String kind) {
        createChannels(context);
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        boolean startNotice="start".equals(kind);
        String message=startNotice?(minutes==0?title+" 시작할 시간이에요!":minutes+"분 뒤 시작해요 · "+title):(minutes==1440?"하루 뒤 마감이에요 · ":"3시간 뒤 마감이에요 · ")+title;
        Notification.Builder builder=new Notification.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(startNotice?"쿠키타임 시작 예고":"쿠키타임 마감 알림")
                .setContentText(message).setAutoCancel(true);
        if(startNotice && minutes==0) {
            Intent open=new Intent(context,MainActivity.class).putExtra("start_focus",true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent start=PendingIntent.getActivity(context,(taskId+":start").hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            builder.addAction(android.R.drawable.ic_media_play,"집중 시작",start);
            if(snoozes<2) {
                Intent defer=new Intent(context,CountdownReceiver.class).setAction(CountdownReceiver.ACTION_SNOOZE).putExtra("title",title).putExtra("taskId",taskId).putExtra("snoozes",snoozes);
                PendingIntent snooze=PendingIntent.getBroadcast(context,(taskId+":snooze-action").hashCode(),defer,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                builder.addAction(android.R.drawable.ic_lock_idle_alarm,"5분만 더",snooze);
            }
        }
        Notification notification=builder.build();
        manager.notify((title+minutes).hashCode(),notification);
    }
}
