package com.cookietime.mvp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CountdownReceiver extends BroadcastReceiver {
    public static final String ACTION_SNOOZE="com.cookietime.mvp.SNOOZE";
    @Override public void onReceive(Context context, Intent intent) {
        String action=intent.getAction();
        if(ACTION_SNOOZE.equals(action)) {
            TaskAlarmScheduler.snooze(context,intent.getStringExtra("taskId"),intent.getStringExtra("title"),intent.getIntExtra("snoozes",0));
            return;
        }
        NativeNotifications.showCountdown(context,intent.getStringExtra("title"),intent.getIntExtra("minutes",0),intent.getStringExtra("taskId"),intent.getIntExtra("snoozes",0),intent.getStringExtra("kind"));
    }
}
