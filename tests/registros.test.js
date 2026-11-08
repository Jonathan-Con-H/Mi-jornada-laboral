const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const match=html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(match,"Debe existir el script del calendario");

function lastWeekday(){
  const d=new Date();d.setHours(12,0,0,0);
  do{d.setDate(d.getDate()-1);}while([0,6].includes(d.getDay()));
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
function setup(approve=true){
  const day=lastWeekday();
  const record={kind:"work",shift:"morning",start:"06:00",end:"14:00",breakMins:30,owed:0.5,extraMins:0,hourlyLeaveMins:0,notes:"jornada original",auto:false};
  const storage={
    "miJornada.v1":JSON.stringify({[day]:record}),
    "miJornada.auto.v1":JSON.stringify({enabled:true,since:day})
  };
  const fields=new Map(), callbacks=new Map();
  let next=0;
  function element(id){
    const e={id,value:"",textContent:"",innerHTML:"",disabled:false,className:"",style:{},children:[],
      addEventListener(name,fn){callbacks.set(id+":"+name,fn);},
      appendChild(child){this.children.push(child);},
      append(...children){this.children.push(...children);},
      replaceChildren(...children){this.children=children;},
      setAttribute(){},classList:{add(){},remove(){},toggle(){}}};
    return e;
  }
  const doc={
    getElementById(id){if(!fields.has(id))fields.set(id,element(id));return fields.get(id);},
    createElement(){return element("dynamic-"+(++next));},
    querySelectorAll(){return [];},addEventListener(){}
  };
  const window={dispatchEvent(){},addEventListener(){}};
  const localStorage={getItem(k){return storage[k]??null;},setItem(k,v){storage[k]=v;}};
  const context={document:doc,window,localStorage,navigator:{},location:{protocol:"file:"},
    Event:class Event {},confirm:()=>approve,alert:()=>{},setInterval:()=>0,console};
  vm.runInNewContext(match[1]+
    "\nwindow.__test={getData:()=>data,getTrash:()=>trash,getSuppressed:()=>suppressed,setSelected:s=>{selected=s},syncAutoEntries,validateRecord};",
    context,{timeout:2000});
  return {day,record,api:window.__test,fields,callbacks,storage,fire:(id,event="click")=>{
    const fn=callbacks.get(id+":"+event);assert.ok(fn,"Falta manejador "+id+":"+event);
    fn({preventDefault(){}});
  }};
}
test("el calendario se inicia con datos anteriores",()=>{
  const h=setup();
  assert.equal(h.api.getData()[h.day].notes,"jornada original");
});
test("valida horarios, descansos y permisos",()=>{
  const h=setup(),e={...h.record,hourlyLeaveMins:60};
  assert.doesNotThrow(()=>h.api.validateRecord(e));
  assert.throws(()=>h.api.validateRecord({...e,start:"29:00"}),/horas válidas/);
  assert.throws(()=>h.api.validateRecord({...e,end:"06:00"}),/coincidir/);
  assert.throws(()=>h.api.validateRecord({...e,breakMins:450}),/supera/);
  assert.throws(()=>h.api.validateRecord({...e,extraMins:-1}),/cantidad válida/);
});
test("confirma antes de eliminar una jornada",()=>{
  const h=setup(false);h.api.setSelected(h.day);h.fire("resetDay");
  assert.ok(h.api.getData()[h.day]);
  assert.equal(h.api.getTrash()[h.day],undefined);
});
test("eliminación queda en papelera y no reaparece automáticamente",()=>{
  const h=setup();h.api.setSelected(h.day);h.fire("resetDay");
  assert.equal(h.api.getData()[h.day],undefined);
  assert.equal(h.api.getTrash()[h.day].record.notes,"jornada original");
  assert.equal(h.api.getSuppressed()[h.day],true);
  h.api.syncAutoEntries();
  assert.equal(h.api.getData()[h.day],undefined);
});
test("restaurar recupera el registro y habilita la fecha",()=>{
  const h=setup();h.api.setSelected(h.day);h.fire("resetDay");
  const rows=h.fields.get("trashList").children;
  assert.equal(rows.length,1);
  const button=rows[0].children[1];
  h.fire(button.id);
  assert.equal(h.api.getData()[h.day].notes,"jornada original");
  assert.equal(h.api.getTrash()[h.day],undefined);
  assert.equal(h.api.getSuppressed()[h.day],undefined);
});
test("vacaciones en el calendario quedan registradas y con historial",()=>{
  const h=setup();h.api.setSelected(h.day);
  const kind=h.fields.get("kind");
  kind.value="vacation";
  h.fire("entryForm","submit");
  assert.equal(h.api.getData()[h.day].kind,"vacation");
  assert.equal(h.api.getData()[h.day].owed,0);
  assert.equal(h.api.getData()[h.day].extraMins,0);
  const history=JSON.parse(h.storage["miJornada.vacation.history.v1"]);
  assert.equal(history.at(-1).to,"vacation");
});
test("las jornadas antiguas sin permiso por horas siguen siendo legibles",()=>{
  const h=setup();
  const old={...h.api.getData()[h.day]};delete old.hourlyLeaveMins;
  h.api.getData()[h.day]=old;
  assert.doesNotThrow(()=>h.api.syncAutoEntries());
});