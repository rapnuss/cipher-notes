package com.ciphernotes.twa;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ServiceWorkerWebSettings;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.util.Locale;

/**
 * Serves the pre-built PWA from {@code app/src/main/assets/www} directly inside a {@link WebView}.
 * Only API calls go out to the network; all static frontend assets are shipped with the APK.
 */
public class LocalWebViewActivity extends AppCompatActivity {
    private static final String LOCAL_INDEX_PATH = "https://appassets.androidplatform.net/index.html";
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private WebView webView;
    private WebViewAssetLoader assetLoader;

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
        view.setWebChromeClient(new WebChromeClient());
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
                if (LOCAL_HOST.equals(uri.getHost())) {
                    return false;
                }
                Intent external = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(external);
                return true;
            }
        });

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
}
