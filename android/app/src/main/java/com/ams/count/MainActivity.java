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
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.provider.Settings;
import java.util.List;
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

import org.json.JSONArray;
import org.json.JSONObject;

import android.content.SharedPreferences;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * AMS Count — หน้าจอแอปคือหน้าเว็บที่บรรจุมาใน APK (assets/www) แสดงด้วย WebView ภายในแอป
 * ไม่ได้เปิด Chrome · เปิดได้แม้ไม่มีเน็ต · เมื่อมีเน็ต แอปโหลดหน้าจอชุดใหม่จากเว็บมาเก็บไว้เอง (checkWebUpdate)
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

        final WebViewAssetLoader.AssetsPathHandler assets = new WebViewAssetLoader.AssetsPathHandler(this);
        // หน้าจอแอป: ใช้ชุดที่อัปเดตจากเว็บ (files/www-live) ถ้าใหม่กว่าชุดที่มากับ APK · ไม่งั้นใช้ชุดใน APK
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/www/", path -> {
                    File f = liveFile(path);
                    if (f != null) {
                        try { return new WebResourceResponse(mimeOf(path), null, new FileInputStream(f)); } catch (Exception ignored) { }
                    }
                    return assets.handle("www/" + path);
                })
                .addPathHandler("/assets/", assets)
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
        checkWebUpdate(false);
    }

    /* ---------- อัปเดตหน้าจอแอปอัตโนมัติจากเว็บ (ไม่ต้องติดตั้ง APK ใหม่) ----------
     * ทุกครั้งที่เปิดแอปและมีเน็ต: อ่าน download/web-manifest.json → ถ้ามีชุดใหม่กว่า โหลดไฟล์ทั้งหมด ตรวจ sha256
     * แล้วสลับเข้า files/www-live ในครั้งเดียว · ข้อมูลผลนับอยู่ที่เดิม (origin เดียวกัน) ไม่หาย
     * ถ้าชุดใหม่ต้องใช้แอปตัวใหม่กว่า (shell) จะไม่สลับ แต่ชวนให้ติดตั้ง APK ใหม่แทน */
    private SharedPreferences prefs() { return getSharedPreferences("ams-web", MODE_PRIVATE); }
    private int bundledBuild() { return BuildConfig.VERSION_CODE; }
    private int liveBuild() { return prefs().getInt("liveBuild", 0); }
    private File liveDir() { return new File(getFilesDir(), "www-live"); }
    private File liveFile(String path) {
        if (liveBuild() <= bundledBuild() || path.contains("..")) return null;
        File f = new File(liveDir(), path.isEmpty() ? "index.html" : path);
        return f.isFile() ? f : null;
    }
    private static String mimeOf(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html") || l.isEmpty()) return "text/html";
        if (l.endsWith(".js")) return "application/javascript";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".woff2")) return "font/woff2";
        if (l.endsWith(".json")) return "application/json";
        if (l.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }
    private static byte[] fetch(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(8000); c.setReadTimeout(20000); c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        try (InputStream in = c.getInputStream()) {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[16384]; int n; while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        } finally { c.disconnect(); }
    }
    private static String sha256(byte[] b) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (byte x : MessageDigest.getInstance("SHA-256").digest(b)) sb.append(String.format("%02x", x));
        return sb.toString();
    }
    private static void wipe(File f) { if (f.isDirectory()) { File[] k = f.listFiles(); if (k != null) for (File c : k) wipe(c); } f.delete(); }
    private volatile boolean updating = false;
    private void checkWebUpdate(boolean manual) {
        if (updating || BuildConfig.UPDATE_URL.isEmpty()) return;
        updating = true; lastCheck = System.currentTimeMillis();
        new Thread(() -> {
            String result;
            try {
                String base = BuildConfig.UPDATE_URL;
                JSONObject m = new JSONObject(new String(fetch(base + "download/web-manifest.json?t=" + System.currentTimeMillis()), StandardCharsets.UTF_8));
                int build = m.getInt("build"), shell = m.optInt("shell", 1);
                int have = Math.max(liveBuild(), bundledBuild());
                if (shell > BuildConfig.SHELL) {
                    result = "apk";
                    runOnUiThread(() -> new AlertDialog.Builder(this)
                            .setTitle("มีแอปเวอร์ชันใหม่")
                            .setMessage("รอบนี้ต้องติดตั้งแอปใหม่ทับตัวเดิม 1 ครั้ง (ผลนับไม่หาย)")
                            .setPositiveButton("ดาวน์โหลด", (d, w) -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(base + "install.html"))); } catch (Exception ignored) { } })
                            .setNegativeButton("ไว้ทีหลัง", null).show());
                } else if (build <= have) {
                    result = "latest";
                } else {
                    File next = new File(getFilesDir(), "www-next"); wipe(next);
                    JSONArray files = m.getJSONArray("files");
                    for (int i = 0; i < files.length(); i++) {
                        JSONObject f = files.getJSONObject(i);
                        String p = f.getString("p");
                        if (p.contains("..")) throw new Exception("bad path");
                        byte[] b = fetch(base + p + "?v=" + build);
                        if (!sha256(b).equals(f.getString("sha256"))) throw new Exception("checksum " + p);
                        File out = new File(next, p); out.getParentFile().mkdirs();
                        try (FileOutputStream os = new FileOutputStream(out)) { os.write(b); }
                    }
                    File live = liveDir(), old = new File(getFilesDir(), "www-old"); wipe(old);
                    if (live.exists() && !live.renameTo(old)) throw new Exception("swap");
                    if (!next.renameTo(live)) { old.renameTo(live); throw new Exception("swap"); }
                    wipe(old);
                    prefs().edit().putInt("liveBuild", build).apply();
                    result = "ready:1.0." + build;
                }
            } catch (Exception e) {
                result = "error:" + e.getMessage();
            }
            final String r = result;
            updating = false;
            runOnUiThread(() -> { if (web != null) web.evaluateJavascript("window.AMSUpdate && window.AMSUpdate(" + JSONObject.quote(r) + "," + manual + ")", null); });
        }).start();
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
        // กลับเข้าแอปหลังพักไว้นาน → ตรวจอัปเดตหน้าจออีกครั้ง (ไม่เกินชั่วโมงละครั้ง)
        if (System.currentTimeMillis() - lastCheck > 3_600_000L) checkWebUpdate(false);
    }
    private long lastCheck = 0;

    @Override
    protected void onPause() {
        super.onPause();
        try { unregisterReceiver(scanReceiver); } catch (Exception ignored) { }
    }

    private List<ResolveInfo> launchers() {
        Intent main = new Intent(Intent.ACTION_MAIN); main.addCategory(Intent.CATEGORY_LAUNCHER);
        return getPackageManager().queryIntentActivities(main, 0);
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

        /** เวอร์ชันหน้าจอที่ใช้อยู่ (อัปเดตจากเว็บได้) */
        @JavascriptInterface
        public String webVersion() { return "1.0." + Math.max(liveBuild(), bundledBuild()); }

        @JavascriptInterface
        public void checkUpdate() { checkWebUpdate(true); }

        /** แอปที่อาจแย่งหัวอ่าน (ชื่อมีคำว่า AMS แต่ไม่ใช่แอปนี้) → JSON [{pkg,label}] */
        @JavascriptInterface
        public String scannerConflicts() {
            JSONArray out = new JSONArray();
            try {
                for (ResolveInfo r : launchers()) {
                    String pkg = r.activityInfo.packageName, label = String.valueOf(r.loadLabel(getPackageManager()));
                    if (pkg.equals(getPackageName())) continue;
                    if (label.toUpperCase().contains("AMS") || pkg.toLowerCase().contains(".ams")) out.put(new JSONObject().put("pkg", pkg).put("label", label));
                }
            } catch (Exception ignored) { }
            return out.toString();
        }

        /** เปิดหน้าข้อมูลแอปนั้น (Force stop / Uninstall) */
        @JavascriptInterface
        public void openAppInfo(String pkg) {
            runOnUiThread(() -> { try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg))); } catch (Exception ignored) { } });
        }

        /** เปิดแอป ReaderConfig ของ CipherLab (หาจากชื่อแอป) → "OK" หรือ "NOTFOUND" */
        @JavascriptInterface
        public String openReaderConfig() {
            try {
                for (ResolveInfo r : launchers()) {
                    String label = String.valueOf(r.loadLabel(getPackageManager())).toLowerCase().replace(" ", ""), pkg = r.activityInfo.packageName.toLowerCase();
                    if (label.contains("readerconfig") || (pkg.contains("cipherlab") && (label.contains("reader") || pkg.contains("reader")))) {
                        Intent i = getPackageManager().getLaunchIntentForPackage(r.activityInfo.packageName);
                        if (i == null) continue;
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        runOnUiThread(() -> { try { startActivity(i); } catch (Exception ignored) { } });
                        return "OK";
                    }
                }
            } catch (Exception ignored) { }
            return "NOTFOUND";
        }

        @JavascriptInterface
        public void reload() { runOnUiThread(() -> { if (web != null) web.loadUrl(START_URL); }); }

        @JavascriptInterface
        public String appVersion() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }
    }
}
