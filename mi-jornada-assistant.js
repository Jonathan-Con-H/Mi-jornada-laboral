(function(){
"use strict";
const bridge=window.miJornadaBridge;
if(!bridge)return;
const HISTORY_KEY="miJornada.chat.v1",VOICE_KEY="miJornada.chat.voice.v1";
let history=[],proposal=null,voiceEnabled=localStorage.getItem(VOICE_KEY)!=="off";
try{const arr=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");if(Array.isArray(arr))history=arr.slice(-100);}catch(e){}
const css=document.createElement("style");
css.textContent="#mj-ai-bubble{position:fixed;right:22px;bottom:85px;background:#086db3;color:#fff;border:1px solid #3fbdff;border-radius:50%;height:57px;width:57px;font-size:1.6rem;z-index:125;touch-action:none;box-shadow:0 8px 25px #0008;cursor:grab}#mj-ai-panel{display:none;position:fixed;z-index:130;right:18px;bottom:145px;width:min(380px,calc(100vw - 25px));height:min(540px,72vh);background:#071d30;color:#fff;border:1px solid #3385bd;border-radius:18px;box-shadow:0 20px 60px #0009;flex-direction:column;overflow:hidden;font-family:system-ui}#mj-ai-panel.open{display:flex}#mj-ai-panel.full{inset:12px;width:auto;height:auto}#mj-ai-panel .head{display:flex;align-items:center;justify-content:space-between;background:#0a324f;padding:13px;gap:8px}#mj-ai-panel .head strong{font-size:1rem}#mj-ai-panel button{background:#145e91;color:#fff;border:0;border-radius:9px;padding:8px;cursor:pointer;font-size:.88rem}#mj-ai-chat{overflow-y:auto;flex:1;padding:12px;display:flex;flex-direction:column;gap:10px}#mj-ai-chat .msg{max-width:94%;border-radius:12px;padding:10px;white-space:pre-wrap;line-height:1.42;font-size:.91rem}#mj-ai-chat .user{align-self:flex-end;background:#0d6dad}#mj-ai-chat .assistant{align-self:flex-start;background:#193d53}#mj-ai-form{display:flex;align-items:center;gap:5px;padding:9px;border-top:1px solid #24506e}#mj-ai-input{background:#04131f;color:#fff;border:1px solid #3a6784;border-radius:9px;padding:10px;flex:1;min-width:0}#mj-ai-confirm{padding:8px;display:none;gap:8px;border-top:1px solid #32637f}#mj-ai-confirm.visible{display:flex}#mj-ai-confirm button{flex:1}#mj-ai-help{font-size:.75rem;color:#b6d4e9;margin:0;padding:7px 12px}";
document.head.appendChild(css);
const bubble=document.createElement("button");bubble.id="mj-ai-bubble";bubble.title="Abrir asistente de Mi Jornada";bubble.textContent="✦";document.body.appendChild(bubble);
const panel=document.createElement("section");panel.id="mj-ai-panel";panel.setAttribute("aria-label","Asistente de Mi Jornada");
panel.innerHTML=[
"<div class='head'><strong>✦ Asistente · Mi Jornada</strong><button id='mj-ai-full' title='Ampliar'>⛶</button><button id='mj-ai-close'>✕</button></div>",
"<p id='mj-ai-help'>Consulta tus turnos o registra horas extra con confirmación. Para otras preguntas, Gemini usará un resumen de turnos y horas cuando esté habilitado App Check y tú autorices el envío a Google. No se comparten tus notas.</p>",
"<div id='mj-ai-chat' aria-live='polite'></div>",
"<div id='mj-ai-confirm'><button id='mj-ai-yes'>Confirmar cambio</button><button id='mj-ai-no'>Cancelar</button></div>",
"<form id='mj-ai-form'><input id='mj-ai-input' aria-label='Escribe a tu asistente' placeholder='Ej.: ¿Qué turno tengo mañana?' autocomplete='off'>",
"<button type='button' id='mj-ai-mic' title='Hablar por micrófono'>🎙</button><button type='submit'>Enviar</button></form>",
"<div style='display:flex;justify-content:space-between;align-items:center;padding:5px 12px;font-size:.75rem'>",
"<label><input id='mj-ai-voice' type='checkbox'> Responder en voz alta</label><button id='mj-ai-clear'>Borrar chat</button></div>"
].join("");
document.body.appendChild(panel);
const el=id=>document.getElementById(id);
function persist(){localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-100)));}
function bubbleMsg(role,text,save=true){
 const div=document.createElement("div");div.className="msg "+role;div.textContent=text;el("mj-ai-chat").appendChild(div);
 el("mj-ai-chat").scrollTop=el("mj-ai-chat").scrollHeight;
 if(save){history.push({role,text,time:new Date().toISOString()});history=history.slice(-100);persist();}
}
history.forEach(m=>{if(m&&["user","assistant"].includes(m.role))bubbleMsg(m.role,String(m.text||""),false);});
if(!history.length)bubbleMsg("assistant","Hola. Puedes preguntarme «¿Qué turno tengo mañana?», «¿Cuántas horas debo este mes?» o decir «Añade 1 hora extra hoy».",true);
function speak(text){
 if(!voiceEnabled||!window.speechSynthesis)return;
 try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="es-ES";u.rate=1;window.speechSynthesis.speak(u);}catch(e){}
}
function answer(text){bubbleMsg("assistant",text);speak(text);}
function iso(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
function dateByWords(q){
 const d=new Date();d.setHours(12,0,0,0);
 if(/pasado manana/.test(q))d.setDate(d.getDate()+2);
 else if(/manana/.test(q))d.setDate(d.getDate()+1);
 else if(/sabado/.test(q))d.setDate(d.getDate()+(6-d.getDay()+7)%7);
 else if(/domingo/.test(q))d.setDate(d.getDate()+(7-d.getDay())%7);
 return d;
}
function human(d){return d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});}
function parseExtraMinutes(q){
 const m=String(q||"").match(/\b(\d+(?:[.,]\d+)?|un(?:a|o)?|media|medio|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(horas?|h|minutos?|min)\b/);
 if(!m)return null;
 const words={un:1,una:1,uno:1,media:.5,medio:.5,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
 const amount=/^\d/.test(m[1])?Number(m[1].replace(",",".")):words[m[1]];
 const minutes=/^(min|minuto)/.test(m[2])?amount:amount*60;
 return Number.isFinite(minutes)?Math.round(minutes):null;
}
function formatExtraMinutes(value){return Math.floor(value/60)+" h "+(value%60)+" min";}
let geminiBusy = false;

function kindLabel(record){
 const kinds={work:"trabajo",rest:"descanso",vacation:"vacaciones",sick:"baja",paid_leave:"permiso retribuido",justified:"ausencia justificada"};
 return (kinds[record.kind]||record.kind)+ (record.kind==="work"?", extra "+formatExtraMinutes(Number(record.extraMins)||0):"");
}
function intentChanges(intent){
 const allowed=["add_extra","set_extra","remove_extra","set_shift","set_vacation"];
 if(!intent||!allowed.includes(intent.action))return null;
 const validDate=key=>{if(typeof key!=="string"||!/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(key))return false;const d=new Date(key+"T12:00:00");return iso(d)===key;};
 let start,end;
 if(intent.scope==="worked_days_month"){
  const month=Number(intent.month),year=Number(intent.year);
  if(!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2020||year>2100)throw Error("Dime el mes y el año completos.");
  start=iso(new Date(year,month-1,1,12));end=iso(new Date(year,month,0,12));
 }else if(intent.scope==="day"&&validDate(intent.date)){start=end=intent.date;
 }else if(intent.scope==="date_range"&&validDate(intent.startDate)&&validDate(intent.endDate)&&intent.startDate<=intent.endDate){start=intent.startDate;end=intent.endDate;
 }else throw Error("No he podido concretar las fechas. Indícame el día o el intervalo completo.");
 const first=new Date(start+"T12:00:00"),last=new Date(end+"T12:00:00");
 const span=Math.round((last-first)/86400000)+1;
 if(span>366)throw Error("El intervalo máximo para una sola orden es de un año.");
 const minutes=Number(intent.minutes);
 if(["add_extra","set_extra"].includes(intent.action)&&(!Number.isInteger(minutes)||minutes<1||minutes>720))throw Error("Dime una cantidad entre 1 minuto y 12 horas.");
 if(intent.action==="set_shift"&&!['morning','afternoon'].includes(intent.shift))throw Error("Indica turno de mañana o de tarde.");
 const opId=[intent.action,start,end,minutes||0,intent.shift||""].join("|");
 const changes=[],skipped=[];
 for(let i=0;i<span;i++){
  const date=new Date(first);date.setDate(date.getDate()+i);const key=iso(date),before=bridge.get(key);
  if(["add_extra","set_extra","remove_extra"].includes(intent.action)&&before.kind!=="work"){skipped.push(key);continue;}
  const markers=Array.isArray(before._assistantOperationIds)?before._assistantOperationIds:[];
  if(intent.action==="add_extra"&&markers.includes(opId)){skipped.push(key);continue;}
  let record={...before};
  if(intent.action==="add_extra")record.extraMins=(Number(before.extraMins)||0)+minutes;
  if(intent.action==="set_extra")record.extraMins=minutes;
  if(intent.action==="remove_extra")record.extraMins=0;
  if(intent.action==="set_shift")Object.assign(record,{kind:"work",shift:intent.shift,start:intent.shift==="morning"?"06:00":"14:00",end:intent.shift==="morning"?"14:00":"22:00",auto:false});
  if(intent.action==="set_vacation")Object.assign(record,{kind:"vacation",extraMins:0,auto:false});
  if(!Number.isFinite(Number(record.extraMins))||Number(record.extraMins)>1440)throw Error("El límite de horas extra se superaría el "+key+". No se ha cambiado ningún día.");
  if(intent.action==="add_extra")record._assistantOperationIds=[...markers,opId].slice(-40);
  changes.push({date:key,before,record});
 }
 if(!changes.length)return {changes:[],skipped,opId,start,end};
 const what={add_extra:"Añadir "+formatExtraMinutes(minutes)+" por jornada",set_extra:"Dejar las horas extra en "+formatExtraMinutes(minutes),remove_extra:"Quitar las horas extra",set_shift:"Cambiar al turno de "+(intent.shift==="morning"?"mañana":"tarde"),set_vacation:"Marcar vacaciones"}[intent.action];
 return {changes,skipped,opId,start,end,what};
}
function showProposal(plan){
 if(!plan.changes.length){answer("No hay cambios nuevos. La orden ya se aplicó a esas jornadas o no hay días que cumplan el criterio. No he guardado nada.");return;}
 const totalAdded=plan.changes.reduce((sum,c)=>sum+(Number(c.record.extraMins)||0)-(Number(c.before.extraMins)||0),0);
 const detail=plan.changes.map(c=>c.date+": "+kindLabel(c.before)+" → "+kindLabel(c.record)).join("\n");
 proposal={changes:plan.changes,what:plan.what||"Actualizar registros",opId:plan.opId};
 answer("Vista previa sin guardar: "+proposal.what+" del "+plan.start+" al "+plan.end+".\n"+detail+(totalAdded?"\nTotal que se añade: "+formatExtraMinutes(totalAdded)+".":"")+(plan.skipped.length?"\nSe omiten "+plan.skipped.length+" días (descanso, ausencia o repetición de la misma orden).":"")+"\nConfirma para aplicar todo el lote o cancela.");
 el("mj-ai-confirm").classList.add("visible");
}
function applyGeminiIntent(intent){
 if(!intent||intent.action==="unknown")return false;
 showProposal(intentChanges(intent));return true;
}
function askWithGemini(q) {
  if (!window.miJornadaGemini) {
    answer("El motor Gemini todavía no se ha cargado. Puedes seguir consultando turnos y horas.");
    return;
  }
  geminiBusy = true;
  const loading = document.createElement("div");
  loading.className = "msg assistant";
  loading.textContent = "Consultando Gemini…";
  el("mj-ai-chat").appendChild(loading);
  el("mj-ai-chat").scrollTop = el("mj-ai-chat").scrollHeight;
  // El motor limita cada etapa y cada petición, sin contar el diálogo de permiso.
  Promise.resolve().then(() => window.miJornadaGemini.interpret(q, history.slice(-8),
    status => { loading.textContent = status; }))
    .then(intent => {if(!applyGeminiIntent(intent))return window.miJornadaGemini.ask(q,history.slice(-8)).then(answer);})
    .catch(error => {
      const message = error && error.message ? error.message : "Error de conexión.";
      if (/Failed to fetch/i.test(message)) {
        answer("No se pudo conectar con Firebase AI Logic. Revisa la configuración de App Check y la conexión a Internet. Tus jornadas siguen guardadas.");
      } else {
        answer("No se pudo consultar Gemini: " + message);
      }
    })
    .finally(() => { loading.remove(); geminiBusy = false; });
}

// Órdenes masivas deterministas: Gemini no puede escribir registros directamente.
function resolveRange(q){
 const today=new Date();today.setHours(12,0,0,0);
 const nextMonth=new Date(today.getFullYear(),today.getMonth()+1,1,12);
 let start=null,end=null;
 const isoMatch=q.match(/desde\s+(?:el\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?/);
 const namedMatch=q.match(/desde\s+(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(20\d{2}))?/);
 const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
 if(isoMatch||namedMatch){const m=isoMatch?Number(isoMatch[2]):months.indexOf(namedMatch[2])+1,d=isoMatch?Number(isoMatch[1]):Number(namedMatch[1]),y=Number((isoMatch&&isoMatch[3])||(namedMatch&&namedMatch[3])||today.getFullYear());start=new Date(y,m-1,d,12);if(start.getFullYear()!==y||start.getMonth()!==m-1||start.getDate()!==d)return {invalid:true};}
 else if(/primer\s+martes\s+del\s+mes\s+que\s+viene/.test(q)){
  start=new Date(nextMonth);while(start.getDay()!==2)start.setDate(start.getDate()+1);
 }
 else if(/martes\s+del\s+mes\s+que\s+viene/.test(q)){
  return {needsClarification:true,question:"Hay varios martes el mes que viene. ¿Te refieres al primero ("+iso(new Date(nextMonth.getFullYear(),nextMonth.getMonth(),1+((2-nextMonth.getDay()+7)%7),12))+"), o a otro martes?"};
 }
 if(/fin\s+de\s+ano|final\s+de\s+ano|hasta\s+diciembre|fin\s+del\s+ano/.test(q))end=new Date(today.getFullYear(),11,31,12);
 else if(/fin\s+de\s+mes|hasta\s+fin\s+de\s+mes/.test(q))end=new Date(today.getFullYear(),today.getMonth()+1,0,12);
 const both=(q.match(/desde\b/g)||[]).length&&(/\bhasta\b/.test(q)||/\bal\s+fin\b/.test(q));
 if(start&&end&&start<=end&&both)return {start:iso(start),end:iso(end)};
 return null;
}
function bulkExtraCommand(q) {
 const dailyScope=/\b(?:cada\s+(?:(?:uno|una)\s+)?(?:de\s+los\s+)?|todos?\s+(?:los\s+)?|todas\s+(?:las\s+)?)(?:dias?|jornadas?|turnos?)\b|\bpor\s+(?:cada\s+)?(?:dia|jornada)\b|\bdiariamente\b|\bcada\s+jornada\s+trabajada\b/.test(q);
 if(!dailyScope||!/(anad|agreg|apunt|pon|registr|sum)/.test(q)||!/(extra|extras)/.test(q))return false;
 const minutes=parseExtraMinutes(q);
 if(minutes===null){answer("¿Cuántas horas o minutos extra quieres añadir a cada jornada?");return true;}
 if(minutes<=0||minutes>720){answer("La cantidad no es válida. El límite por jornada es 12 horas.");return true;}
 const range=resolveRange(q);
 if(range&&range.needsClarification){answer(range.question+" No he preparado ni guardado cambios.");return true;}
 if(range&&range.invalid){answer("La fecha indicada no existe. No he cambiado nada.");return true;}
 const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
 let start,end;
 if(range){start=range.start;end=range.end;}
 else {
  let month=months.findIndex(m=>new RegExp("\\b"+m+"\\b").test(q));
  const relative=/mes\s+que\s+viene|proximo\s+mes|mes\s+siguiente/.test(q);
  if(month<0&&!relative)return false;
  const now=new Date();if(month<0)month=(now.getMonth()+1)%12;
  const yearMatch=q.match(/\b20\d{2}\b/),year=Number(yearMatch?yearMatch[0]:(month<now.getMonth()?now.getFullYear()+1:now.getFullYear()));
  start=iso(new Date(year,month,1,12));end=iso(new Date(year,month+1,0,12));
 }
 if(start>end){answer("El final del intervalo es anterior al inicio. No he cambiado nada.");return true;}
 const plan=intentChanges({action:"add_extra",scope:"date_range",startDate:start,endDate:end,minutes});
 if(!plan.changes.length){answer("No hay jornadas trabajadas nuevas para esta orden. No he guardado nada.");return true;}
 plan.what="Añadir "+formatExtraMinutes(minutes)+" a cada jornada trabajada";
 showProposal(plan);return true;
}
function editDayCommand(q){
 if(!/(cambia|modifica|pon|establece|fija|marca|registr|quita|elimina|anad|agreg|apunt|sum)/.test(q))return false;
 const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
 const numeric=q.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\b/);
 const named=q.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(20\d{2}))?\b/);
 if(!numeric&&!named)return false;
 const d=numeric?Number(numeric[1]):Number(named[1]);
 const mo=numeric?Number(numeric[2]):months.indexOf(named[2])+1;
 const y=numeric?(numeric[3]?Number(numeric[3]):new Date().getFullYear()):(named[3]?Number(named[3]):new Date().getFullYear());
 const date=new Date(y,mo-1,d,12);
 if(date.getFullYear()!==y||date.getMonth()!==mo-1||date.getDate()!==d){answer("La fecha indicada no existe.");return true;}
 const key=iso(date),before=bridge.get(key);
 let record,what;
 if(/vacaciones/.test(q)){record={...before,kind:"vacation",extraMins:0,auto:false};what="Marcar vacaciones el "+key;}
 else if(/turno/.test(q)){
  const shift=/\btarde\b/.test(q)?"afternoon":/\bmanana\b/.test(q)?"morning":null;
  if(!shift){answer("Indica turno de mañana o de tarde.");return true;}
  record={...before,kind:"work",shift,start:shift==="morning"?"06:00":"14:00",end:shift==="morning"?"14:00":"22:00",auto:false};
  what="Cambiar turno el "+key+" a "+(shift==="morning"?"mañana":"tarde");
 }else if(/extra/.test(q)&&/quita|elimina/.test(q)){
  record={...before,extraMins:0,auto:false};what="Eliminar horas extra el "+key;
 }else if(/extra/.test(q)&&/(anad|agreg|apunt|pon|registr|sum)/.test(q)){
  const minutes=parseExtraMinutes(q);
  if(minutes===null){answer("Dime cuántas horas o minutos extra quieres añadir.");return true;}
  if(minutes<=0||minutes>720){answer("Indica entre 1 minuto y 12 horas extra.");return true;}
  if(before.kind!=="work"){answer("Ese día no está marcado como trabajado. No he cambiado nada.");return true;}
  const plan=intentChanges({action:"add_extra",scope:"day",date:key,minutes});
  showProposal(plan);return true;
 }else return false;
 proposal={date:key,record,before,what};
 answer("Vista previa sin guardar: "+what+". ¿Confirmas? No guardaré nada hasta que pulses «Confirmar cambio».");
 el("mj-ai-confirm").classList.add("visible");return true;
}
function onCommand(q){
 const s=q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
 proposal=null;el("mj-ai-confirm").classList.remove("visible");
 if(bulkExtraCommand(s)||editDayCommand(s))return;
 const day=dateByWords(s),key=iso(day),e=bridge.get(key);
 if(/(cuant|total).*(debo|deuda|pendientes|extra)/.test(s)||/horas que debo/.test(s)){
  const snap=bridge.read(),isExtra=/extra/.test(s),now=new Date(),month=now.getMonth(),year=now.getFullYear();
  let total=0;
  for(const [date,entry] of Object.entries(snap.data||{})){
   const d=new Date(date+"T12:00:00");
   if(d.getMonth()===month&&d.getFullYear()===year&&entry.kind==="work")
    total+=isExtra?Number(entry.extraMins)||0:Math.round((Number(entry.owed)||0)*60);
  }
  answer("Este mes llevas "+Math.floor(total/60)+" horas y "+(total%60)+" minutos "+(isExtra?"extra registrados.":"que debes por descansos en las jornadas registradas."));return;
 }
 const extra=parseExtraMinutes(s);
 if(extra!==null&&/(anad|agreg|apunt|pon|registr|sum)/.test(s)){
  if(!/\b(hoy|manana|pasado manana|sabado|domingo)\b/.test(s)){
   answer("Indica a qué día se refiere la orden (por ejemplo, «hoy», «mañana» o una fecha). No he cambiado nada.");return;
  }
  const extraMinutes=extra;
  if(e.kind!=="work"){answer("Ese día figura como descanso. Primero debes registrarlo como día trabajado.");return;}
  if(!(extraMinutes>0&&extraMinutes<=720)){answer("Indícame entre 1 minuto y 12 horas extra.");return;}
  const plan=intentChanges({action:"add_extra",scope:"day",date:key,minutes:extraMinutes});
  plan.what="Añadir "+formatExtraMinutes(extraMinutes)+" extra";
  showProposal(plan);return;
 }
 if(/sabado.*trabaj|trabaj.*sabado/.test(s)){
  const d=dateByWords("sabado"),k=iso(d),record=bridge.get(k);
  proposal={date:k,before:record,record:{...record,kind:"work",breakMins:30,owed:.5,auto:false},what:"Registrar trabajo el "+human(d)};
  answer("Puedo marcar el "+human(d)+" como trabajado, con el turno previsto y 30 minutos de descanso. ¿Confirmas?");
  el("mj-ai-confirm").classList.add("visible");return;
 }
 if(/turno|trabaj.*(manana|hoy|sabado|domingo)/.test(s)){
  const turno=e.kind==="rest"?"descanso previsto":("turno de "+(e.shift==="morning"?"mañana de 06:00 a 14:00":"tarde de 14:00 a 22:00"));answer("El "+human(day)+" tienes "+turno+".");return;
 }
 askWithGemini(q);
}
function open(){panel.classList.add("open");el("mj-ai-input").focus();}
function close(){panel.classList.remove("open");if(window.speechSynthesis)window.speechSynthesis.cancel();}
window.addEventListener("mi-jornada:open-tool",e=>{if(e.detail&&e.detail.page==="ai")open();});
el("mj-ai-close").onclick=close;
el("mj-ai-full").onclick=()=>panel.classList.toggle("full");
el("mj-ai-form").onsubmit=event=>{event.preventDefault();if(geminiBusy)return;const q=el("mj-ai-input").value.trim();if(!q)return;el("mj-ai-input").value="";bubbleMsg("user",q);onCommand(q);};
el("mj-ai-yes").onclick=()=>{if(!proposal)return;const p=proposal;el("mj-ai-yes").disabled=true;try{if(p.changes){for(const c of p.changes)if(JSON.stringify(bridge.get(c.date))!==JSON.stringify(c.before))throw Error("El día "+c.date+" cambió desde la vista previa. No se ha guardado ningún cambio.");if(typeof bridge.updateMany!=="function")throw Error("Esta versión no permite guardar el lote de forma segura. Actualiza la aplicación.");bridge.updateMany(p.changes.map(c=>({date:c.date,record:c.record})));}else{if(p.before&&JSON.stringify(bridge.get(p.date))!==JSON.stringify(p.before))throw Error("El registro cambió desde la vista previa. No se ha guardado ningún cambio.");bridge.update(p.date,p.record);}proposal=null;el("mj-ai-confirm").classList.remove("visible");answer("Guardado correctamente: "+p.what+".");}catch(error){answer("No se ha confirmado el guardado: "+(error.message||"error desconocido"));}finally{el("mj-ai-yes").disabled=false;}};
el("mj-ai-no").onclick=()=>{proposal=null;el("mj-ai-confirm").classList.remove("visible");answer("Cambio cancelado. No he modificado la jornada.");};
el("mj-ai-clear").onclick=()=>{if(!confirm("¿Borrar el historial del chat de este dispositivo?"))return;history=[];persist();el("mj-ai-chat").innerHTML="";bubbleMsg("assistant","Historial borrado. ¿Qué quieres consultar?");};
el("mj-ai-voice").checked=voiceEnabled;
el("mj-ai-voice").onchange=e=>{voiceEnabled=e.target.checked;localStorage.setItem(VOICE_KEY,voiceEnabled?"on":"off");if(!voiceEnabled&&window.speechSynthesis)window.speechSynthesis.cancel();};
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
 const rec=new SR();rec.lang="es-ES";rec.interimResults=false;
 el("mj-ai-mic").onclick=()=>{try{rec.start();}catch(e){answer("No se pudo activar el micrófono.");}};
 rec.onresult=e=>{el("mj-ai-input").value=e.results[0][0].transcript;el("mj-ai-form").requestSubmit();};
 rec.onerror=()=>answer("No se pudo reconocer la voz. Puedes escribir la petición.");
}else{el("mj-ai-mic").disabled=true;el("mj-ai-mic").title="Reconocimiento de voz no disponible en este navegador";}
const saved=localStorage.getItem("miJornada.ai.position");
if(saved){try{const p=JSON.parse(saved);bubble.style.left=Math.min(Math.max(0,p.x),window.innerWidth-65)+"px";bubble.style.top=Math.min(Math.max(0,p.y),window.innerHeight-65)+"px";bubble.style.bottom="auto";bubble.style.right="auto";}catch(e){}}
let down=null,moved=false;
bubble.addEventListener("pointerdown",e=>{down={x:e.clientX,y:e.clientY,left:bubble.getBoundingClientRect().left,top:bubble.getBoundingClientRect().top};moved=false;bubble.setPointerCapture(e.pointerId);});
bubble.addEventListener("pointermove",e=>{if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.abs(dx)+Math.abs(dy)>9)moved=true;if(!moved)return;const x=Math.max(0,Math.min(window.innerWidth-60,down.left+dx)),y=Math.max(0,Math.min(window.innerHeight-60,down.top+dy));bubble.style.left=x+"px";bubble.style.top=y+"px";bubble.style.right="auto";bubble.style.bottom="auto";});
bubble.addEventListener("pointerup",()=>{down=null;if(moved)localStorage.setItem("miJornada.ai.position",JSON.stringify({x:parseInt(bubble.style.left,10),y:parseInt(bubble.style.top,10)}));});
bubble.addEventListener("click",()=>{if(moved){moved=false;return;}panel.classList.contains("open")?close():open();});
})();
