const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/index.html"), "utf8");
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(script, "El APK contiene el código de sus pantallas");

function harness() {
  const storage = new Map();
  const oldDay = "2026-11-05";
  const original = { kind:"work",shift:"morning",start:"06:00",end:"14:00",
    breakMins:30,owed:0.5,extraMins:0,notes:"Jornada de mi primera empresa",auto:false };
  storage.set("miJornada.v1", JSON.stringify({[oldDay]:original}));
  storage.set("miJornada.auto.v1", JSON.stringify({enabled:false,since:oldDay}));
  const elements = new Map();
  const exports = [];
  let generated = 0;
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const el = {id,value:"",textContent:"",innerHTML:"",style:{},children:[],options:[],
      classList:{add(){},remove(){},toggle(){}},
      addEventListener(type,callback){this[type] = callback;},
      replaceChildren(...children){this.children=children;},
      append(...children){this.children.push(...children);if(id==="vacYear")this.options.push(...children);},
      appendChild(child){this.append(child);},
      setAttribute(){},click(){if(this.onclick)this.onclick();},
    };
    elements.set(id,el);
    return el;
  }
  const doc = {
    getElementById:element,
    createElement:()=>element("dynamic"+(++generated)),
    querySelectorAll(selector){
      if(selector==="button.tab") {
        return ["calendar","summary","backup","cloud","vacations","settings"].map(name=>{
          const item=element("tab-"+name);item.dataset={tab:name};return item;
        });
      }
      return [];
    },
    addEventListener(){},
  };
  const window = {
    AndroidBackup:{exportJson(filename,json){exports.push({filename,json});}},
    addEventListener(){},
  };
  const localStorage = {
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>storage.set(key,String(value)),
  };
  vm.runInNewContext(script[1],{
    document:doc,window,localStorage,navigator:{},location:{protocol:"file:"},
    setInterval(){},setTimeout(){},clearTimeout(){},alert(){},
    confirm(){return true},console,
  },{timeout:5000});
  return {storage,elements,exports,window,oldDay,original,element};
}

test("la nueva versión arranca con jornadas de la versión anterior",()=>{
  const h=harness();
  assert.equal(JSON.parse(h.storage.get("miJornada.v1"))[h.oldDay].notes,h.original.notes);
  const sheets=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
  assert.equal(sheets.items.length,1);
  assert.equal(sheets.items[0].data[h.oldDay].notes,h.original.notes);
});

test("crear nueva hoja conserva la empresa anterior y permite volver",()=>{
  const h=harness();
  h.element("serviceName").value="Segunda empresa";
  h.element("serviceStart").value="2027-01-11";
  h.element("serviceShift").value="afternoon";
  h.element("serviceForm").onsubmit({preventDefault(){}});
  let sheets=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
  assert.equal(sheets.items.length,2);
  assert.equal(sheets.items[0].data[h.oldDay].notes,h.original.notes);
  assert.equal(Object.keys(sheets.items[1].data).length,0);
  assert.equal(sheets.items[0].closedAt,"2027-01-10");
  const oldRow=h.element("serviceList").children.find(row=>row.children.some(btn=>btn.textContent.includes("Mi primera hoja")));
  assert.ok(oldRow);
  const oldButton=oldRow.children.find(btn=>btn.textContent.includes("Mi primera hoja"));
  oldButton.onclick();
  assert.equal(JSON.parse(h.storage.get("miJornada.v1"))[h.oldDay].notes,h.original.notes);
});

test("exportación Android incluye todas las hojas de servicio y no elimina datos",()=>{
  const h=harness();
  h.element("serviceName").value="Segunda empresa";
  h.element("serviceStart").value="2027-01-11";
  h.element("serviceShift").value="morning";
  h.element("serviceForm").onsubmit({preventDefault(){}});
  h.element("exportBtn").onclick();
  assert.equal(h.exports.length,1);
  assert.match(h.exports[0].filename,/mi-jornada-copia-.*\.json/);
  const payload=JSON.parse(h.exports[0].json);
  assert.equal(payload.app,"Mi Jornada");
  assert.equal(payload.version,6);
  assert.equal(payload.serviceSheets.items.length,2);
  assert.equal(payload.serviceSheets.items[0].data[h.oldDay].notes,h.original.notes);
  h.window.miJornadaOnBackup(JSON.stringify({ok:true,message:"Copia guardada"}));
  assert.equal(h.element("backupStatus").textContent,"Copia guardada");
});

test("hojas existentes y nuevas conservan colores diferentes",()=>{
  const h=harness();
  h.element("serviceName").value="Segunda empresa";
  h.element("serviceStart").value="2027-01-11";
  h.element("serviceShift").value="morning";
  h.element("serviceForm").onsubmit({preventDefault(){}});
  const sheets=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
  assert.match(sheets.items[0].tabColor,/^#[0-9A-Fa-f]{6}$/);
  assert.match(sheets.items[1].tabColor,/^#[0-9A-Fa-f]{6}$/);
  assert.notEqual(sheets.items[0].tabColor,sheets.items[1].tabColor);
  const colors=sheets.items.map(s=>s.tabColor);
  h.element("serviceList").children[0].children[0].onclick();
  const after=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
  assert.deepEqual(after.items.map(s=>s.tabColor),colors);
});

test("borrado manual conserva toda la hoja en la papelera y permite restaurar",()=>{
  const h=harness();
  h.element("serviceName").value="Segunda empresa";
  h.element("serviceStart").value="2027-01-11";
  h.element("serviceShift").value="morning";
  h.element("serviceForm").onsubmit({preventDefault(){}});
  const previous=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
  const first=h.element("serviceList").children[0];
  assert.equal(first.children[1].textContent,"Enviar a papelera");
  first.children[1].onclick();
  const removed=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
  assert.equal(removed.items.length,1);
  assert.equal(removed.deleted.length,1);
  assert.equal(removed.deleted[0].sheet.data[h.oldDay].notes,h.original.notes);
  assert.equal(removed.deleted[0].sheet.tabColor,previous.items[0].tabColor);
  h.element("serviceTrashList").children[0].onclick();
  const restored=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
  assert.equal(restored.items.length,2);
  assert.equal(restored.deleted.length,0);
  const recovered=restored.items.find(s=>s.id==="initial");
  assert.equal(recovered.data[h.oldDay].notes,h.original.notes);
  assert.equal(recovered.tabColor,previous.items[0].tabColor);
});

test("no permite borrar la última hoja de servicio",()=>{
  const h=harness();
  const row=h.element("serviceList").children[0];
  assert.equal(row.children[1].disabled,true);
});
