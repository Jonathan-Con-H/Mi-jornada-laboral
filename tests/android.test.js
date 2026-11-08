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
  const oldButton=h.element("serviceList").children.find(x=>x.textContent.includes("Mi primera hoja"));
  assert.ok(oldButton);
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

test("el APK mantiene colores de turno con casillas más compactas sin modificar registros",()=>{
  assert.match(html, /id="mj-android-calendario-compacto"/);
  assert.match(html, /width:calc\(100% - 28px\)/);
  assert.match(html, /min-height:60px/);
  assert.match(html, /\.calendar \.day\.morning,\.calendar \.day\.afternoon/);
  assert.match(html, /\.day\.vacation\{border-width:4px\}/);
  assert.match(html, /sheet\.closedAt&&s>sheet\.closedAt/);
  assert.match(html, /isProjection\?weekShift\(s\)/);
  const h=harness();
  assert.equal(JSON.parse(h.storage.get("miJornada.v1"))[h.oldDay].notes,h.original.notes);
});
