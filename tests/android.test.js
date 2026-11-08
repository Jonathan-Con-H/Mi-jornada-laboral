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
    const el = {id,value:"",textContent:"",innerHTML:"",style:{},children:[],options:[],attributes:{},
      classList:{add(){},remove(){},toggle(){}},
      addEventListener(type,callback){this[type] = callback;},
      replaceChildren(...children){this.children=children;},
      append(...children){this.children.push(...children);if(id==="vacYear")this.options.push(...children);},
      appendChild(child){this.append(child);},
      setAttribute(name,value){this.attributes[name]=String(value);},click(){if(this.onclick)this.onclick();},
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
  const oldButton=oldRow.children.find(btn=>btn.attributes.role==="tab");
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


test("Mis empresas muestra una pestaña por empresa y cambia sin borrar el historial",()=>{
  const h=harness();
  assert.match(html,/id="companiesView"/);
  assert.match(html,/id="serviceList" role="tablist"/);
  assert.match(html,/id="serviceOpenCalendar"/);
  assert.match(html,/data-tab="companies"/);
  const dashboard=fs.readFileSync(path.join(__dirname,"../dashboard.js"),"utf8");
  assert.match(dashboard,/\['companies','briefcase','Empresas'\]/);

  h.element("serviceName").value="Empresa nueva";
  h.element("serviceStart").value="2027-01-11";
  h.element("serviceShift").value="morning";
  h.element("serviceForm").onsubmit({preventDefault(){}});
  const tabs=h.element("serviceList").children.map(row=>row.children.find(btn=>btn.attributes.role==="tab"));
  assert.equal(tabs.length,2);
  assert.equal(tabs[0].attributes.role,"tab");
  assert.equal(tabs[0].attributes["aria-selected"],"false");
  assert.equal(tabs[1].attributes["aria-selected"],"true");
  assert.match(tabs[0].textContent,/Mi primera hoja de servicio/);
  assert.match(tabs[1].textContent,/Empresa nueva/);
  tabs[0].onclick();
  const stored=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
  assert.equal(stored.items.length,2);
  assert.equal(stored.activeId,stored.items[0].id);
  assert.equal(stored.items[0].data[h.oldDay].notes,h.original.notes);
  assert.equal(h.element("serviceList").children[0].children[0].attributes["aria-selected"],"true");
});


test("renombrar una empresa actualiza su pestaña sin cambiar jornadas",()=>{
  const h=harness();
  h.element("serviceRenameName").value="Mi empresa actual";
  h.element("serviceRenameForm").onsubmit({preventDefault(){}});
  const state=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
  assert.equal(state.items[0].name,"Mi empresa actual");
  assert.equal(state.items[0].data[h.oldDay].notes,h.original.notes);
  assert.match(h.element("serviceList").children[0].children[0].textContent,/Mi empresa actual/);
});


test("calendario ensancha solo las casillas sin cambiar colores de turnos",()=>{
  const css=fs.readFileSync(path.join(__dirname,"../dashboard.css"),"utf8");
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(84px,1fr\)\)/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(68px,1fr\)\)/);
  assert.match(css,/grid-template-columns:repeat\(7,minmax\(62px,1fr\)\)/);
  assert.match(css,/\.day\.morning\{border:3px solid #38BDF8\}/);
  assert.match(css,/\.day\.afternoon\{border:3px solid #14B8A6\}/);
});

test("cada hoja mantiene color aleatorio al cambiar de empresa",()=>{
 const h=harness();
 h.element("serviceShowForm").onclick();
 h.element("serviceName").value="Segunda empresa";
 h.element("serviceStart").value="2027-01-11";
 h.element("serviceShift").value="morning";
 h.element("serviceForm").onsubmit({preventDefault(){}});
 const state=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
 const colors=state.items.map(item=>item.tabColor);
 assert.equal(new Set(colors).size,2);
 assert.ok(colors.every(c=>/^#[0-9A-Fa-f]{6}$/.test(c)));
 const firstTab=h.element("serviceList").children[0].children[0];
 firstTab.onclick();
 const updated=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
 assert.deepEqual(updated.items.map(item=>item.tabColor),colors);
});

test("borrado manual conserva toda la hoja y permite restaurarla",()=>{
 const h=harness();
 h.element("serviceShowForm").onclick();
 h.element("serviceName").value="Segunda empresa";
 h.element("serviceStart").value="2027-01-11";
 h.element("serviceShift").value="morning";
 h.element("serviceForm").onsubmit({preventDefault(){}});
 const initial=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
 const deleteButton=h.element("serviceList").children[0].children[1];
 assert.equal(deleteButton.disabled,false);
 deleteButton.onclick();
 const deleted=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
 assert.equal(deleted.items.length,1);
 assert.equal(deleted.deleted.length,1);
 assert.equal(deleted.deleted[0].sheet.data[h.oldDay].notes,h.original.notes);
 assert.equal(deleted.deleted[0].sheet.tabColor,initial.items[0].tabColor);
 h.element("serviceTrashList").children[0].onclick();
 const restored=JSON.parse(h.storage.get("miJornada.service.sheets.v1"));
 assert.equal(restored.items.length,2);
 assert.equal(restored.deleted.length,0);
 const original=restored.items.find(item=>item.id==="initial");
 assert.equal(original.data[h.oldDay].notes,h.original.notes);
 assert.equal(original.tabColor,initial.items[0].tabColor);
});

test("no permite eliminar la única hoja",()=>{
 const h=harness();
 assert.equal(h.element("serviceList").children[0].children[1].disabled,true);
});
