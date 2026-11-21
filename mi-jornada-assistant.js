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

function applyGeminiIntent(intent){
 const allowed=["add_extra","set_extra","remove_extra","set_shift","set_vacation"];
 if(!intent||!allowed.includes(intent.action))return false;
 const datePattern=/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
 const validDate=key=>{if(typeof key!=="string"||!datePattern.test(key))return false;const d=new Date(key+"T12:00:00");return iso(d)===key;};
 const changes=[];
 if(intent.scope==="worked_days_month"){
  if(!["add_extra","set_extra","remove_extra"].includes(intent.action))throw Error("Operación mensual no permitida.");
  const month=Number(intent.month),year=Number(intent.year);
  if(!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2020||year>2100)throw Error("Mes o año no válido.");
  for(let day=1;day<=new Date(year,month,0).getDate();day++){
   const key=iso(new Date(year,month-1,day,12)),d=new Date(key+"T12:00:00");
   if(d.getDay()===0||d.getDay()===6)continue;
   const before=bridge.get(key);
   if(before.kind!=="work")continue;
   changes.push({date:key,before,record:null});
  }
 }else if(intent.scope==="day"&&validDate(intent.date)){
  const before=bridge.get(intent.date);
  changes.push({date:intent.date,before,record:null});
 }else throw Error("Indica una fecha concreta o un mes completo de días trabajados.");
 if(changes.length>31)throw Error("Demasiados días para una sola operación.");
 const minutes=Number(intent.minutes);
 if(["add_extra","set_extra"].includes(intent.action)&&(!Number.isInteger(minutes)||minutes<1||minutes>720))throw Error("Indica entre 1 y 720 minutos extra.");
 if(intent.action==="set_shift"&&!["morning","afternoon"].includes(intent.shift))throw Error("Turno no válido.");
 for(const change of changes){
  const e=change.before;
  if(["add_extra","set_extra"].includes(intent.action)&&e.kind!=="work")throw Error("El "+change.date+" no está marcado como trabajado.");
  if(intent.action==="add_extra")change.record={...e,extraMins:(Number(e.extraMins)||0)+minutes};
  if(intent.action==="set_extra")change.record={...e,extraMins:minutes};
  if(intent.action==="remove_extra")change.record={...e,extraMins:0};
  if(intent.action==="set_shift"){
   const morning=intent.shift==="morning";
   change.record={...e,kind:"work",shift:intent.shift,start:morning?"06:00":"14:00",end:morning?"14:00":"22:00",auto:false};
  }
  if(intent.action==="set_vacation")change.record={...e,kind:"vacation",extraMins:0,auto:false};
  if(!Number.isFinite(Number(change.record.extraMins))||Number(change.record.extraMins)>1440)throw Error("Límite de horas extra excedido.");
 }
 if(!changes.length){answer("No hay días trabajados que cumplan la orden. No he cambiado nada.");return true;}
 const what=intent.action+" en "+changes.length+" día(s): "+changes.map(c=>c.date).join(", ");
 proposal={changes:changes.map(c=>({...c,beforeExtra:Number(c.before.extraMins)||0})),what};
 answer("Gemini ha interpretado esta propuesta (sin guardar): "+what+". Pulsa «Confirmar cambio» para aplicarla o «Cancelar» para descartarla.");
 el("mj-ai-confirm").classList.add("visible");return true;
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
function bulkExtraCommand(q) {
 const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
 const dailyScope=/\b(?:cada\s+(?:(?:uno|una)\s+)?(?:de\s+los\s+)?|todos?\s+(?:los\s+)?|todas\s+(?:las\s+)?)(?:dias?|jornadas?|turnos?)\b|\bpor\s+(?:cada\s+)?(?:dia|jornada)\b|\bdiariamente\b/.test(q);
 if(!dailyScope||!/(anad|agreg|apunt|pon|registr|sum)/.test(q)||!/(extra|extras)/.test(q))return false;
 let monthIndex=months.findIndex(m=>new RegExp("\\b"+m+"\\b").test(q));
 const relative=/mes que viene|proximo mes|mes siguiente/.test(q);
 if(monthIndex<0&&!relative)return false;
 const mins=parseExtraMinutes(q);
 if(mins===null){answer("Dime cuántas horas o minutos extra quieres añadir a cada jornada.");return true;}
 if(mins<=0||mins>720){answer("La cantidad de horas extra no es válida. El límite por jornada es 12 horas.");return true;}
 const today=new Date();
 if(monthIndex<0)monthIndex=(today.getMonth()+1)%12;
 const yearMatch=q.match(/\b20\d{2}\b/);
 const year=yearMatch?Number(yearMatch[0]):(monthIndex<today.getMonth()?today.getFullYear()+1:today.getFullYear());
 const changes=[],skipped=[];
 const setInstead=/establece|fija|deja en|pon a/.test(q);
 const days=new Date(year,monthIndex+1,0).getDate();
 for(let d=1;d<=days;d++){
  const date=new Date(year,monthIndex,d,12),key=iso(date);
  if(date.getDay()===0||date.getDay()===6){skipped.push(key);continue;}
  const record=bridge.get(key);
  if(record.kind!=="work"){skipped.push(key);continue;}
  const current=Number(record.extraMins)||0;
  const next=setInstead?mins:current+mins;
  if(next>1440){skipped.push(key);continue;}
  changes.push({date:key,before:record,beforeExtra:current,record:{...record,extraMins:next}});
 }
 if(!changes.length){answer("No hay jornadas laborables aptas para esta orden. No he modificado nada.");return true;}
 const added=changes.reduce((a,c)=>a+c.record.extraMins-c.beforeExtra,0);
 proposal={changes,what:(setInstead?"Establecer":"Añadir")+" "+formatExtraMinutes(mins)+" extra en "+changes.length+" jornadas de "+months[monthIndex]+" de "+year};
 const detail=changes.map(c=>c.date+": "+formatExtraMinutes(c.beforeExtra)+" → "+formatExtraMinutes(c.record.extraMins)).join("; ");
 answer("Propuesta sin guardar: "+proposal.what+". Cambio total: "+formatExtraMinutes(added)+". Días y valores: "+detail+". Se omiten "+skipped.length+" días (descansos, ausencias o límites). Repetir «añadir» sumaría otra vez. Pulsa «Confirmar cambio» para guardar o «Cancelar».");
 el("mj-ai-confirm").classList.add("visible");
 return true;
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
  record={...before,extraMins:(Number(before.extraMins)||0)+minutes,auto:false};
  what="Añadir "+formatExtraMinutes(minutes)+" extra el "+human(date);
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
  const nextExtra=(Number(e.extraMins)||0)+extraMinutes;
  proposal={date:key,before:e,record:{...e,extraMins:nextExtra},what:"Añadir "+formatExtraMinutes(extraMinutes)+" extra el "+human(day)};
  answer("Voy a "+proposal.what.toLowerCase()+". ¿Confirmas? No lo guardaré hasta que pulses «Confirmar cambio».");
  el("mj-ai-confirm").classList.add("visible");return;
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
el("mj-ai-yes").onclick=()=>{if(!proposal)return;const p=proposal;proposal=null;el("mj-ai-confirm").classList.remove("visible");if(p.changes){let done=0;try{for(const c of p.changes){if(JSON.stringify(bridge.get(c.date))!==JSON.stringify(c.beforeExtra===undefined?bridge.get(c.date):c.before))throw Error("El día "+c.date+" cambió desde la vista previa.");bridge.update(c.date,c.record);done++;}answer("Guardado: "+p.what+". Días actualizados: "+done+".");}catch(error){answer("Error al guardar: "+done+" días actualizados antes del fallo. Revisa el calendario antes de repetir la orden. "+(error.message||""));}}else{try{if(p.before&&JSON.stringify(bridge.get(p.date))!==JSON.stringify(p.before))throw Error("El registro cambió desde la vista previa.");bridge.update(p.date,p.record);answer("Guardado: "+p.what+".");}catch(error){answer("No se pudo guardar: "+(error.message||"Error desconocido"));}}};
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
