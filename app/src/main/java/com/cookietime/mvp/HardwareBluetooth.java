package com.cookietime.mvp;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Bluetooth Classic SPP bridge for the Uno + HC-06 timer. */
final class HardwareBluetooth {
    static final int PERMISSION_REQUEST = 4201;
    static final int ENABLE_REQUEST = 4202;
    private static final String SPP_UUID = "00001101-0000-1000-8000-00805F9B34FB";

    private final Activity activity;
    private final WebView webView;
    private final ExecutorService writes = Executors.newSingleThreadExecutor();
    private volatile BluetoothSocket socket;
    private volatile BluetoothSocket connectingSocket;
    private volatile OutputStream output;
    private volatile boolean connected;

    HardwareBluetooth(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    boolean isConnected() { return connected; }

    void connect() {
        if (Build.VERSION.SDK_INT >= 31 && activity.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, PERMISSION_REQUEST);
            return;
        }
        showPairedDevices();
    }

    void onPermissionResult(int requestCode, int[] grantResults) {
        if (requestCode != PERMISSION_REQUEST) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) showPairedDevices();
        else status(false, "", "블루투스 연결 권한을 허용해주세요.");
    }

    void onActivityResult(int requestCode, int resultCode) {
        if (requestCode == ENABLE_REQUEST) {
            if (resultCode == Activity.RESULT_OK) showPairedDevices();
            else status(false, "", "블루투스를 켜야 연결할 수 있어요.");
        }
    }

    private void showPairedDevices() {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) { status(false, "", "이 기기에서 블루투스를 사용할 수 없어요."); return; }
        if (!adapter.isEnabled()) {
            try { activity.startActivityForResult(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), ENABLE_REQUEST); }
            catch (Exception error) { status(false, "", "기기 설정에서 블루투스를 켜주세요."); }
            return;
        }
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        List<BluetoothDevice> devices = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        if (bonded != null) for (BluetoothDevice device : bonded) {
            devices.add(device);
            String name = device.getName();
            String address = device.getAddress();
            labels.add((name == null || name.isEmpty() ? "Bluetooth 기기" : name) + " · " + address.substring(Math.max(0, address.length() - 5)));
        }
        if (devices.isEmpty()) {
            status(false, "", "HC-06을 Android 블루투스 설정에서 먼저 페어링해주세요.");
            new AlertDialog.Builder(activity).setTitle("HC-06 먼저 페어링하기")
                    .setMessage("Android 설정에서 HC-06을 페어링한 뒤 앱으로 돌아와 다시 연결을 눌러주세요.")
                    .setNegativeButton("취소", (dialog, which) -> status(false, "", ""))
                    .setPositiveButton("블루투스 설정", (dialog, which) -> activity.startActivity(new Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS)))
                    .show();
            return;
        }
        new AlertDialog.Builder(activity).setTitle("하드웨어 타이머 선택")
                .setItems(labels.toArray(new String[0]), (dialog, which) -> open(devices.get(which)))
                .setNegativeButton("취소", (dialog, which) -> status(false, "", ""))
                .show();
    }

    private void open(BluetoothDevice device) {
        disconnect(false);
        status(false, "", "HC-06에 연결하는 중이에요…");
        Thread thread = new Thread(() -> {
            BluetoothSocket candidate = null;
            try {
                candidate = device.createRfcommSocketToServiceRecord(UUID.fromString(SPP_UUID));
                connectingSocket = candidate;
                candidate.connect();
                if (candidate != connectingSocket) { candidate.close(); return; }
                socket = candidate;
                output = candidate.getOutputStream();
                connected = true;
                connectingSocket = null;
                status(true, safeName(device), "");
                readLoop(candidate, device);
            } catch (Exception error) {
                close(candidate);
                if (connectingSocket == candidate) connectingSocket = null;
                connected = false;
                output = null;
                status(false, "", "HC-06 연결에 실패했어요. 페어링 상태와 전원을 확인해주세요.");
            }
        }, "cookietime-hc06-connect");
        thread.start();
    }

    private void readLoop(BluetoothSocket active, BluetoothDevice device) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(active.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while (connected && active == socket && (line = reader.readLine()) != null) {
                String message = line.trim();
                if (!message.isEmpty()) webView.post(() -> webView.evaluateJavascript("window.onHardwareMessage && window.onHardwareMessage(" + JSONObject.quote(message) + ")", null));
            }
        } catch (IOException ignored) {
        } finally {
            if (active == socket) {
                socket = null;
                output = null;
                connected = false;
                close(active);
                status(false, safeName(device), "하드웨어 연결이 끊어졌어요.");
            }
        }
    }

    void send(String command) {
        if (!connected || command == null || command.indexOf('\n') >= 0 || command.indexOf('\r') >= 0) return;
        writes.execute(() -> {
            try {
                OutputStream stream = output;
                if (stream != null && connected) {
                    stream.write((command + "\n").getBytes(StandardCharsets.UTF_8));
                    stream.flush();
                }
            } catch (IOException error) {
                disconnect(true);
            }
        });
    }

    void disconnect() { disconnect(false); }

    void shutdown() {
        disconnect(false);
        writes.shutdownNow();
    }

    private synchronized void disconnect(boolean notify) {
        connected = false;
        output = null;
        BluetoothSocket current = socket;
        BluetoothSocket pending = connectingSocket;
        socket = null;
        connectingSocket = null;
        close(current);
        if (pending != current) close(pending);
        if (notify && (current != null || pending != null)) status(false, "", "연결을 해제했어요.");
    }

    private String safeName(BluetoothDevice device) {
        try { String name = device.getName(); return name == null ? "HC-06" : name; }
        catch (SecurityException ignored) { return "HC-06"; }
    }

    private void status(boolean isConnected, String name, String message) {
        String script = "window.onHardwareStatus && window.onHardwareStatus(" + isConnected + "," + JSONObject.quote(name == null ? "" : name) + "," + JSONObject.quote(message == null ? "" : message) + ")";
        activity.runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private static void close(BluetoothSocket value) {
        if (value == null) return;
        try { value.close(); } catch (IOException ignored) { }
    }
}
