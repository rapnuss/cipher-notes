package com.ciphernotes.twa;

import android.annotation.SuppressLint;
import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ServiceWorkerWebSettings;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.net.URLConnection;
import java.util.Locale;

/**
 * Serves the pre-built PWA from {@code app/src/main/assets/www} directly inside a {@link WebView}.
 * Only API calls go out to the network; all static frontend assets are shipped with the APK.
 */
public class LocalWebViewActivity extends AppCompatActivity {
    private static final String TAG = "LocalWebViewActivity";
    private static final String LOCAL_HOST = "ciphernotes.com";
    private static final String LOCAL_INDEX_PATH = "https://" + LOCAL_HOST + "/index.html";
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private static final int CAMERA_PERMISSION_REQUEST_CODE = 2001;
    private static final int STORAGE_PERMISSION_REQUEST_CODE = 2002;
    private static final int FILE_CHOOSER_CAMERA_PERMISSION_REQUEST_CODE = 2003;
    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private ValueCallback<Uri[]> filePathCallback;
    private ValueCallback<Uri> legacyFilePathCallback;
    private PermissionRequest pendingPermissionRequest;
    private PendingDownload pendingDownload;
    private Uri cameraImageUri;
    private boolean awaitingCameraPermissionForChooser;
    private WebChromeClient.FileChooserParams pendingFileChooserParams;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_local_webview);

        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(LOCAL_HOST)
                .addPathHandler("/", this::openAsset)
                .build();

        webView = findViewById(R.id.webview);
        configureWebView(webView);
        webView.addJavascriptInterface(new DownloadBridge(this), "AndroidDownloader");
        enableServiceWorker(assetLoader);

        loadInitialUrl(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        loadInitialUrl(intent);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @SuppressLint({"SetJavaScriptEnabled"})
    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " CiphernotesTwa/3");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(view, true);
        }

        view.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        view.setWebChromeClient(new WebChromeClient() {
            // Android 5.0+ (API 21) path
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                LocalWebViewActivity.this.clearFileCallbacks();
                LocalWebViewActivity.this.filePathCallback = filePathCallback;
                if (!hasCameraPermission()) {
                    awaitingCameraPermissionForChooser = true;
                    pendingFileChooserParams = fileChooserParams;
                    ActivityCompat.requestPermissions(LocalWebViewActivity.this,
                            new String[]{Manifest.permission.CAMERA},
                            FILE_CHOOSER_CAMERA_PERMISSION_REQUEST_CODE);
                    return true;
                }
                return launchFileChooser(fileChooserParams, true);
            }

            // Android 4.1 - 4.4 path
            @SuppressWarnings("unused")
            public void openFileChooser(ValueCallback<Uri> uploadMsg, String acceptType, String capture) {
                LocalWebViewActivity.this.clearFileCallbacks();
                LocalWebViewActivity.this.legacyFilePathCallback = uploadMsg;
                Intent intent = buildFilePickerIntent(false, acceptType != null ? new String[]{acceptType} : null);
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (ActivityNotFoundException e) {
                    LocalWebViewActivity.this.clearFileCallbacks();
                }
            }

            // Android 3.0+ path
            @SuppressWarnings("unused")
            public void openFileChooser(ValueCallback<Uri> uploadMsg, String acceptType) {
                openFileChooser(uploadMsg, acceptType, null);
            }

            // Android <3.0 path
            @SuppressWarnings("unused")
            public void openFileChooser(ValueCallback<Uri> uploadMsg) {
                openFileChooser(uploadMsg, "*/*", null);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
                    super.onPermissionRequest(request);
                    return;
                }
                runOnUiThread(() -> handlePermissionRequest(request));
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingPermissionRequest != null && pendingPermissionRequest == request) {
                    pendingPermissionRequest = null;
                }
                super.onPermissionRequestCanceled(request);
            }
        });
        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) {
                WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
                if (response != null) {
                    return response;
                }
                return super.shouldInterceptRequest(v, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (LOCAL_HOST.equals(uri.getHost())
                        || "blob".equalsIgnoreCase(scheme)
                        || "data".equalsIgnoreCase(scheme)
                        || "about".equalsIgnoreCase(scheme)) {
                    return false;
                }
                Intent external = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(external);
                return true;
            }
        });

    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST_CODE) {
            return;
        }

        Uri[] result = null;
        if (resultCode == Activity.RESULT_OK) {
            if (data == null) {
                // capture outside this flow; nothing to do
            } else if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) {
                    result[i] = data.getClipData().getItemAt(i).getUri();
                    grantUriPermission(result[i]);
                }
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
                grantUriPermission(result[0]);
            }
        }

        if (result == null && cameraImageUri != null && resultCode == Activity.RESULT_OK) {
            result = new Uri[]{cameraImageUri};
        }

        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        } else if (legacyFilePathCallback != null) {
            Uri single = result != null && result.length > 0 ? result[0] : null;
            legacyFilePathCallback.onReceiveValue(single);
            legacyFilePathCallback = null;
        }
        cameraImageUri = null;
    }

    private void grantUriPermission(Uri uri) {
        if (uri == null) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            try {
                getContentResolver().takePersistableUriPermission(uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (SecurityException ignored) {
                // Not all providers allow persistable permissions; ignore failures.
            }
        }
    }

    private void clearFileCallbacks() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
        }
        if (legacyFilePathCallback != null) {
            legacyFilePathCallback.onReceiveValue(null);
        }
        filePathCallback = null;
        legacyFilePathCallback = null;
    }

    private Intent buildFilePickerIntent(boolean allowMultiple, @Nullable String[] acceptTypes) {
        Intent intent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT
                ? new Intent(Intent.ACTION_OPEN_DOCUMENT)
                : new Intent(Intent.ACTION_GET_CONTENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);

        String type = "*/*";
        if (acceptTypes != null) {
            for (String candidate : acceptTypes) {
                if (candidate != null && !candidate.isEmpty() && !"*/*".equals(candidate)) {
                    type = candidate;
                    break;
                }
            }
        }

        intent.setType(type);
        if (acceptTypes != null && acceptTypes.length > 1) {
            intent.putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes);
        }

        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        return intent;
    }

    private Intent createCameraIntent() {
        Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (cameraIntent.resolveActivity(getPackageManager()) == null) {
            return null;
        }
        try {
            File photoFile = createCameraImageFile();
            cameraImageUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photoFile);
            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
            cameraIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return cameraIntent;
        } catch (IOException e) {
            Log.e(TAG, "Unable to create camera temp file", e);
            cameraImageUri = null;
            return null;
        }
    }

    private File createCameraImageFile() throws IOException {
        File storageDir = new File(getCacheDir(), "camera");
        if (!storageDir.exists() && !storageDir.mkdirs()) {
            throw new IOException("Unable to create camera cache directory");
        }
        return File.createTempFile("ciphernotes_capture_", ".jpg", storageDir);
    }

    private boolean launchFileChooser(@Nullable WebChromeClient.FileChooserParams params, boolean includeCamera) {
        boolean allowMultiple = params != null && params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;
        String[] acceptTypes = params != null ? params.getAcceptTypes() : null;
        Intent pickerIntent = buildFilePickerIntent(allowMultiple, acceptTypes);
        Intent cameraIntent = null;
        if (includeCamera && hasCameraPermission()) {
            cameraIntent = createCameraIntent();
        }
        Intent intent;
        if (cameraIntent != null) {
            intent = new Intent(Intent.ACTION_CHOOSER);
            intent.putExtra(Intent.EXTRA_INTENT, pickerIntent);
            intent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
        } else {
            intent = pickerIntent;
        }
        try {
            startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
            return true;
        } catch (ActivityNotFoundException e) {
            LocalWebViewActivity.this.clearFileCallbacks();
            return false;
        }
    }

    private void handlePermissionRequest(PermissionRequest request) {
        boolean needsCamera = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            for (String resource : request.getResources()) {
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                    needsCamera = true;
                    break;
                }
            }
        }

        if (!needsCamera) {
            request.grant(request.getResources());
            return;
        }

        if (hasCameraPermission()) {
            request.grant(request.getResources());
        } else {
            pendingPermissionRequest = request;
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST_CODE);
        }
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return true;
        }
        return ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void handleDownloadRequest(String dataUrl, String filename) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q || hasStoragePermission()) {
            new Thread(() -> saveDataUrlToDownloads(dataUrl, filename)).start();
        } else {
            pendingDownload = new PendingDownload(dataUrl, filename);
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_PERMISSION_REQUEST_CODE);
        }
    }

    private void saveDataUrlToDownloads(String dataUrl, String filename) {
        try {
            int commaIndex = dataUrl.indexOf(',');
            if (commaIndex == -1) throw new IllegalArgumentException("Invalid data URL");
            String meta = dataUrl.substring(0, commaIndex);
            String base64Data = dataUrl.substring(commaIndex + 1);
            String mimeType = "application/octet-stream";
            if (meta.startsWith("data:")) {
                int semicolon = meta.indexOf(';');
                if (semicolon > 5) {
                    mimeType = meta.substring(5, semicolon);
                }
            }
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveViaMediaStore(bytes, mimeType, filename);
            } else {
                saveLegacy(bytes, mimeType, filename);
            }
            runOnUiThread(() -> Toast.makeText(this, "Exported to Downloads", Toast.LENGTH_LONG).show());
        } catch (Exception e) {
            Log.e(TAG, "Export failed", e);
            runOnUiThread(() -> Toast.makeText(this, "Export failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
        }
    }

    private void saveViaMediaStore(byte[] bytes, String mimeType, String filename) throws IOException {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Ciphernotes");
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
        Uri item = getContentResolver().insert(collection, values);
        if (item == null) throw new IOException("Unable to create download entry");
        try (OutputStream out = getContentResolver().openOutputStream(item)) {
            if (out == null) throw new IOException("Unable to open output stream");
            out.write(bytes);
        }
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        getContentResolver().update(item, values, null, null);
    }

    private void saveLegacy(byte[] bytes, String mimeType, String filename) throws IOException {
        File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File targetDir = new File(downloads, "Ciphernotes");
        if (!targetDir.exists() && !targetDir.mkdirs()) {
            throw new IOException("Unable to create download directory");
        }
        File outFile = new File(targetDir, filename);
        try (FileOutputStream fos = new FileOutputStream(outFile)) {
            fos.write(bytes);
        }
        MediaScannerConnection.scanFile(this, new String[]{outFile.getAbsolutePath()}, new String[]{mimeType}, null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (pendingPermissionRequest != null) {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                } else {
                    pendingPermissionRequest.deny();
                }
                pendingPermissionRequest = null;
            }
        } else if (requestCode == STORAGE_PERMISSION_REQUEST_CODE) {
            if (pendingDownload != null) {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    PendingDownload download = pendingDownload;
                    pendingDownload = null;
                    new Thread(() -> saveDataUrlToDownloads(download.dataUrl, download.filename)).start();
                } else {
                    runOnUiThread(() -> Toast.makeText(this, "Storage permission denied", Toast.LENGTH_LONG).show());
                    pendingDownload = null;
                }
            }
        } else if (requestCode == FILE_CHOOSER_CAMERA_PERMISSION_REQUEST_CODE) {
            if (awaitingCameraPermissionForChooser) {
                boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
                launchFileChooser(pendingFileChooserParams, granted);
                awaitingCameraPermissionForChooser = false;
                pendingFileChooserParams = null;
            }
        }
    }

    private void enableServiceWorker(WebViewAssetLoader loader) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return;
        }
        ServiceWorkerController controller = ServiceWorkerController.getInstance();
        ServiceWorkerWebSettings settings = controller.getServiceWorkerWebSettings();
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccess(false);
        settings.setBlockNetworkLoads(false);
        controller.setServiceWorkerClient(new ServiceWorkerClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                WebResourceResponse response = loader.shouldInterceptRequest(request.getUrl());
                if (response != null) {
                    return response;
                }
                return super.shouldInterceptRequest(request);
            }
        });
    }

    private void loadInitialUrl(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        String launchUrl = LOCAL_INDEX_PATH;
        if (data != null && "https".equals(data.getScheme())) {
            String encodedPath = data.getEncodedPath();
            String encodedQuery = data.getEncodedQuery();
            String encodedFragment = data.getEncodedFragment();

            StringBuilder route = new StringBuilder();
            route.append(encodedPath != null ? encodedPath : "/");
            if (encodedQuery != null && !encodedQuery.isEmpty()) {
                route.append('?').append(encodedQuery);
            }
            if (encodedFragment != null && !encodedFragment.isEmpty()) {
                route.append('#').append(encodedFragment);
            }
            String encodedRoute = Uri.encode(route.toString());
            launchUrl = LOCAL_INDEX_PATH + "?initialPath=" + encodedRoute;
        }
        webView.loadUrl(launchUrl);
    }

    private WebResourceResponse openAsset(String path) {
        String relative = path == null ? "" : path;
        if (relative.startsWith("/")) {
            relative = relative.substring(1);
        }
        if (relative.isEmpty() || relative.equals("index.html")) {
            relative = "index.html";
        }
        if (relative.endsWith("/")) {
            relative = relative + "index.html";
        }
        String assetPath = "www/" + relative;
        AssetManager assets = getAssets();
        try {
            InputStream input = assets.open(assetPath, AssetManager.ACCESS_STREAMING);
            String mimeType = guessMimeType(relative);
            String encoding = shouldUseUtf8(mimeType) ? "utf-8" : null;
            return new WebResourceResponse(mimeType, encoding, input);
        } catch (IOException e) {
            return null;
        }
    }

    private String guessMimeType(String path) {
        String mime = URLConnection.guessContentTypeFromName(path);
        if (mime != null) {
            return mime;
        }
        String lower = path.toLowerCase(Locale.US);
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) {
            return "application/javascript";
        }
        if (lower.endsWith(".css")) {
            return "text/css";
        }
        if (lower.endsWith(".json") || lower.endsWith(".webmanifest")) {
            return "application/json";
        }
        if (lower.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (lower.endsWith(".woff2")) {
            return "font/woff2";
        }
        if (lower.endsWith(".woff")) {
            return "font/woff";
        }
        if (lower.endsWith(".ttf")) {
            return "font/ttf";
        }
        if (lower.endsWith(".otf")) {
            return "font/otf";
        }
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lower.endsWith(".ico")) {
            return "image/x-icon";
        }
        if (lower.endsWith(".txt")) {
            return "text/plain";
        }
        return "application/octet-stream";
    }

    private boolean shouldUseUtf8(String mimeType) {
        return mimeType != null && (mimeType.startsWith("text/")
                || mimeType.equals("application/javascript")
                || mimeType.equals("application/json")
                || mimeType.equals("application/manifest+json")
                || mimeType.equals("application/xml")
                || mimeType.equals("image/svg+xml"));
    }

    private static class PendingDownload {
        final String dataUrl;
        final String filename;

        PendingDownload(String dataUrl, String filename) {
            this.dataUrl = dataUrl;
            this.filename = filename;
        }
    }

    private static class DownloadBridge {
        private final WeakReference<LocalWebViewActivity> activityRef;

        DownloadBridge(LocalWebViewActivity activity) {
            this.activityRef = new WeakReference<>(activity);
        }

        @JavascriptInterface
        public void saveBase64(String dataUrl, String filename) {
            LocalWebViewActivity activity = activityRef.get();
            if (activity != null) {
                activity.handleDownloadRequest(dataUrl, filename);
            }
        }
    }
}
