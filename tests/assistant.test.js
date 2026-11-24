const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(path.join(__dirname,"../mi-jornada-assistant.js"),"utf8");

function harness(gemini=null){
 const elements=new Map(),records=new Map(),updates=[];
 let generated=0;
 function element(id){
  if(elements.has(id))return elements.get(id);
  const classes=new Set();
  const el={id,value:"",textContent:"",innerHTML:"",className:"",title:"",style:{},children:[],disabled:false,scrollTop:0,
   classList:{add(x){classes.add(x);},remove(x){classes.delete(x);},contains(x){return classes.has(x);},toggle(x){if(classes.has(x))classes.delete(x);else classes.add(x);}},
   addEventListener(type,fn){this["on"+type]=fn;},setAttribute(){},focus(){},appendChild(child){this.children.push(child);},remove(){},click(){if(this.onclick)this.onclick();}};
  elements.set(id,el);return el;
 }
 const bridge={
  get(key){
   if(records.has(key))return {...records.get(key)};
   const day=new Date(key+"T12:00:00Z").getUTCDay(),rest=day===0||day===6;
   return {kind:rest?"rest":"work",shift:"morning",start:"06:00",end:"14:00",breakMins:30,owed:rest?0:.5,extraMins:0,hourlyLeaveMins:0,notes:""};
  },
  update(key,record){updates.push(key);records.set(key,{...record,auto:false});},
  updateMany(changes){for(const c of changes){updates.push(c.date);records.set(c.date,{...c.record,auto:false});}},
  read(){return {data:Object.fromEntries(records)};}
 };
 const window={miJornadaBridge:bridge,miJornadaGemini:gemini,addEventListener(){}};
 const document={head:{appendChild(){}},body:{appendChild(){}},createElement(){return element("generated-"+(++generated));},getElementById:element};
 const storage=new Map();
 const localStorage={getItem(key){return storage.get(key)??null;},setItem(key,value){storage.set(key,String(value));}};
 vm.runInNewContext(source,{window,document,localStorage,console,Date,setTimeout,clearTimeout},{timeout:5000});
 function submit(text){element("mj-ai-input").value=text;element("mj-ai-form").onsubmit({preventDefault(){}});}
 return {elements,records,updates,submit,window};
}

test("la orden por cada día de diciembre presenta los cambios y espera confirmación",()=>{
 const h=harness();
 h.submit("Añade una hora extra cada día de diciembre de 2026");
 assert.equal(h.updates.length,0);
 assert.equal(h.elements.get("mj-ai-confirm").classList.contains("visible"),true);
 const preview=h.elements.get("mj-ai-chat").children.at(-1).textContent;
 assert.match(preview,/Vista previa sin guardar/);
 assert.match(preview,/2026-12-01: trabajo, turno mañana 06:00–14:00, extra 0 h 0 min, descanso 30 min, deuda 0 h 30 min → trabajo, turno mañana 06:00–14:00, extra 1 h 0 min, descanso 30 min, deuda 0 h 30 min/);
 const expected=[];
 for(let day=1;day<=31;day++){
  const key="2026-12-"+String(day).padStart(2,"0");
  const weekday=new Date(key+"T12:00:00Z").getUTCDay();
  if(weekday!==0&&weekday!==6)expected.push(key);
 }
 h.elements.get("mj-ai-yes").onclick();
 assert.deepEqual(h.updates,expected);
 for(const key of expected)assert.equal(h.records.get(key).extraMins,60);
 assert.match(h.elements.get("mj-ai-chat").children.at(-1).textContent,/Guardado correctamente/);
});

test("una fecha escrita como '10 de diciembre' modifica solo ese día tras confirmar",()=>{
 const h=harness();
 h.submit("Añade una hora extra el 10 de diciembre de 2026");
 assert.equal(h.updates.length,0);
 assert.match(h.elements.get("mj-ai-chat").children.at(-1).textContent,/2026-12-10/);
 h.elements.get("mj-ai-yes").onclick();
 assert.deepEqual(h.updates,["2026-12-10"]);
 assert.equal(h.records.get("2026-12-10").extraMins,60);
});

test("una petición mensual ambigua no se convierte en una orden para cada día ni se guarda",()=>{
 const h=harness();
 h.submit("Añade una hora extra en diciembre de 2026");
 assert.equal(h.updates.length,0);
 assert.match(h.elements.get("mj-ai-chat").children.at(-1).textContent,/Indica a qué día/);
 assert.equal(h.elements.get("mj-ai-confirm").classList.contains("visible"),false);
});


test("el intervalo del martes del mes que viene a fin de año muestra y guarda cada jornada",()=>{
 const h=harness();
 h.submit("Desde el primer martes del mes que viene hasta fin de año, añade una hora extra a cada jornada trabajada");
 assert.equal(h.updates.length,0);
 const preview=h.elements.get("mj-ai-chat").children.at(-1).textContent;
 assert.match(preview,/del 2026-12-01 al 2026-12-31/);
 assert.match(preview,/2026-12-01: trabajo, turno mañana 06:00–14:00, extra 0 h 0 min, descanso 30 min, deuda 0 h 30 min → trabajo, turno mañana 06:00–14:00, extra 1 h 0 min, descanso 30 min, deuda 0 h 30 min/);
 const expected=[];
 for(let day=1;day<=31;day++){
  const key="2026-12-"+String(day).padStart(2,"0");
  if(![0,6].includes(new Date(key+"T12:00:00Z").getUTCDay()))expected.push(key);
 }
 h.elements.get("mj-ai-yes").onclick();
 assert.deepEqual(h.updates,expected);
 for(const key of expected)assert.equal(h.records.get(key).extraMins,60);
});

test("repetir la misma orden confirmada no vuelve a sumar las horas",()=>{
 const h=harness();
 const command="Desde el primer martes del mes que viene hasta fin de año, añade una hora extra a cada jornada trabajada";
 h.submit(command);h.elements.get("mj-ai-yes").onclick();
 const count=h.updates.length;
 h.submit(command);
 assert.equal(h.updates.length,count);
 assert.match(h.elements.get("mj-ai-chat").children.at(-1).textContent,/No hay jornadas trabajadas nuevas/);
 assert.equal(h.elements.get("mj-ai-confirm").classList.contains("visible"),false);
});


test("si Gemini no conecta informa del error y no afirma que haya guardado",async()=>{
 const h=harness({interpret:()=>Promise.reject(new Error("Failed to fetch")),ask:()=>Promise.resolve("respuesta")});
 h.submit("¿Qué funciones puedo usar en la aplicación?");
 await new Promise(resolve=>setImmediate(resolve));
 const message=h.elements.get("mj-ai-chat").children.at(-1).textContent;
 assert.match(message,/No se pudo conectar con Firebase AI Logic/);
 assert.doesNotMatch(message,/Guardado|He guardado/i);
 assert.equal(h.updates.length,0);
});


test("si el día de inicio admite varios martes pregunta cuál antes de preparar cambios",()=>{
 const h=harness();
 h.submit("Desde el martes del mes que viene hasta fin de año, añade una hora extra a cada jornada trabajada");
 assert.equal(h.updates.length,0);
 assert.equal(h.elements.get("mj-ai-confirm").classList.contains("visible"),false);
 assert.match(h.elements.get("mj-ai-chat").children.at(-1).textContent,/Hay varios martes/);
 assert.match(h.elements.get("mj-ai-chat").children.at(-1).textContent,/primero \(2026-12-01\)/);
});


test("Gemini puede proponer un cambio de turno mensual sin convertir descansos en trabajo",async()=>{
 const h=harness({interpret:()=>Promise.resolve({action:"set_shift",scope:"worked_days_month",month:12,year:2026,shift:"afternoon"})});
 h.submit("Cambia las jornadas de diciembre a turno de tarde");
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.updates.length,0);
 const preview=h.elements.get("mj-ai-chat").children.at(-1).textContent;
 assert.match(preview,/turno mañana 06:00–14:00/);
 assert.match(preview,/turno tarde 14:00–22:00/);
 h.elements.get("mj-ai-yes").onclick();
 assert.equal(h.updates.length,23);
 assert.equal(h.records.get("2026-12-01").kind,"work");
 assert.equal(h.records.get("2026-12-01").shift,"afternoon");
 assert.equal(h.records.has("2026-12-05"),false);
});
