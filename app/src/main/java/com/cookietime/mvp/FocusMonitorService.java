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
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.Calendar;

public class FocusMonitorService extends Service {
    public static final String ACTION_START="com.cookietime.mvp.START_MONITOR";
    private final Handler handler=new Handler(Looper.getMainLooper());
    private String foreground="", activeBlocked="";
    private long deviationStart=0;
    private int vibrationStage=0;
    private WindowManager windowManager;
    private LinearLayout overlay;
    private TextView elapsedText;
    private TextView bubbleText;
    private TextView budgetText;
    private int bubbleStage=-1;

    private final Runnable poll=new Runnable(){ @Override public void run(){ inspectForeground(); handler.postDelayed(this,1200); } };
    @Override public void onCreate(){ super.onCreate(); windowManager=(WindowManager)getSystemService(WINDOW_SERVICE); NativeNotifications.createChannels(this); android.content.SharedPreferences prefs=getSharedPreferences("cookie-native",MODE_PRIVATE); activeBlocked=prefs.getString("active-blocked-app",""); deviationStart=prefs.getLong("active-deviation-start",0); if(deviationStart>0&&System.currentTimeMillis()-deviationStart>24*60*60*1000L){activeBlocked="";deviationStart=0;prefs.edit().remove("active-blocked-app").remove("active-deviation-start").apply();} startForeground(91,NativeNotifications.focusNotification(this)); }
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
        android.content.SharedPreferences prefs=getSharedPreferences("cookie-native",MODE_PRIVATE); String ignored=prefs.getString("ignored-until-exit",""); if(!ignored.isEmpty()&&!foreground.equals(ignored))prefs.edit().remove("ignored-until-exit").apply(); boolean blocked=blockedPackages().contains(foreground) && !foreground.equals(getPackageName()) && !foreground.equals(ignored) && isRestrictionActive();
        if(blocked){
            if(!foreground.equals(activeBlocked)){ closeDeviation(); activeBlocked=foreground; deviationStart=System.currentTimeMillis(); vibrationStage=0; bubbleStage=-1; getSharedPreferences("cookie-native",MODE_PRIVATE).edit().putString("active-blocked-app",activeBlocked).putLong("active-deviation-start",deviationStart).putLong("active-usage-start",deviationStart).putInt("active-usage-limit",getSharedPreferences("cookie-native",MODE_PRIVATE).getInt("usage-default-minutes",15)).putInt("expired-choice",0).apply(); }
            showOverlay(); updateElapsed(); checkVibration();
        }else if(!activeBlocked.isEmpty()) closeDeviation();
    }
    private boolean isRestrictionActive(){
        android.content.SharedPreferences prefs=getSharedPreferences("cookie-native",MODE_PRIVATE);
        String mode=prefs.getString("blocked-mode","focus");
        if("always".equals(mode)) return true;
        if(!"schedule".equals(mode)) return true; // Service runs only while a focus session is active in this mode.
        Calendar now=Calendar.getInstance(); int day=now.get(Calendar.DAY_OF_WEEK)-1;
        try { JSONArray days=new JSONArray(prefs.getString("blocked-days","[1,2,3,4,5]")); boolean selected=false; for(int i=0;i<days.length();i++) if(days.optInt(i,-1)==day){selected=true;break;} if(!selected)return false; }
        catch(Exception ignored){ return false; }
        String start=prefs.getString("blocked-start","09:00"), end=prefs.getString("blocked-end","18:00");
        java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("HH:mm",java.util.Locale.ROOT);
        String current=format.format(now.getTime());
        return start.equals(end) || (start.compareTo(end)<0 ? current.compareTo(start)>=0 && current.compareTo(end)<0 : current.compareTo(start)>=0 || current.compareTo(end)<0);
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
        if(!getSharedPreferences("cookie-native",MODE_PRIVATE).getBoolean("character-enabled",true))cookie.setVisibility(View.GONE);
        root.addView(cookie,new LinearLayout.LayoutParams(45,45));
        LinearLayout copy=new LinearLayout(this); copy.setOrientation(LinearLayout.VERTICAL); copy.setPadding(8,0,0,0);
        bubbleText=new TextView(this); bubbleText.setText("잠깐, 쿠키랑 돌아갈까요?"); bubbleText.setTextColor(0xfffff7ed); bubbleText.setTextSize(13); bubbleText.setTypeface(null,1);
        elapsedText=new TextView(this); elapsedText.setTextColor(0xffffd3ad); elapsedText.setTextSize(12);
        copy.addView(bubbleText); copy.addView(elapsedText); budgetText=new TextView(this); budgetText.setTextColor(0xffffd3ad); budgetText.setTextSize(11); copy.addView(budgetText); root.addView(copy);
        WindowManager.LayoutParams params=new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.WRAP_CONTENT,Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,PixelFormat.TRANSLUCENT);
        android.content.SharedPreferences positionPrefs=getSharedPreferences("cookie-native",MODE_PRIVATE);int savedX=positionPrefs.getInt("overlay-x",-1);params.gravity=Gravity.TOP|(savedX>=0?Gravity.START:Gravity.CENTER_HORIZONTAL);params.x=Math.max(0,savedX);params.y=Math.max(0,positionPrefs.getInt("overlay-y",72));
        final float[] dragStart={0,0};final int[] positionStart={0,0};root.setOnTouchListener((view,event)->{switch(event.getActionMasked()){case MotionEvent.ACTION_DOWN:dragStart[0]=event.getRawX();dragStart[1]=event.getRawY();positionStart[0]=params.x;positionStart[1]=params.y;return true;case MotionEvent.ACTION_MOVE:params.gravity=Gravity.TOP|Gravity.START;params.x=Math.max(0,positionStart[0]+Math.round(event.getRawX()-dragStart[0]));params.y=Math.max(0,positionStart[1]+Math.round(event.getRawY()-dragStart[1]));try{windowManager.updateViewLayout(root,params);}catch(Exception ignored){}return true;case MotionEvent.ACTION_UP:case MotionEvent.ACTION_CANCEL:if(Math.abs(event.getRawX()-dragStart[0])+Math.abs(event.getRawY()-dragStart[1])<18)handleBudgetTap();else{int screen=windowManager.getDefaultDisplay().getWidth();params.x=params.x+root.getWidth()/2>screen/2?Math.max(0,screen-root.getWidth()):0;try{windowManager.updateViewLayout(root,params);}catch(Exception ignored){}positionPrefs.edit().putInt("overlay-x",params.x).putInt("overlay-y",params.y).apply();}return true;default:return false;}});
        try{ windowManager.addView(root,params); overlay=root; }catch(Exception ignored){ overlay=null; }
    }
    private void updateElapsed(){ if(elapsedText!=null){ android.content.SharedPreferences usagePrefs=getSharedPreferences("cookie-native",MODE_PRIVATE);long usageStart=usagePrefs.getLong("active-usage-start",deviationStart);long mins=(System.currentTimeMillis()-usageStart)/60000; String label; try{label=getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(activeBlocked,0)).toString();}catch(Exception e){label="선택한 앱";} elapsedText.setText(label+" · "+mins+"분째 사용 중");android.content.SharedPreferences prefs=getSharedPreferences("cookie-native",MODE_PRIVATE);int limit=prefs.getInt("active-usage-limit",prefs.getInt("usage-default-minutes",15));if(budgetText!=null)budgetText.setText(mins<limit?"목표 "+limit+"분 · 눌러서 사용시간 조절":"시간 종료 · 눌러서 1분 더 / 게임 / 멈추기");int interval=Math.max(5,prefs.getInt("bubble-frequency",15)),stage=(int)(mins/interval);if(stage!=bubbleStage&&bubbleText!=null){String[] messages={"잠깐, 쿠키랑 돌아갈까요?","화면을 내려놓고 숨을 한번 쉬어요.","괜찮아요. 지금 돌아오면 돼요.","다시 시작할 수 있어요. 쿠키가 응원해요."};bubbleText.setText(messages[Math.floorMod(stage,messages.length)]);bubbleStage=stage;} } }
    private void handleBudgetTap(){android.content.SharedPreferences prefs=getSharedPreferences("cookie-native",MODE_PRIVATE);long usageStart=prefs.getLong("active-usage-start",deviationStart);long mins=Math.max(0,(System.currentTimeMillis()-usageStart)/60000);int limit=prefs.getInt("active-usage-limit",prefs.getInt("usage-default-minutes",15));if(mins<limit){int[] choices={5,10,15,30};int next=choices[0];for(int choice:choices)if(choice>limit){next=choice;break;}prefs.edit().putInt("active-usage-limit",next).apply();updateElapsed();return;}int choice=prefs.getInt("expired-choice",0);if(choice==0){prefs.edit().putLong("active-usage-start",System.currentTimeMillis()).putInt("active-usage-limit",1).putInt("expired-choice",1).apply();updateElapsed();}else if(choice==1){prefs.edit().putString("ignored-until-exit",activeBlocked).putInt("expired-choice",2).apply();closeDeviation();Intent game=new Intent(this,MainActivity.class).putExtra("open_missions",true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);startActivity(game);}else{prefs.edit().putString("ignored-until-exit",activeBlocked).apply();closeDeviation();}}
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
        activeBlocked=""; deviationStart=0; vibrationStage=0; bubbleStage=-1;getSharedPreferences("cookie-native",MODE_PRIVATE).edit().remove("active-blocked-app").remove("active-deviation-start").remove("active-usage-start").remove("active-usage-limit").remove("expired-choice").apply();removeOverlay();
    }
    private void removeOverlay(){ if(overlay!=null){try{windowManager.removeView(overlay);}catch(Exception ignored){} overlay=null; elapsedText=null;bubbleText=null;budgetText=null;} }
}
