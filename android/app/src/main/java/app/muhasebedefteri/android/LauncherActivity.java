package app.muhasebedefteri.android;

import android.net.Uri;

/** Opens only the production workspace; external intents cannot replace the trusted origin. */
public final class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    static final String HOST = "muhasebe-defteri.vercel.app";
    static final String START_URL = "https://" + HOST + "/";

    static boolean isWorkspaceUrl(Uri uri) {
        return uri != null
            && "https".equalsIgnoreCase(uri.getScheme())
            && HOST.equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443)
            && uri.getUserInfo() == null;
    }

    @Override
    protected Uri getLaunchingUrl() {
        Uri requested = getIntent().getData();
        return isWorkspaceUrl(requested) ? requested : Uri.parse(START_URL);
    }
}
