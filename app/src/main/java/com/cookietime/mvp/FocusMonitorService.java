package com.cookietime.mvp;

import android.app.Service;
import android.app.NotificationManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;

public class FocusMonitorService extends Service {
    public static final String ACTION_START="com.cookietime.mvp.START_MONITOR";
    private final Handler handler=new Handler(Looper.getMainLooper());
    private String foreground="", activeBlocked="";
    private long deviationStart=0;
    private int vibrationStage=0;
    private WindowManager windowManager;
    private LinearLayout overlay;
    private TextView elapsedText;

    private final Runnable poll=new Runnable(){ @Override public void run(){ inspectForeground(); handler.postDelayed(this,1200); } };
    @Override public void onCreate(){ super.onCreate(); windowManager=(WindowManager)getSystemService(WINDOW_SERVICE); NativeNotifications.createChannels(this); startForeground(91,NativeNotifications.focusNotification(this)); }
    @Override public int onStartCommand(Intent intent,int flags,int startId){ handler.removeCallbacks(poll); handler.post(poll); return START_STICKY; }
    @Override public IBinder onBind(Intent intent){ return null; }
    @Override public void onDestroy(){ handler.removeCallbacks(poll); closeDeviation(); removeOverlay(); super.onDestroy(); }

    private Set<String> blockedPackages(){
        Set<String> result=new HashSet<>();
        try{ JSONArray list=new JSONArray(getSharedPreferences("cookie-native",MODE_PRIVATE).getString("blocked-apps","[]")); for(int i=0;i<list.length();i++)result.add(list.getString(i)); }catch(Exception ignored){}
        return result;
    }
    private void inspectForeground(){
        PowerManager power=(PowerManager)getSystemService(POWER_SERVICE);
        if(power!=null && !power.isInteractive()){ closeDeviation(); return; }
        String latest=readLatestForeground(); if(!latest.isEmpty()) foreground=latest;
        boolean blocked=blockedPackages().contains(foreground) && !foreground.equals(getPackageName());
        if(blocked){
            if(!foreground.equals(activeBlocked)){ closeDeviation(); activeBlocked=foreground; deviationStart=System.currentTimeMillis(); vibrationStage=0; }
            showOverlay(); updateElapsed(); checkVibration();
        }else if(!activeBlocked.isEmpty()) closeDeviation();
    }
    private String readLatestForeground(){
        try{
            UsageStatsManager manager=(UsageStatsManager)getSystemService(USAGE_STATS_SERVICE);
            long now=System.currentTimeMillis(); UsageEvents events=manager.queryEvents(now-60*60*1000L,now);
            UsageEvents.Event event=new UsageEvents.Event(); String result=""; long last=0;
            while(events.hasNextEvent()){ events.getNextEvent(event); int type=event.getEventType();
                boolean resumed=type==UsageEvents.Event.MOVE_TO_FOREGROUND || (Build.VERSION.SDK_INT>=29 && type==UsageEvents.Event.ACTIVITY_RESUMED);
                if(resumed && event.getTimeStamp()>=last){ last=event.getTimeStamp(); result=event.getPackageName(); }
            }
            return result;
        }catch(Exception e){ return ""; }
    }
    private void showOverlay(){
        if(overlay!=null || Build.VERSION.SDK_INT>=23 && !android.provider.Settings.canDrawOverlays(this)) return;
        LinearLayout root=new LinearLayout(this); root.setGravity(Gravity.CENTER_VERTICAL); root.setPadding(12,7,16,7); root.setOrientation(LinearLayout.HORIZONTAL);
        GradientDrawable bg=new GradientDrawable(); bg.setColor(0xff3d3028); bg.setCornerRadius(28); root.setBackground(bg);
        ImageView cookie=new ImageView(this); try(InputStream in=getAssets().open("www/public/assets/cookie-character.png")){ cookie.setImageDrawable(android.graphics.drawable.Drawable.createFromStream(in,null)); }catch(Exception ignored){}
        root.addView(cookie,new LinearLayout.LayoutParams(45,45));
        LinearLayout copy=new LinearLayout(this); copy.setOrientation(LinearLayout.VERTICAL); copy.setPadding(8,0,0,0);
        TextView title=new TextView(this); title.setText("잠깐, 쿠키랑 돌아갈까요?"); title.setTextColor(0xfffff7ed); title.setTextSize(13); title.setTypeface(null,1);
        elapsedText=new TextView(this); elapsedText.setTextColor(0xffffd3ad); elapsedText.setTextSize(12);
        copy.addView(title); copy.addView(elapsedText); root.addView(copy);
        WindowManager.LayoutParams params=new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.WRAP_CONTENT,Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.TOP|Gravity.CENTER_HORIZONTAL; params.y=72;
        try{ windowManager.addView(root,params); overlay=root; }catch(Exception ignored){ overlay=null; }
    }
    private void updateElapsed(){ if(elapsedText!=null){ long mins=(System.currentTimeMillis()-deviationStart)/60000; String label; try{label=getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(activeBlocked,0)).toString();}catch(Exception e){label="선택한 앱";} elapsedText.setText(label+" · "+mins+"분째 보고 있어요"); } }
    private void checkVibration(){
        android.content.SharedPreferences prefs=getSharedPreferences("cookie-native",MODE_PRIVATE);
        if(deviationStart==0 || !prefs.getBoolean("vibration-enabled",true))return;
        if("respect".equals(prefs.getString("vibration-dnd","respect"))) {
            try { NotificationManager notifications=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(notifications!=null && notifications.getCurrentInterruptionFilter()!=NotificationManager.INTERRUPTION_FILTER_ALL)return; }
            catch(SecurityException noPolicyAccess) { /* Let the device apply its own vibration policy. */ }
        }
        long mins=(System.currentTimeMillis()-deviationStart)/60000; int[] thresholds={5,10,20};
        try{org.json.JSONArray configured=new org.json.JSONArray(prefs.getString("vibration-thresholds","[5,10,20]"));for(int i=0;i<Math.min(3,configured.length());i++)thresholds[i]=configured.optInt(i,thresholds[i]);}catch(Exception ignored){}
        int stage=mins>=thresholds[2]?3:mins>=thresholds[1]?2:mins>=thresholds[0]?1:0;
        if(stage>vibrationStage){int intensity=Math.max(1,Math.min(3,prefs.getInt("vibration-intensity",1)));long base=stage==1?120:stage==2?260:480;long factor=intensity==1?65:intensity==2?100:145;vibrationStage=stage;vibrate(Math.max(60,base*factor/100));}
    }
    private void vibrate(long ms){ try{ Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE); if(v!=null && v.hasVibrator()){ if(Build.VERSION.SDK_INT>=26)v.vibrate(VibrationEffect.createOneShot(ms,VibrationEffect.DEFAULT_AMPLITUDE));else v.vibrate(ms); } }catch(Exception ignored){} }
    private void closeDeviation(){
        if(!activeBlocked.isEmpty() && deviationStart>0){ long end=System.currentTimeMillis(); android.content.SharedPreferences prefs=getSharedPreferences("cookie-native",MODE_PRIVATE); try{JSONArray logs=new JSONArray(prefs.getString("deviation-logs","[]"));JSONObject entry=new JSONObject();entry.put("app",activeBlocked);entry.put("start",deviationStart);entry.put("end",end);entry.put("durationSeconds",(end-deviationStart)/1000);logs.put(entry);while(logs.length()>100){JSONArray trimmed=new JSONArray();for(int i=1;i<logs.length();i++)trimmed.put(logs.get(i));logs=trimmed;}prefs.edit().putString("deviation-logs",logs.toString()).apply();}catch(Exception ignored){} prefs.edit().putLong("last-deviation-start",deviationStart).putLong("last-deviation-end",end).putString("last-deviation-app",activeBlocked).putLong("last-deviation-duration",(end-deviationStart)/1000).apply(); }
        activeBlocked=""; deviationStart=0; vibrationStage=0; removeOverlay();
    }
    private void removeOverlay(){ if(overlay!=null){try{windowManager.removeView(overlay);}catch(Exception ignored){} overlay=null; elapsedText=null;} }
}
