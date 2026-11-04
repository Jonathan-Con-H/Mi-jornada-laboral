package es.mijornada.app;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Puente nativo entre el calendario HTML y una copia privada en Firebase.
 * Sin configuración, la app sigue funcionando normalmente y solo en local.
 */
public final class CloudBridge {
    private final Activity activity;
    private final WebView webView;
    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private boolean ready = false;

    public CloudBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        try (InputStream stream = activity.getAssets().open("firebase-config.json")) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int n;
            while ((n = stream.read(chunk)) != -1) buffer.write(chunk, 0, n);
            JSONObject config = new JSONObject(new String(buffer.toByteArray(), StandardCharsets.UTF_8));
            String appId = config.optString("applicationId", "").trim();
            String apiKey = config.optString("apiKey", "").trim();
            String projectId = config.optString("projectId", "").trim();
            if (appId.isEmpty() || apiKey.isEmpty() || projectId.isEmpty()) return;

            FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId(appId)
                    .setApiKey(apiKey)
                    .setProjectId(projectId)
                    .build();
            FirebaseApp firebaseApp = FirebaseApp.initializeApp(activity.getApplicationContext(), options);
            auth = FirebaseAuth.getInstance(firebaseApp);
            db = FirebaseFirestore.getInstance(firebaseApp);
            ready = true;
            auth.addAuthStateListener(firebaseAuth -> notifyStatus());
        } catch (Exception ignored) {
            // Nunca impedir la apertura de Mi Jornada por una nube sin configurar.
            ready = false;
        }
    }

    private void send(String type, String value) {
        JSONObject message = new JSONObject();
        try {
            message.put("type", type);
            message.put("value", value == null ? JSONObject.NULL : value);
        } catch (Exception ignored) { return; }
        activity.runOnUiThread(() ->
                webView.evaluateJavascript("window.miCloudEvent && window.miCloudEvent(" + message.toString() + ");", null));
    }

    public void notifyStatus() {
        if (!ready) {
            send("unavailable", null);
            return;
        }
        FirebaseUser current = auth.getCurrentUser();
        if (current == null) {
            send("signedout", null);
        } else {
            JSONObject state = new JSONObject();
            try {
                state.put("uid", current.getUid());
                state.put("email", current.getEmail());
            } catch (Exception ignored) { return; }
            send("signedin", state.toString());
        }
    }

    private boolean isSignedIn() {
        if (!ready || auth.getCurrentUser() == null) {
            send("error", "Inicia sesión primero.");
            return false;
        }
        return true;
    }

    @JavascriptInterface public void signIn(String email, String password) {
        if (!ready) { send("unavailable", null); return; }
        if (email == null || password == null || email.trim().isEmpty() || password.isEmpty()) {
            send("error", "Introduce correo y contraseña."); return;
        }
        auth.signInWithEmailAndPassword(email.trim(), password)
                .addOnFailureListener(e -> send("error", "No se pudo iniciar sesión. Comprueba el correo y la contraseña."));
    }

    @JavascriptInterface public void signUp(String email, String password) {
        if (!ready) { send("unavailable", null); return; }
        if (email == null || password == null || email.trim().isEmpty() || password.length() < 6) {
            send("error", "Indica un correo válido y una contraseña de al menos 6 caracteres."); return;
        }
        auth.createUserWithEmailAndPassword(email.trim(), password)
                .addOnFailureListener(e -> send("error", "No se pudo crear la cuenta. Revisa el correo o si ya existe."));
    }

    @JavascriptInterface public void signOut() {
        if (ready) auth.signOut();
        notifyStatus();
    }

    @JavascriptInterface public void upload(String payload) {
        if (!isSignedIn()) return;
        if (payload == null || payload.getBytes(StandardCharsets.UTF_8).length > 700000) {
            send("error", "La copia es demasiado grande para este tipo de almacenamiento.");
            return;
        }
        String uid = auth.getCurrentUser().getUid();
        Map<String, Object> copy = new HashMap<>();
        copy.put("payload", payload);
        copy.put("updatedAt", FieldValue.serverTimestamp());
        db.collection("users").document(uid).collection("backups").document("main")
                .set(copy)
                .addOnSuccessListener(unused -> send("uploaded", null))
                .addOnFailureListener(e -> send("error", "No se pudo subir la copia. Comprueba la conexión y las reglas de Firestore."));
    }

    @JavascriptInterface public void download() {
        if (!isSignedIn()) return;
        String uid = auth.getCurrentUser().getUid();
        db.collection("users").document(uid).collection("backups").document("main")
                .get()
                .addOnSuccessListener(snapshot -> send("downloaded",
                        snapshot.exists() ? snapshot.getString("payload") : null))
                .addOnFailureListener(e -> send("error", "No se pudo consultar la nube. Revisa Internet y Firestore."));
    }
}
