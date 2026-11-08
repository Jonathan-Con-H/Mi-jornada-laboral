package es.mijornada.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.AtomicFile;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Archivos personales guardados solo en el espacio privado de esta instalación.
 * Independiente del JSON de jornadas y de Firestore: nunca cambia las hojas.
 */
public final class DocumentStore {
    public static final int PICK_DOCUMENT_REQUEST = 1203;
    private static final long MAX_DOCUMENT_BYTES = 25L * 1024L * 1024L;
    private final Activity activity;
    private final WebView view;
    private final File folder;
    private final AtomicFile index;
    private JSONObject awaiting;

    DocumentStore(Activity activity, WebView view) {
        this.activity = activity;
        this.view = view;
        this.folder = new File(activity.getFilesDir(), "documents");
        this.index = new AtomicFile(new File(folder, "index.json"));
    }

    private void send(String type, String message, JSONArray items) {
        JSONObject result = new JSONObject();
        try {
            result.put("type", type);
            if (message != null) result.put("message", message);
            if (items != null) result.put("items", items);
        } catch (JSONException ignored) { }
        String argument = JSONObject.quote(result.toString());
        activity.runOnUiThread(() -> view.evaluateJavascript(
            "window.miJornadaOnDocuments && window.miJornadaOnDocuments(" + argument + ");", null));
    }

    private JSONArray readIndex() throws Exception {
        if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("No se puede preparar la carpeta privada");
        if (!index.getBaseFile().exists()) return new JSONArray();
        byte[] bytes;
        try (InputStream input = index.openRead()) {
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int count;
            while ((count = input.read(chunk)) != -1) {
                buffer.write(chunk, 0, count);
                if (buffer.size() > 4_000_000) throw new IllegalStateException("Índice de documentos demasiado grande");
            }
            bytes = buffer.toByteArray();
        }
        return new JSONArray(new String(bytes, StandardCharsets.UTF_8));
    }

    private void writeIndex(JSONArray entries) throws Exception {
        FileOutputStream output = null;
        try {
            output = index.startWrite();
            output.write(entries.toString().getBytes(StandardCharsets.UTF_8));
            index.finishWrite(output);
        } catch (Exception error) {
            if (output != null) index.failWrite(output);
            throw error;
        }
    }

    @JavascriptInterface
    public void listDocuments() {
        activity.runOnUiThread(() -> {
            try { send("list", null, readIndex()); }
            catch (Exception ex) { send("error", "No se pudo leer el índice de documentos.", null); }
        });
    }

    @JavascriptInterface
    public void importDocument(String kind, String sheetId, String company, String period, String day) {
        activity.runOnUiThread(() -> {
            if (awaiting != null) {
                send("error", "Termina primero la selección anterior.", null);
                return;
            }
            if (!("payroll".equals(kind) || "justification".equals(kind))
                    || sheetId == null || sheetId.isEmpty() || sheetId.length() > 120
                    || company == null || company.trim().isEmpty() || company.length() > 100
                    || ("payroll".equals(kind) && (period == null || !period.matches("\\d{4}-(0[1-9]|1[0-2])")))
                    || ("justification".equals(kind) && (day == null || !day.matches("\\d{4}-(0[1-9]|1[0-2])-([0-2]\\d|3[01])")))) {
                send("error", "Selecciona empresa y fecha válidas.", null);
                return;
            }
            JSONObject pending = new JSONObject();
            try {
                pending.put("kind", kind);
                pending.put("sheetId", sheetId);
                pending.put("company", company.trim());
                pending.put("period", "payroll".equals(kind) ? period : day.substring(0, 7));
                pending.put("day", "payroll".equals(kind) ? "" : day);
            } catch (JSONException ignored) { }
            awaiting = pending;
            Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            picker.addCategory(Intent.CATEGORY_OPENABLE);
            picker.setType("*/*");
            picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                    "application/pdf", "image/jpeg", "image/png", "image/webp",
                    "image/heic", "image/heif", "image/gif"
            });
            try {
                activity.startActivityForResult(picker, PICK_DOCUMENT_REQUEST);
            } catch (ActivityNotFoundException error) {
                awaiting = null;
                send("error", "No se encontró un selector de archivos en Android.", null);
            } catch (Exception error) {
                awaiting = null;
                send("error", "No se pudo abrir el selector de archivos.", null);
            }
        });
    }

    boolean handleResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != PICK_DOCUMENT_REQUEST) return false;
        JSONObject pending = awaiting;
        awaiting = null;
        if (pending == null) return true;
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            send("cancelled", "No se ha añadido ningún archivo.", null);
            return true;
        }
        Uri uri = data.getData();
        File temp = null;
        File stored = null;
        try {
            String mime = activity.getContentResolver().getType(uri);
            if (mime == null) mime = "";
            if (!(mime.equals("application/pdf")
                    || mime.equals("image/jpeg") || mime.equals("image/png")
                    || mime.equals("image/webp") || mime.equals("image/heic")
                    || mime.equals("image/heif") || mime.equals("image/gif"))) {
                throw new IllegalArgumentException("Solo se admiten PDF y fotografías (JPG, PNG, WebP, HEIC o GIF).");
            }
            String filename = "Documento";
            try (Cursor cursor = activity.getContentResolver().query(
                    uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    String proposed = cursor.getString(0);
                    if (proposed != null && !proposed.trim().isEmpty()) filename = proposed;
                }
            }
            filename = filename.replaceAll("[\\p{Cntrl}/\\\\]", "").trim();
            if (filename.length() > 120) filename = filename.substring(0, 120);
            if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("No se puede abrir la carpeta privada");
            String id = UUID.randomUUID().toString();
            temp = new File(folder, id + ".tmp");
            stored = new File(folder, id + ".bin");
            long total = 0;
            try (InputStream input = activity.getContentResolver().openInputStream(uri);
                 FileOutputStream output = new FileOutputStream(temp)) {
                if (input == null) throw new IllegalStateException("No se puede leer el archivo seleccionado");
                byte[] chunk = new byte[8192];
                int count;
                while ((count = input.read(chunk)) != -1) {
                    total += count;
                    if (total > MAX_DOCUMENT_BYTES) {
                        throw new IllegalArgumentException("El documento supera el máximo de 25 MB.");
                    }
                    output.write(chunk, 0, count);
                }
                output.getFD().sync();
            }
            if (total == 0) throw new IllegalArgumentException("El archivo seleccionado está vacío.");
            JSONArray docs = readIndex();
            if (!temp.renameTo(stored)) throw new IllegalStateException("No se pudo guardar el archivo");
            JSONObject metadata = new JSONObject();
            metadata.put("id", id);
            metadata.put("kind", pending.getString("kind"));
            metadata.put("sheetId", pending.getString("sheetId"));
            metadata.put("company", pending.getString("company"));
            metadata.put("period", pending.getString("period"));
            metadata.put("day", pending.getString("day"));
            metadata.put("name", filename);
            metadata.put("mime", mime);
            metadata.put("size", total);
            metadata.put("addedAt", System.currentTimeMillis());
            docs.put(metadata);
            writeIndex(docs);
            send("imported", "Documento guardado en el almacenamiento privado del móvil.", null);
            send("list", null, docs);
        } catch (Exception error) {
            if (stored != null) stored.delete();
            send("error", error.getMessage() == null ? "No se pudo guardar el documento." : error.getMessage(), null);
        } finally {
            if (temp != null) temp.delete();
        }
        return true;
    }

    @JavascriptInterface
    public void openDocument(String id) {
        activity.runOnUiThread(() -> {
            try {
                JSONObject doc = findDocument(id);
                File file = new File(folder, id + ".bin");
                if (!file.isFile()) throw new IllegalStateException("Archivo no encontrado en este móvil.");
                Uri uri = FileProvider.getUriForFile(activity,
                        activity.getPackageName() + ".documents", file);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, doc.getString("mime"));
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.startActivity(Intent.createChooser(intent, "Abrir documento"));
            } catch (Exception error) {
                send("error", "No se pudo abrir el documento. Comprueba que tienes un visor de PDF o imágenes.", null);
            }
        });
    }

    @JavascriptInterface
    public void deleteDocument(String id) {
        activity.runOnUiThread(() -> {
            try {
                JSONArray docs = readIndex();
                JSONArray updated = new JSONArray();
                boolean found = false;
                for (int i = 0; i < docs.length(); i++) {
                    JSONObject doc = docs.getJSONObject(i);
                    if (id != null && id.equals(doc.optString("id"))) found = true;
                    else updated.put(doc);
                }
                if (!found) throw new IllegalArgumentException("Documento no encontrado.");
                writeIndex(updated);
                new File(folder, id + ".bin").delete();
                send("deleted", "Documento eliminado de este móvil.", null);
                send("list", null, updated);
            } catch (Exception error) {
                send("error", "No se pudo eliminar el documento.", null);
            }
        });
    }

    private JSONObject findDocument(String id) throws Exception {
        if (id == null || !id.matches("[a-f0-9-]{36}"))
            throw new IllegalArgumentException("Identificador incorrecto");
        JSONArray docs = readIndex();
        for (int i = 0; i < docs.length(); i++) {
            JSONObject doc = docs.getJSONObject(i);
            if (id.equals(doc.optString("id"))) return doc;
        }
        throw new IllegalArgumentException("Documento inexistente");
    }
}
