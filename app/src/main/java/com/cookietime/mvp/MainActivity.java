package com.cookietime.mvp;

import android.Manifest;
import android.app.Activity;
import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;
    private static final int NOTIFICATION_REQUEST = 4001;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xfffffaf1);
        getWindow().setNavigationBarColor(0xfffffaf1);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        webView.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){ super.onPageFinished(view,url); dispatchStartFocus(); }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new NativeBridge(this, webView), "NativeMvp");
        setContentView(webView);
        NativeNotifications.createChannels(this);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.postDelayed(() -> webView.evaluateJavascript("window.refreshNativeSettings && window.refreshNativeSettings()", null), 350);
    }

    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); if(webView!=null) webView.postDelayed(this::dispatchStartFocus,350); }

    private void dispatchStartFocus(){
        Intent intent=getIntent();
        if(intent!=null && intent.getBooleanExtra("start_focus",false) && webView!=null){
            intent.removeExtra("start_focus");
            webView.evaluateJavascript("window.startFocusFromNotification && window.startFocusFromNotification()",null);
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    boolean hasUsageAccess() {
        AppOpsManager ops = (AppOpsManager)getSystemService(Context.APP_OPS_SERVICE);
        int mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    void requestPermission(String kind) {
        try {
            switch (kind) {
                case "usage": startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)); break;
                case "overlay":
                    if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this))
                        startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
                    break;
                case "notification":
                    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_REQUEST);
                    else Toast.makeText(this, "알림 권한이 허용되어 있어요.", Toast.LENGTH_SHORT).show();
                    break;
                case "exactAlarm":
                    if (Build.VERSION.SDK_INT >= 31) {
                        android.app.AlarmManager alarm = (android.app.AlarmManager)getSystemService(ALARM_SERVICE);
                        if (!alarm.canScheduleExactAlarms()) startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
                    }
                    break;
            }
        } catch (Exception ex) {
            Toast.makeText(this, "설정 화면을 열 수 없어요. 앱 설정에서 권한을 확인해주세요.", Toast.LENGTH_LONG).show();
        }
    }

    boolean startMonitor() {
        if (!hasUsageAccess()) { requestPermission("usage"); Toast.makeText(this, "사용 기록 접근을 허용한 뒤 집중을 다시 시작해주세요.", Toast.LENGTH_LONG).show(); return false; }
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) { requestPermission("overlay"); Toast.makeText(this, "화면 위 표시를 허용한 뒤 집중을 다시 시작해주세요.", Toast.LENGTH_LONG).show(); return false; }
        Intent intent = new Intent(this, FocusMonitorService.class).setAction(FocusMonitorService.ACTION_START);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent); else startService(intent);
        return true;
    }

    void stopMonitor() { stopService(new Intent(this, FocusMonitorService.class)); }
}
