package app.muhasebedefteri.android;
import android.view.View;
import android.webkit.WebSettings;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public final class SplashScreenTest {
    @Test public void loadingCoverAndWebViewShareOneWindow() {
        try (ActivityScenario<LauncherActivity> scenario = ActivityScenario.launch(LauncherActivity.class)) {
            scenario.onActivity(activity -> {
                activity.webView.stopLoading();
                assertEquals(activity.cover.getParent(), activity.webView.getParent());
                assertEquals(View.VISIBLE, activity.cover.getVisibility());
                assertFalse(activity.webView.getSettings().getAllowFileAccess());
                assertFalse(activity.webView.getSettings().getAllowContentAccess());
                assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, activity.webView.getSettings().getMixedContentMode());
            });
        }
    }
    @Test public void firstCommittedFrameReleasesCoverWithoutWaitingForATimer() throws Exception {
        try (ActivityScenario<LauncherActivity> scenario = ActivityScenario.launch(LauncherActivity.class)) {
            scenario.onActivity(activity -> {
                activity.webView.stopLoading();
                activity.webView.loadDataWithBaseURL(LauncherActivity.START_URL,
                    "<html style='background:#f2f2f4'><body>Ready</body></html>", "text/html", "UTF-8", null);
            });
            AtomicBoolean ready = new AtomicBoolean();
            long end = System.currentTimeMillis() + 15000;
            while (!ready.get() && System.currentTimeMillis() < end) {
                InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                scenario.onActivity(activity -> ready.set(activity.cover.getVisibility() == View.GONE));
                Thread.sleep(100);
            }
            assertTrue("Cover should release when a web frame is ready", ready.get());
        }
    }
    @Test public void trustedExportsOpenSystemFileChooser() throws Exception {
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        android.content.IntentFilter filter = new android.content.IntentFilter(android.content.Intent.ACTION_CREATE_DOCUMENT);
        filter.addCategory(android.content.Intent.CATEGORY_OPENABLE);
        filter.addDataType("application/json");
        android.app.Instrumentation.ActivityMonitor monitor = instrumentation.addMonitor(
            filter,
            new android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_CANCELED, null), true);
        try (ActivityScenario<LauncherActivity> scenario = ActivityScenario.launch(LauncherActivity.class)) {
            AtomicBoolean ready = new AtomicBoolean();
            long end = System.currentTimeMillis() + 30000;
            while (!ready.get() && System.currentTimeMillis() < end) {
                instrumentation.waitForIdleSync();
                scenario.onActivity(activity -> ready.set(activity.cover.getVisibility() == View.GONE));
                Thread.sleep(100);
            }
            assertTrue(ready.get());
            scenario.onActivity(activity -> assertTrue(activity.webView.getUrl(),
                LauncherActivity.isWorkspaceUrl(android.net.Uri.parse(activity.webView.getUrl()))));
            java.util.concurrent.atomic.AtomicReference<String> bridge = new java.util.concurrent.atomic.AtomicReference<>();
            java.util.concurrent.CountDownLatch checked = new java.util.concurrent.CountDownLatch(1);
            scenario.onActivity(activity -> activity.webView.evaluateJavascript("typeof MuhasebeFiles",
                value -> { bridge.set(value); checked.countDown(); }));
            assertTrue(checked.await(5, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals("\"object\"", bridge.get());
            scenario.onActivity(activity -> activity.webView.evaluateJavascript(
                "MuhasebeFiles.postMessage(JSON.stringify({name:'muhasebe-backup-2026-01-01.json',type:'application/json',content:'{}'}))", null));
            end = System.currentTimeMillis() + 10000;
            while (monitor.getHits() == 0 && System.currentTimeMillis() < end) Thread.sleep(100);
            assertEquals(1, monitor.getHits());
        } finally { instrumentation.removeMonitor(monitor); }
    }

}
