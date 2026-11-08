const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("la APK muestra Documentos y permite acceder desde el menú lateral", () => {
  const html = read("app/src/main/assets/index.html");
  const shell = read("dashboard.js");
  const js = read("app/src/main/assets/mi-jornada-documents.js");
  assert.match(html, /data-tab="documents"/);
  assert.match(html, /id="documentsView"/);
  assert.match(html, /id="docPayrollBtn"/);
  assert.match(html, /id="docJustBtn"/);
  assert.match(html, /id="docCompany"/);
  assert.match(html, /id="docList"/);
  assert.match(html, /mi-jornada-documents\.js/);
  assert.match(shell, /document\.getElementById\('documentsView'\) \? navButton\('documents','notes','Documentos'\)/);
  assert.match(shell, /page === 'documents' \? 'documents'/);
  assert.match(js, /window\.AndroidDocuments/);
  assert.match(js, /miJornadaOnDocuments/);
});

test("Android guarda PDF/fotos de forma privada sin cambiar jornadas ni subir binarios a Firestore", () => {
  const native = read("app/src/main/java/es/mijornada/app/DocumentStore.java");
  const activity = read("app/src/main/java/es/mijornada/app/MainActivity.java");
  const manifest = read("app/src/main/AndroidManifest.xml");
  const gradle = read("app/build.gradle");
  assert.match(native, /getFilesDir\(\), "documents"/);
  assert.match(native, /Intent\.ACTION_OPEN_DOCUMENT/);
  assert.match(native, /MAX_DOCUMENT_BYTES = 25L/);
  assert.match(native, /FileProvider\.getUriForFile/);
  assert.match(native, /writeIndex\(updated\)/);
  assert.match(native, /AtomicFile/);
  assert.doesNotMatch(native, /FirebaseFirestore|collection\("backups"\)/);
  assert.match(activity, /addJavascriptInterface\(documentStore, "AndroidDocuments"\)/);
  assert.match(activity, /documentStore\.handleResult/);
  assert.match(manifest, /androidx\.core\.content\.FileProvider/);
  assert.match(read("app/src/main/res/xml/documents_paths.xml"), /files-path/);
  assert.match(gradle, /versionCode 12/);
  assert.match(gradle, /versionName '2\\.1'/);
});
