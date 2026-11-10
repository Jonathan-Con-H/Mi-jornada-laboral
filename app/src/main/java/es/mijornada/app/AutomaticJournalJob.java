package es.mijornada.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.util.Calendar;

/** Sincroniza jornadas finalizadas mediante trabajo periódico de Android. */
public final class AutomaticJournalJob extends JobService {
    static final String PREFS = "miJornada.background.v1";
    private static final int JOB_ID = 241125;
    private static final long INTERVAL_MS = 15L * 60L * 1000L;
    private static final long FLEX_MS = 5L * 60L * 1000L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView worker;
    private JobParameters activeParams;
    private boolean stopping = false;
    private Runnable timeout;

    public static void schedule(Context context) {
        JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (scheduler == null || scheduler.getPendingJob(JOB_ID) != null) return;
        JobInfo job = new JobInfo.Builder(JOB_ID,
                new ComponentName(context, AutomaticJournalJob.class))
                .setPeriodic(INTERVAL_MS, FLEX_MS)
                .setPersisted(true)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_NONE)
                .build();
        scheduler.schedule(job);
    }

    private String dueSlot() {
        Calendar clock = Calendar.getInstance();
        int minutes = clock.get(Calendar.HOUR_OF_DAY) * 60 + clock.get(Calendar.MINUTE);
        if (minutes < 14 * 60) return null;
        int shiftEnd = minutes >= 22 * 60 ? 22 : 14;
        String day = String.format(java.util.Locale.ROOT, "%04d%02d%02d",
                clock.get(Calendar.YEAR), clock.get(Calendar.MONTH) + 1,
                clock.get(Calendar.DAY_OF_MONTH));
        String slot = day + "-" + shiftEnd;
        SharedPreferences settings = getSharedPreferences(PREFS, MODE_PRIVATE);
        return slot.equals(settings.getString("lastSlot", "")) ? null : slot;
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        // Si la pantalla está visible, su temporizador actualiza el registro.
        if (MainActivity.isVisible) return false;
        final String slot = dueSlot();
        if (slot == null) return false;
        activeParams = params;
        stopping = false;
        try {
            worker = new WebView(getApplicationContext());
            WebSettings cfg = worker.getSettings();
            cfg.setJavaScriptEnabled(true);
            cfg.setDomStorageEnabled(true);
            cfg.setAllowFileAccess(true);
            cfg.setAllowFileAccessFromFileURLs(false);
            cfg.setAllowUniversalAccessFromFileURLs(false);
            worker.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    if (stopping || view != worker) return;
                    // El JS sincroniza jornadas al iniciar; confirmar su carga.
                    view.evaluateJavascript(
                            "Boolean(window.miJornadaBridge && window.miJornadaBridge.syncCompleted && window.miJornadaBridge.syncCompleted())",
                            value -> {
                                if (stopping) return;
                                boolean ready = "true".equals(value);
                                if (ready) {
                                    getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                                            .putString("lastSlot", slot)
                                            .putLong("lastSuccess", System.currentTimeMillis())
                                            .apply();
                                }
                                finish(!ready);
                            });
                }
            });
            timeout = () -> finish(true);
            handler.postDelayed(timeout, 25000L);
            worker.loadUrl("file:///android_asset/index.html");
            return true;
        } catch (Throwable error) {
            clearWebView();
            activeParams = null;
            return false;
        }
    }

    private void clearWebView() {
        if (timeout != null) handler.removeCallbacks(timeout);
        timeout = null;
        if (worker != null) {
            worker.stopLoading();
            worker.destroy();
            worker = null;
        }
    }

    private void finish(boolean retry) {
        if (stopping) return;
        stopping = true;
        clearWebView();
        JobParameters params = activeParams;
        activeParams = null;
        if (params != null) jobFinished(params, retry);
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        stopping = true;
        clearWebView();
        activeParams = null;
        return true;
    }
}
