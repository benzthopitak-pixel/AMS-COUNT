package com.ams.count;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.BroadcastReceiver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import androidx.webkit.WebViewCompat;

import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * AMS Count — หน้าจอแอปคือหน้าเว็บที่บรรจุมาใน APK (assets/www) แสดงด้วย WebView ภายในแอป
 * ไม่ได้เปิด Chrome และไม่ต้องโหลดหน้าจากอินเทอร์เน็ต · เน็ตใช้แค่ซิงก์ข้อมูลกับ Supabase
 * เครื่องยิง CipherLab ทำงานแบบ Keyboard Emulation: รหัสที่ยิงจะพิมพ์ลงช่องสแกนแล้วตามด้วย Enter
 */
public class MainActivity extends Activity {

    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int FILE_CHOOSER = 1001;
    private static final int MIN_WEBVIEW = 90;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // ทะเบียน + ผลนับเก็บในเครื่อง (ไม่หายเมื่อปิดแอป)
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);         // อ่านไฟล์ที่ผู้ใช้เลือก (แพ็กเกจ / ผลนับ)
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                if (params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(Intent.createChooser(intent, "เลือกไฟล์"), FILE_CHOOSER);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);

        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();
        warnIfOldWebView();
    }

    /* ---------- รับรหัสจากเครื่องยิงแบบ Intent (ReaderConfig → Data Output → Intent) ---------- */
    private static final String[] SCAN_ACTIONS = {
            "com.ams.count.SCAN",                                   // ตั้งเองใน ReaderConfig (แนะนำ)
            "com.cipherlab.barcodebaseapi.PASS_DATA_2_APP",         // ค่าเริ่มต้นของ CipherLab
            "com.cipherlab.barcode.ACTION_DATA"
    };
    private final BroadcastReceiver scanReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String code = pickBarcode(intent);
            if (code == null || code.trim().isEmpty() || web == null) return;
            web.evaluateJavascript("window.AMSScan && window.AMSScan(" + JSONObject.quote(code.trim()) + ")", null);
        }
    };

    /** หาข้อความบาร์โค้ดใน extras: ใช้ key ที่ชื่อเหมือนข้อมูลก่อน แล้วค่อยเอา String ตัวแรกที่เจอ */
    private static String pickBarcode(Intent intent) {
        Bundle b = intent.getExtras();
        if (b == null) return intent.getDataString();
        String first = null;
        for (String k : b.keySet()) {
            Object v = b.get(k);
            String s = v instanceof String ? (String) v : v instanceof byte[] ? new String((byte[]) v, StandardCharsets.UTF_8) : null;
            if (s == null || s.isEmpty()) continue;
            String key = k.toLowerCase();
            if (key.equals("data") || key.contains("decoder_data") || key.contains("barcode") || key.contains("data_string") || key.contains("decode")) return s;
            if (first == null && !key.contains("type") && !key.contains("symbol") && !key.contains("length")) first = s;
        }
        return first;
    }

    @Override
    protected void onResume() {
        super.onResume();
        IntentFilter f = new IntentFilter();
        for (String a : SCAN_ACTIONS) f.addAction(a);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(scanReceiver, f, Context.RECEIVER_EXPORTED);
        else registerReceiver(scanReceiver, f);
    }

    @Override
    protected void onPause() {
        super.onPause();
        try { unregisterReceiver(scanReceiver); } catch (Exception ignored) { }
    }

    /** หน้าจอแอปต้องใช้ Android System WebView เวอร์ชัน 90 ขึ้นไป · ถ้าเก่ากว่าให้อัปเดตก่อน */
    private void warnIfOldWebView() {
        try {
            PackageInfo p = WebViewCompat.getCurrentWebViewPackage(this);
            if (p == null || p.versionName == null) return;
            int major = Integer.parseInt(p.versionName.split("\\.")[0]);
            if (major < MIN_WEBVIEW) {
                new AlertDialog.Builder(this)
                        .setTitle("ควรอัปเดต Android System WebView")
                        .setMessage("เครื่องนี้ใช้ WebView เวอร์ชัน " + p.versionName + " ซึ่งเก่าเกินไป หน้าจอบางส่วนอาจแสดงผลผิด\n\nอัปเดต \"Android System WebView\" และ \"Chrome\" จาก Play Store หรือจากเว็บไซต์ CipherLab แล้วเปิดแอปใหม่")
                        .setPositiveButton("ตกลง", null)
                        .show();
            }
        } catch (Exception ignored) { }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null && clip.getItemCount() > 0) {
                    result = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // ปุ่มย้อนกลับ = ปิดแผ่นรายละเอียด / กลับหน้าก่อนหน้าในแอป (ไม่ปิดแอปโดยไม่ตั้งใจ)
            web.evaluateJavascript("window.AMSBack ? window.AMSBack() : false", value -> {
                if (!"true".equals(value)) moveTaskToBack(true);
            });
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /** เรียกจากหน้าแอป: window.AndroidBridge.saveFile(name, base64, mime) → "OK:<ที่เก็บ>" หรือ "ERR:<สาเหตุ>" */
    private class Bridge {
        @JavascriptInterface
        public String saveFile(String name, String base64, String mime) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String safe = name.replaceAll("[\\\\/:*?\"<>|]", "_");
                String where;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver cr = getContentResolver();
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AMS Count");
                    Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return "ERR:สร้างไฟล์ไม่ได้";
                    try (OutputStream os = cr.openOutputStream(uri)) { os.write(bytes); }
                    where = "Download/AMS Count";
                } else {
                    File f;
                    try {
                        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "AMS Count");
                        if (!dir.exists() && !dir.mkdirs()) throw new Exception("no access");
                        f = new File(dir, safe);
                        try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
                        where = "Download/AMS Count";
                    } catch (Exception noPublicAccess) {
                        // Android 7–9 ที่ยังไม่ให้สิทธิ์ storage: เก็บในโฟลเดอร์ของแอปแทน
                        f = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), safe);
                        try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
                        where = f.getParent();
                    }
                }
                final String msg = "บันทึกแล้ว: " + where + "/" + safe;
                runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
                return "OK:" + where;
            } catch (Exception e) {
                return "ERR:" + e.getMessage();
            }
        }

        @JavascriptInterface
        public String appVersion() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }
    }
}
