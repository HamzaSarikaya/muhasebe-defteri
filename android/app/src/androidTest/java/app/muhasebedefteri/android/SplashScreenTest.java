package app.muhasebedefteri.android;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Bundle;
import androidx.core.content.FileProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class SplashScreenTest {
    private Context context() {
        return InstrumentationRegistry.getInstrumentation().getTargetContext();
    }

    @Test
    public void splashArtworkCanBeRenderedAtDeviceDensity() throws Exception {
        Context context = context();
        Bundle metadata = context.getPackageManager().getActivityInfo(
            new ComponentName(context, LauncherActivity.class), PackageManager.GET_META_DATA).metaData;
        Drawable logo = context.getDrawable(metadata.getInt(
            "android.support.customtabs.trusted.SPLASH_IMAGE_DRAWABLE"));
        assertNotNull(logo);
        assertTrue(logo.getIntrinsicWidth() > 0);
        assertTrue(logo.getIntrinsicHeight() > 0);
        Bitmap image = Bitmap.createBitmap(logo.getIntrinsicWidth(), logo.getIntrinsicHeight(), Bitmap.Config.ARGB_8888);
        logo.setBounds(0, 0, image.getWidth(), image.getHeight());
        logo.draw(new Canvas(image));
        assertTrue((image.getPixel(image.getWidth() / 2, image.getHeight() / 2) >>> 24) > 0);
        image.recycle();
    }

    @Test
    public void browserCanOnlyReceiveTheSplashImageDirectory() throws Exception {
        Context context = context();
        Bundle metadata = context.getPackageManager().getActivityInfo(
            new ComponentName(context, LauncherActivity.class), PackageManager.GET_META_DATA).metaData;
        String authority = metadata.getString("android.support.customtabs.trusted.FILE_PROVIDER_AUTHORITY");
        ProviderInfo provider = context.getPackageManager().resolveContentProvider(authority, 0);
        assertNotNull(provider);
        assertFalse(provider.exported);
        assertTrue(provider.grantUriPermissions);
        Uri image = FileProvider.getUriForFile(context, authority,
            new File(context.getFilesDir(), "twa_splash/splash_image.png"));
        assertEquals(authority, image.getAuthority());
        try {
            FileProvider.getUriForFile(context, authority, new File(context.getFilesDir(), "outside-splash.txt"));
            fail("Files outside the splash directory must not be shared");
        } catch (IllegalArgumentException expected) {
            // The provider intentionally exposes only the splash directory.
        }
    }
}
