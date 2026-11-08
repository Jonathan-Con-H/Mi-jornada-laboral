const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const dashboard=fs.readFileSync(path.join(__dirname,"../dashboard.js"),"utf8");
const worker=fs.readFileSync(path.join(__dirname,"../sw.js"),"utf8");

test("Ajustes dispone de una pantalla propia y visible desde el menú",()=>{
  assert.match(html,/<section id="settingsView" class="hidden">/);
  assert.match(html,/data-tab="settings"/);
  assert.match(dashboard,/navButton\('settings','settings','Ajustes'\)/);
  assert.match(dashboard,/page === 'settings' \? 'settings' : 'calendar'/);
  assert.match(dashboard,/page === 'settings' \? \$mj\('settingsView'\)/);
});

test("solo hay un control de registro automático",()=>{
  assert.equal((html.match(/id="toggleAuto"/g)||[]).length,1);
  assert.match(html,/<section id="settingsView"[\s\S]*id="toggleAuto"[\s\S]*<section id="summaryView"/);
});

test("se muestran horarios existentes sin formularios de modificación",()=>{
  assert.match(html,/>06:00 – 14:00</);
  assert.match(html,/>14:00 – 22:00</);
  assert.match(html,/>30 minutos</);
  assert.match(html,/no se modifican fichajes pasados/);
});

test("Ajustes ofrece controles reales de vista, copias y nube",()=>{
  for(const id of ["settingsSwitchView","settingsOpenBackup","settingsOpenCloud","settingsLayoutStatus"]){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/const toggle=\$\("mjViewToggle"\)/);
  assert.match(html,/data-mj-go="backup"/);
  assert.match(html,/mi-jornada:open-tool/);
});

test("script, CSS y caché web llevan las nuevas versiones",()=>{
  assert.match(html,/dashboard\.css\?v=6/);
  assert.match(html,/dashboard\.js\?v=7/);
  assert.match(worker,/mi-jornada-web-v9/);
  assert.match(worker,/dashboard\.css\?v=6/);
  assert.match(worker,/dashboard\.js\?v=7/);
});

test("los scripts que gobiernan la navegación son sintácticamente válidos",()=>{
  const match=html.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(match,"Falta script principal");
  assert.doesNotThrow(()=>new Function(match[1]));
  assert.doesNotThrow(()=>new Function(dashboard));
});