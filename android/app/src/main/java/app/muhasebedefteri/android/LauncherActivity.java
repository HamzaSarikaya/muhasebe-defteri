package app.muhasebedefteri.android;

import android.annotation.SuppressLint;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.lifecycle.ViewModel;
import androidx.lifecycle.ViewModelProvider;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.splashscreen.SplashScreen;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** The loading cover and the first web frame share one Android window. */
public final class LauncherActivity extends ComponentActivity {
    static final String HOST = "muhasebe-defteri.vercel.app";
    static final String START_URL = "https://" + HOST + "/";
    static final int CANVAS = Color.rgb(242, 242, 244);
    private static final int SAVE_FILE = 10;
    private static final int MAX_EXPORT_BYTES = 16 * 1024 * 1024;
    WebView webView;
    LinearLayout cover;
    private FrameLayout root;
    private TextView status;
    private Button retry;
    private boolean failed;
    private String currentUrl = START_URL;
    public static final class ExportState extends ViewModel { byte[] content; }
    private ExportState exportState;
    private final ExecutorService fileWriter = Executors.newSingleThreadExecutor();

    @Override protected void onCreate(Bundle state) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(state);
        exportState = new ViewModelProvider(this).get(ExportState.class);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { navigateBack(); }
        });
        root = new FrameLayout(this);
        root.setBackgroundColor(CANVAS);
        if (Build.VERSION.SDK_INT >= 29) root.setForceDarkAllowed(false);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);
        buildCover();
        createWebView();
        Uri link = getIntent().getData();
        if (isWorkspaceUrl(link)) currentUrl = link.toString();
        if (state == null || webView.restoreState(state) == null) webView.loadUrl(currentUrl);
    }
    private void buildCover() {
        cover = new LinearLayout(this);
        cover.setOrientation(LinearLayout.VERTICAL);
        cover.setGravity(Gravity.CENTER);
        cover.setBackgroundColor(CANVAS);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.splash_logo);
        logo.setContentDescription(getString(R.string.app_name));
        cover.addView(logo, new LinearLayout.LayoutParams(dp(240), dp(192)));
        status = new TextView(this);
        status.setText(R.string.loading);
        status.setTextColor(Color.rgb(102, 102, 111));
        status.setGravity(Gravity.CENTER);
        status.setPadding(dp(24), dp(16), dp(24), dp(16));
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        cover.addView(status);
        retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(view -> {
            if (webView == null) createWebView();
            failed = false;
            status.setText(R.string.loading);
            retry.setVisibility(View.GONE);
            webView.loadUrl(currentUrl);
        });
        cover.addView(retry);
        root.addView(cover, new FrameLayout.LayoutParams(-1, -1));
    }
    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(CANVAS);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "MuhasebeFiles", Collections.singleton("https://" + HOST),
                (view, message, origin, mainFrame, reply) -> {
                    if (mainFrame && isWorkspaceUrl(origin) && isWorkspaceUrl(Uri.parse(view.getUrl() == null ? "" : view.getUrl())))
                        saveExport(message.getData());
                });
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!request.isForMainFrame()) return !isWorkspaceUrl(url);
                if (isWorkspaceUrl(url)) return false;
                if (request.hasGesture()) openExternal(url);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                failed = false;
                if (isWorkspaceUrl(Uri.parse(url))) currentUrl = url;
            }
            @Override public void onPageCommitVisible(WebView view, String url) {
                if (failed || !isWorkspaceUrl(Uri.parse(url))) return;
                // Native padding already reserves bars, cutouts and the keyboard.
                // Clear the web safe areas before revealing the first frame to avoid double insets.
                view.evaluateJavascript("(function(){var s=document.documentElement.style;"
                    + "['top','right','bottom','left'].forEach(function(edge){s.setProperty('--safe-'+edge,'0px');});})()", ignored -> {
                    if (failed || isDestroyed() || webView != view) return;
                    view.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                        @Override public void onComplete(long requestId) {
                            if (!failed && !isDestroyed()) cover.setVisibility(View.GONE);
                        }
                    });
                });
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) showError();
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                root.removeView(view);
                view.destroy();
                webView = null;
                showError();
                return true;
            }
        });
        root.addView(webView, 0, new FrameLayout.LayoutParams(-1, -1));
    }
    private void showError() {
        failed = true;
        status.setText(R.string.connection_error);
        retry.setVisibility(View.VISIBLE);
        cover.setVisibility(View.VISIBLE);
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    static boolean isWorkspaceUrl(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
    }
    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"mailto".equalsIgnoreCase(scheme) && !"tel".equalsIgnoreCase(scheme)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException ignored) { /* No external handler installed. */ }
    }
    private void saveExport(String message) {
        if (exportState.content != null || message == null || message.length() > MAX_EXPORT_BYTES) return;
        try {
            JSONObject file = new JSONObject(message);
            String name = file.getString("name");
            String type = file.getString("type");
            if (!name.matches("muhasebe-(backup|activity)-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.(csv|json)")) return;
            if (!(name.endsWith(".csv") && type.equals("text/csv"))
                    && !(name.endsWith(".json") && type.equals("application/json"))) return;
            byte[] content = file.getString("content").getBytes(StandardCharsets.UTF_8);
            if (content.length > MAX_EXPORT_BYTES) return;
            exportState.content = content;
            startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType(type).putExtra(Intent.EXTRA_TITLE, name), SAVE_FILE);
        } catch (Exception error) {
            exportState.content = null;
            Toast.makeText(this, R.string.file_error, Toast.LENGTH_SHORT).show();
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent result) {
        super.onActivityResult(requestCode, resultCode, result);
        if (requestCode != SAVE_FILE) return;
        byte[] content = exportState.content;
        exportState.content = null;
        if (resultCode != RESULT_OK || result == null || result.getData() == null) return;
        if (content == null) {
            Toast.makeText(this, R.string.file_error, Toast.LENGTH_SHORT).show();
            return;
        }
        Uri destination = result.getData();
        fileWriter.execute(() -> {
            boolean saved = false;
            try (OutputStream stream = getContentResolver().openOutputStream(destination)) {
                if (stream != null) { stream.write(content); saved = true; }
            } catch (Exception ignored) { /* Never log financial export contents. */ }
            final int notice = saved ? R.string.file_saved : R.string.file_error;
            runOnUiThread(() -> Toast.makeText(this, notice, Toast.LENGTH_SHORT).show());
        });
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri uri = intent.getData();
        if (webView != null && isWorkspaceUrl(uri)) webView.loadUrl(uri.toString());
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (webView != null) webView.saveState(state);
    }
    @Override protected void onPause() {
        CookieManager.getInstance().flush();
        if (webView != null) webView.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }
    private void navigateBack() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else finish();
    }
    @Override protected void onDestroy() {
        if (webView != null) { root.removeView(webView); webView.destroy(); }
        if (!isChangingConfigurations()) exportState.content = null;
        fileWriter.shutdown();
        super.onDestroy();
    }
}
