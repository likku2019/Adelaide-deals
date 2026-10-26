package au.adelaide.dealsheet;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Adelaide Deal Sheet: shows the weekly deal sheet website full screen.
 * Deals update every Wednesday on the website, so the app always shows the latest week,
 * and the last downloaded copy is shown when the phone is offline.
 */
public class MainActivity extends Activity {
  private static final String HOST = "likku2019.github.io";
  private static final String HOME = "https://likku2019.github.io/Adelaide-deals/?source=apk";
  private static final long RELOAD_AFTER_MS = 30 * 60 * 1000L;
  private static final int CAMERA_REQUEST = 42;
  private PermissionRequest pendingCamera = null;

  private WebView web;
  private long lastLoad = 0;
  private boolean showingError = false;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    FrameLayout root = new FrameLayout(this);
    web = new WebView(this);
    root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    setContentView(root);

    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setLoadWithOverviewMode(true);
    s.setUseWideViewPort(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setUserAgentString(s.getUserAgentString() + " DealSheetApp/1.1");
    s.setCacheMode(isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);

    web.addJavascriptInterface(new Bridge(), "DealSheetApp");
    web.setWebChromeClient(new WebChromeClient() {
      // the barcode scanner on the page asks for the camera: pass that on to Android's permission prompt
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        runOnUiThread(() -> {
          boolean wantsCamera = false;
          for (String r : request.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
          if (!wantsCamera || request.getOrigin() == null || !HOST.equals(request.getOrigin().getHost())) { request.deny(); return; }
          if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
          } else {
            pendingCamera = request;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST);
          }
        });
      }
    });
    web.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> openOutside(Uri.parse(url)));
    web.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
        Uri u = req.getUrl();
        if ("app".equals(u.getScheme()) && "retry".equals(u.getHost())) { loadHome(); return true; }
        String path = u.getPath();
        if (HOST.equals(u.getHost()) && (path == null || !path.endsWith(".apk"))) return false;
        openOutside(u);
        return true;
      }

      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
        if (url != null && url.startsWith("https://")) showingError = false;
      }

      @Override
      public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
        if (req.isForMainFrame() && !showingError) {
          showingError = true;
          view.loadDataWithBaseURL(null, OFFLINE_PAGE, "text/html", "utf-8", null);
        }
      }
    });

    Intent i = getIntent();
    if (state != null) web.restoreState(state);
    else if (i != null && i.getData() != null && HOST.equals(i.getData().getHost())) { web.loadUrl(i.getData().toString()); lastLoad = System.currentTimeMillis(); }
    else loadHome();
  }

  private void loadHome() {
    web.getSettings().setCacheMode(isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
    web.loadUrl(HOME);
    lastLoad = System.currentTimeMillis();
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    if (intent != null && intent.getData() != null && HOST.equals(intent.getData().getHost())) {
      web.loadUrl(intent.getData().toString());
      lastLoad = System.currentTimeMillis();
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    web.onResume();
    // pick up a new week's deals if the app has been in the background for a while
    if (lastLoad > 0 && System.currentTimeMillis() - lastLoad > RELOAD_AFTER_MS && isOnline()) {
      if (showingError) loadHome(); else { web.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT); web.reload(); lastLoad = System.currentTimeMillis(); }
    }
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(requestCode, permissions, results);
    if (requestCode != CAMERA_REQUEST || pendingCamera == null) return;
    if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pendingCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
    else pendingCamera.deny();
    pendingCamera = null;
  }

  @Override
  protected void onPause() { web.onPause(); super.onPause(); }

  @Override
  protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

  @SuppressWarnings("deprecation")
  @Override
  public void onBackPressed() {
    // close an open product panel first, then go back through pages, then leave the app
    web.evaluateJavascript("(function(){var s=document.getElementById('sheet');if(s&&s.open){s.close();return true}return false})()", value -> {
      if ("true".equals(value)) return;
      if (web.canGoBack()) web.goBack(); else MainActivity.super.onBackPressed();
    });
  }

  private boolean isOnline() {
    ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
    if (cm == null) return true;
    NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
    return nc != null && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
  }

  private void openOutside(Uri u) {
    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
  }

  /** Lets the page use Android's share sheet ("Share this deal"). */
  private class Bridge {
    @JavascriptInterface
    public void share(String text) {
      Intent send = new Intent(Intent.ACTION_SEND);
      send.setType("text/plain");
      send.putExtra(Intent.EXTRA_TEXT, text);
      send.putExtra(Intent.EXTRA_SUBJECT, "Adelaide Deal Sheet");
      runOnUiThread(() -> startActivity(Intent.createChooser(send, "Share deal")));
    }

    @JavascriptInterface
    public String version() { return "1.1"; }
  }

  private static final String OFFLINE_PAGE =
      "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'>"
    + "<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FFD21F;color:#14213D;"
    + "font-family:system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}"
    + "h1{font-size:28px;margin:0 0 8px}p{margin:0 0 20px;font-size:16px;line-height:1.5}"
    + "a{display:inline-block;background:#14213D;color:#FFD21F;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px}</style></head>"
    + "<body><div><h1>No internet connection</h1><p>The deal sheet needs to download this week's deals once.<br>Check your connection and try again.</p>"
    + "<a href='app://retry'>Try again</a></div></body></html>";
}
