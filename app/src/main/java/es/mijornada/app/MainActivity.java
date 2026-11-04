package es.mijornada.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Source;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int PICK_FILE_REQUEST = 1001;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private FirebaseAuth auth;
    private FirebaseFirestore firestore;
    private boolean writeInProgress = false;
    private String pendingPayload = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        auth = FirebaseAuth.getInstance();
        firestore = FirebaseFirestore.getInstance();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        webView.addJavascriptInterface(new CloudBridge(), "AndroidCloud");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equalsIgnoreCase(uri.getScheme())
                        && uri.getPath() != null
                        && uri.getPath().startsWith("/android_asset/")) return false;
                String scheme = uri.getScheme();
                if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (Exception ignored) { }
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK_FILE_REQUEST);
                    return true;
                } catch (Exception exception) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private boolean signedInAs(String uid) {
        FirebaseUser current = auth.getCurrentUser();
        return current != null && uid.equals(current.getUid());
    }

    private void send(String type, JSONObject fields) {
        try {
            fields.put("type", type);
            String quoted = JSONObject.quote(fields.toString());
            runOnUiThread(() -> {
                if (webView != null) {
                    webView.evaluateJavascript(
                            "window.miJornadaOnNative && window.miJornadaOnNative(" + quoted + ");",
                            null);
                }
            });
        } catch (JSONException ignored) { }
    }

    private void reportError(String type, Exception error) {
        JSONObject fields = new JSONObject();
        try {
            fields.put("message", error.getLocalizedMessage() == null
                    ? "No se pudo conectar. Revisa Internet y la configuración de Firebase."
                    : error.getLocalizedMessage());
        } catch (JSONException ignored) { }
        send(type, fields);
    }

    private void sendSessionAndFetch() {
        FirebaseUser user = auth.getCurrentUser();
        JSONObject fields = new JSONObject();
        try {
            if (user != null) {
                fields.put("uid", user.getUid());
                fields.put("email", user.getEmail() == null ? "" : user.getEmail());
            }
        } catch (JSONException ignored) { }
        send("session", fields);
        if (user != null) fetchRemote(user.getUid());
    }

    private void fetchRemote(String uid) {
        firestore.collection("users").document(uid)
                .collection("backups").document("primary")
                .get(Source.SERVER)
                .addOnSuccessListener(document -> {
                    if (!signedInAs(uid)) return;
                    JSONObject fields = new JSONObject();
                    try {
                        String payload = document.getString("payload");
                        fields.put("exists", document.exists() && payload != null);
                        if (payload != null) fields.put("payload", payload);
                    } catch (JSONException ignored) { }
                    send("remote", fields);
                })
                .addOnFailureListener(e -> {
                    if (signedInAs(uid)) reportError("remoteError", e);
                });
    }

    private void saveRemote(String payload) {
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            send("saveError", new JSONObject());
            return;
        }
        if (payload == null || payload.length() > 900000) {
            reportError("saveError", new IllegalArgumentException(
                    "La copia es demasiado grande para la nube. Exporta una copia JSON."));
            return;
        }
        pendingPayload = payload;
        flushPending();
    }

    private void flushPending() {
        if (writeInProgress || pendingPayload == null) return;
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) return;
        String uid = user.getUid();
        String payload = pendingPayload;
        pendingPayload = null;
        writeInProgress = true;
        Map<String, Object> fields = new HashMap<>();
        fields.put("payload", payload);
        fields.put("updatedAt", FieldValue.serverTimestamp());
        fields.put("schemaVersion", 3);
        firestore.collection("users").document(uid)
                .collection("backups").document("primary")
                .set(fields)
                .addOnSuccessListener(unused -> {
                    writeInProgress = false;
                    if (signedInAs(uid)) {
                        JSONObject result = new JSONObject();
                        try { result.put("payload", payload); }
                        catch (JSONException ignored) { }
                        send("saved", result);
                        flushPending();
                    }
                })
                .addOnFailureListener(e -> {
                    writeInProgress = false;
                    if (signedInAs(uid)) {
                        if (pendingPayload == null) pendingPayload = payload;
                        reportError("saveError", e);
                    }
                });
    }

    public class CloudBridge {
        @JavascriptInterface
        public void getSession() {
            runOnUiThread(() -> sendSessionAndFetch());
        }

        @JavascriptInterface
        public void signIn(String email, String password) {
            runOnUiThread(() -> authenticate(email, password, false));
        }

        @JavascriptInterface
        public void createAccount(String email, String password) {
            runOnUiThread(() -> authenticate(email, password, true));
        }

        @JavascriptInterface
        public void signOut() {
            runOnUiThread(() -> {
                pendingPayload = null;
                auth.signOut();
                send("session", new JSONObject());
            });
        }

        @JavascriptInterface
        public void saveSnapshot(String payload) {
            runOnUiThread(() -> saveRemote(payload));
        }
    }

    private void authenticate(String email, String password, boolean create) {
        String clean = email == null ? "" : email.trim();
        if (clean.isEmpty() || password == null || password.length() < 6) {
            reportError("authError", new IllegalArgumentException(
                    "Introduce un correo válido y una contraseña de al menos 6 caracteres."));
            return;
        }
        if (create) {
            auth.createUserWithEmailAndPassword(clean, password)
                    .addOnSuccessListener(result -> sendSessionAndFetch())
                    .addOnFailureListener(e -> reportError("authError", e));
        } else {
            auth.signInWithEmailAndPassword(clean, password)
                    .addOnSuccessListener(result -> sendSessionAndFetch())
                    .addOnFailureListener(e -> reportError("authError", e));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE_REQUEST && fileCallback != null) {
            fileCallback.onReceiveValue(
                    WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) webView.destroy();
        webView = null;
        super.onDestroy();
    }
}
