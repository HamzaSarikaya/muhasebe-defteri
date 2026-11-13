package app.muhasebedefteri.android;

import android.net.Uri;
import android.content.ComponentName;
import android.content.Context;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class TrustedOriginTest {
    @Test
    public void testWorkspaceAndLocaleLinksAreAccepted() {
        assertTrue(LauncherActivity.isWorkspaceUrl(Uri.parse(LauncherActivity.START_URL)));
        assertTrue(LauncherActivity.isWorkspaceUrl(Uri.parse("https://muhasebe-defteri.vercel.app/en/reports?view=all#history")));
    }

    @Test
    public void testUntrustedSchemesHostsPortsAndCredentialsAreRejected() {
        for (String value : new String[] {
            "http://muhasebe-defteri.vercel.app/tr",
            "https://muhasebe-defteri.vercel.app.evil.test/tr",
            "https://evil.test/tr",
            "https://muhasebe-defteri.vercel.app:444/tr",
            "https://user@muhasebe-defteri.vercel.app/tr",
            "javascript:alert(1)", "file:///sdcard/data", "intent://example"
        }) {
            assertFalse(value, LauncherActivity.isWorkspaceUrl(Uri.parse(value)));
        }
        assertFalse(LauncherActivity.isWorkspaceUrl(null));
    }
}
