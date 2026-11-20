const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(path.join(__dirname,"../mi-jornada-assistant.js"),"utf8");

function harness(){
 const elements=new Map(),records=new Map(),updates=[];
 let generated=0;
 function element(id){
  if(elements.has(id))return elements.get(id);
  const classes=new Set();
  const el={id,value:"",textContent:"",innerHTML:"",className:"",title:"",style:{},children:[],disabled:false,scrollTop:0,
   classList:{add(x){classes.add(x);},remove(x){classes.delete(x);},contains(x){return classes.has(x);},toggle(x){if(classes.has(x))classes.delete(x);else classes.add(x);}},
   addEventListener(type,fn){this["on"+type]=fn;},setAttribute(){},focus(){},appendChild(child){this.children.push(child);},click(){if(this.onclick)this.onclick();}};
  elements.set(id,el);return el;
 }
 const bridge={
  get(key){
   if(records.has(key))return {...records.get(key)};
   const day=new Date(key+"T12:00:00Z").getUTCDay(),rest=day===0||day===6;
   return {kind:rest?"rest":"work",shift:"morning",start:"06:00",end:"14:00",breakMins:30,owed:rest?0:.5,extraMins:0,hourlyLeaveMins:0,notes:""};
  },
  update(key,record){updates.push(key);records.set(key,{...record,auto:false});},
  read(){return {data:Object.fromEntries(records)};}
 };
 const window={miJornadaBridge:bridge,addEventListener(){}};
 const document={head:{appendChild(){}},body:{appendChild(){}},createElement(){return element("generated-"+(++generated));},getElementById:element};
 const storage=new Map();
 const localStorage={getItem(key){return storage.get(key)??null;},setItem(key,value){storage.set(key,String(value));}};
 vm.runInNewContext(source,{window,document,localStorage,console,Date,setTimeout,clearTimeout},{timeout:5000});
 function submit(text){element("mj-ai-input").value=text;element("mj-ai-form").onsubmit({preventDefault(){}});}
 return {elements,records,updates,submit};
}

test("la orden por cada día de diciembre presenta los cambios y espera confirmación",()=>{
 const h=harness();
 h.submit("Añade una hora extra cada día de diciembre de 2026");
 assert.equal(h.updates.length,0);
 assert.equal(h.elements.get("mj-ai-confirm").classList.contains("visible"),true);
 const preview=h.elements.get("mj-ai-chat").children.at(-1).textContent;
 assert.match(preview,/Propuesta sin guardar/);
 assert.match(preview,/2026-12-01: 0 h 0 min → 1 h 0 min/);
 const expected=[];
 for(let day=1;day<=31;day++){
  const key="2026-12-"+String(day).padStart(2,"0");
  const weekday=new Date(key+"T12:00:00Z").getUTCDay();
  if(weekday!==0&&weekday!==6)expected.push(key);
 }
 h.elements.get("mj-ai-yes").onclick();
 assert.deepEqual(h.updates,expected);
 for(const key of expected)assert.equal(h.records.get(key).extraMins,60);
 assert.match(h.elements.get("mj-ai-chat").children.at(-1).textContent,/Guardado:/);
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
