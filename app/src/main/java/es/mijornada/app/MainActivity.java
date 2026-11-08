package es.mijornada.app;

import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
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

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int PICK_FILE_REQUEST = 1001;
    private static final int CREATE_BACKUP_REQUEST = 1002;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingBackupJson = null;
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
        webView.addJavascriptInterface(new BackupBridge(), "AndroidBackup");

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


    // El sistema Android elige el archivo de destino. No se necesitan permisos
    // de almacenamiento ni servicios externos para guardar la copia local.
    private void notifyBackup(String message, boolean success) {
        JSONObject result = new JSONObject();
        try {
            result.put("ok", success);
            result.put("message", message);
            String quoted = JSONObject.quote(result.toString());
            runOnUiThread(() -> {
                if (webView != null) {
                    webView.evaluateJavascript(
                            "window.miJornadaOnBackup && window.miJornadaOnBackup(" + quoted + ");", null);
                }
            });
        } catch (JSONException ignored) { }
    }

    public class BackupBridge {
        @JavascriptInterface
        public void exportJson(String suggestedFilename, String json) {
            runOnUiThread(() -> {
                if (pendingBackupJson != null) {
                    notifyBackup("Ya hay una copia esperando a guardarse.", false);
                    return;
                }
                if (json == null || json.length() > 9000000 || json.isEmpty()) {
                    notifyBackup("La copia es demasiado grande o está vacía.", false);
                    return;
                }
                try {
                    JSONObject snapshot = new JSONObject(json);
                    if (!"Mi Jornada".equals(snapshot.optString("app"))
                            || !snapshot.has("data") || !snapshot.has("automatico")) {
                        notifyBackup("El contenido no parece una copia de Mi Jornada.", false);
                        return;
                    }
                } catch (JSONException invalidJson) {
                    notifyBackup("No se puede exportar una copia inválida.", false);
                    return;
                }
                String filename = suggestedFilename == null ? "" :
                        suggestedFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
                if (filename.isEmpty() || !filename.endsWith(".json")) {
                    filename = "mi-jornada-copia.json";
                }
                pendingBackupJson = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, filename);
                try {
                    startActivityForResult(intent, CREATE_BACKUP_REQUEST);
                } catch (ActivityNotFoundException exception) {
                    pendingBackupJson = null;
                    notifyBackup("No se encontró una aplicación para guardar el archivo JSON.", false);
                } catch (Exception exception) {
                    pendingBackupJson = null;
                    notifyBackup("No se pudo abrir el selector de archivos.", false);
                }
            });
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
        if (requestCode == CREATE_BACKUP_REQUEST) {
            String content = pendingBackupJson;
            pendingBackupJson = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null) {
                notifyBackup("Copia cancelada; no se ha eliminado ni modificado ningún dato.", false);
            } else if (content == null) {
                notifyBackup("No hay una copia pendiente para guardar.", false);
            } else {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                    if (stream == null) throw new IllegalStateException("No se pudo abrir el archivo");
                    stream.write(content.getBytes(StandardCharsets.UTF_8));
                    stream.flush();
                    notifyBackup("Copia JSON guardada. Conserva este archivo antes de actualizar.", true);
                } catch (Exception exception) {
                    notifyBackup("No se pudo guardar la copia. Prueba con otra carpeta.", false);
                }
            }
            return;
        }
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
