package com.cookietime.mvp;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

public class NativeBridge {
    private final MainActivity activity;
    private final Context context;
    private final WebView webView;
    NativeBridge(MainActivity activity, WebView webView) { this.activity=activity; this.context=activity; this.webView=webView; }

    @JavascriptInterface public boolean hasUsageAccess() { return activity.hasUsageAccess(); }
    @JavascriptInterface public boolean hasOverlayPermission() { return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context); }
    @JavascriptInterface public void requestPermission(String kind) { activity.runOnUiThread(() -> activity.requestPermission(kind)); }
    @JavascriptInterface public boolean startMonitoring() { boolean permitted=activity.hasUsageAccess() && hasOverlayPermission(); activity.runOnUiThread(activity::startMonitor); return permitted; }
    @JavascriptInterface public void stopMonitoring() { activity.runOnUiThread(activity::stopMonitor); }
    @JavascriptInterface public void vibrate(long milliseconds) {
        Vibrator vibrator=(Vibrator)context.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(Math.max(30, Math.min(milliseconds, 900)), VibrationEffect.DEFAULT_AMPLITUDE));
        else vibrator.vibrate(milliseconds);
    }
    @JavascriptInterface public void countdown(String title, int minutes, String taskId, int snoozes) { NativeNotifications.showCountdown(context,title,minutes,taskId,snoozes,"start"); }
    @JavascriptInterface public void syncState(String tasksJson, String blockedJson, String settingsJson) {
        android.content.SharedPreferences prefs=context.getSharedPreferences("cookie-native", Context.MODE_PRIVATE);
        String normalized=normalizeBlocked(blockedJson);
        try {
            JSONObject settings=new JSONObject(settingsJson); JSONArray thresholds=settings.optJSONArray("vibrationThresholds");
            String thresholdText=thresholds==null?"[5,10,20]":thresholds.toString();
            prefs.edit().putString("blocked-apps",normalized)
                    .putBoolean("vibration-enabled",settings.optBoolean("vibration",true))
                    .putString("vibration-thresholds",thresholdText)
                    .putInt("vibration-intensity",settings.optInt("vibrationIntensity",1))
                    .putString("vibration-dnd",settings.optString("vibrationDnd","respect")).apply();
        } catch(Exception ignored) { }
        TaskAlarmScheduler.sync(context,tasksJson,settingsJson);
    }
    @JavascriptInterface public int getDeviationCount() {
        try{return new JSONArray(context.getSharedPreferences("cookie-native",Context.MODE_PRIVATE).getString("deviation-logs","[]")).length();}catch(Exception e){return 0;}
    }
    @JavascriptInterface public String installedAppsJson() {
        JSONArray result=new JSONArray();
        try {
            Intent query=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            PackageManager pm=context.getPackageManager();
            for (android.content.pm.ResolveInfo info : pm.queryIntentActivities(query, 0)) {
                String pkg=info.activityInfo.packageName;
                if (pkg.equals(context.getPackageName())) continue;
                JSONObject app=new JSONObject(); app.put("packageName",pkg); app.put("label",info.loadLabel(pm).toString()); result.put(app);
            }
        } catch (Exception ignored) {}
        return result.toString();
    }
    @JavascriptInterface public String appLabel(String packageName) {
        try { ApplicationInfo info=context.getPackageManager().getApplicationInfo(packageName,0); return context.getPackageManager().getApplicationLabel(info).toString(); }
        catch (Exception e) { return packageName; }
    }
    private String normalizeBlocked(String json) {
        try {
            JSONArray input=new JSONArray(json), output=new JSONArray();
            java.util.Map<String,String> known=new java.util.HashMap<>();
            known.put("Instagram","com.instagram.android"); known.put("YouTube","com.google.android.youtube");
            known.put("TikTok","com.zhiliaoapp.musically"); known.put("X","com.twitter.android"); known.put("Netflix","com.netflix.mediaclient");
            Intent query=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            for (int i=0;i<input.length();i++) {
                String item=input.optString(i), pkg=known.get(item);
                if(pkg==null && item.contains(".")) pkg=item;
                if(pkg==null) for(android.content.pm.ResolveInfo info:context.getPackageManager().queryIntentActivities(query,0)) {
                    if(info.loadLabel(context.getPackageManager()).toString().equalsIgnoreCase(item)){pkg=info.activityInfo.packageName;break;}
                }
                output.put(pkg==null?item:pkg);
            }
            return output.toString();
        } catch (Exception e) { return "[]"; }
    }
}
