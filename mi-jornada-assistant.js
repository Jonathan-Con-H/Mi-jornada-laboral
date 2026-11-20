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
let geminiBusy = false;
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
  Promise.resolve().then(() => window.miJornadaGemini.ask(q, history.slice(-8),
    status => { loading.textContent = status; }))
    .then(text => answer(text))
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
 if(!/(anad|agreg|apunt|pon|registr|sum)/.test(q)||!/(extra|extras)/.test(q))return false;
 const amount=q.match(/(\d+(?:[.,]\d+)?)\s*(horas?|h|minutos?|min)\s*(?:de\s*)?(?:extra|extras)?/);
 let monthIndex=months.findIndex(m=>new RegExp("\\b"+m+"\\b").test(q));
 const relative=/mes que viene|proximo mes|mes siguiente/.test(q);
 if(monthIndex<0&&!relative)return false;
 if(!amount){answer("Indica la cantidad de horas extra.");return true;}
 const today=new Date();
 if(monthIndex<0)monthIndex=(today.getMonth()+1)%12;
 const quantity=Number(amount[1].replace(",","."));
 const mins=Math.round(quantity*(/^(min|minuto)/.test(amount[2])?1:60));
 if(!Number.isFinite(mins)||mins<=0||mins>720){answer("La cantidad de horas extra no es válida.");return true;}
 const yearMatch=q.match(/\b20\d{2}\b/);
 const year=yearMatch?Number(yearMatch[0]):(relative&&monthIndex<today.getMonth()?today.getFullYear()+1:today.getFullYear());
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
  changes.push({date:key,record:{...record,extraMins:next},before:current});
 }
 if(!changes.length){answer("No hay jornadas laborables aptas para esta orden. No he modificado nada.");return true;}
 proposal={changes,what:"Añadir "+mins+" minutos extra a "+changes.length+" jornadas de "+months[monthIndex]+" de "+year};
 answer("Propuesta: "+proposal.what+". Variación total: "+(changes.reduce((a,c)=>a+c.record.extraMins-c.before,0)/60)+" horas. Se omiten "+skipped.length+" días (descansos, ausencias o límites). Se SUMARÁ a las horas existentes; repetir la orden las duplicaría. ¿Confirmas?");
 el("mj-ai-confirm").classList.add("visible");
 return true;
}

function editDayCommand(q){
 if(!/(cambia|modifica|pon|establece|fija|marca|registr|quita|elimina)/.test(q))return false;
 const m=q.match(/\\b(\\d{1,2})[\\/-](\\d{1,2})(?:[\\/-](\\d{4}))?\\b/);
 if(!m)return false;
 const y=m[3]?Number(m[3]):new Date().getFullYear(),mo=Number(m[2]),d=Number(m[1]);
 const date=new Date(y,mo-1,d,12);
 if(date.getFullYear()!==y||date.getMonth()!==mo-1||date.getDate()!==d){answer("La fecha indicada no existe.");return true;}
 const key=iso(date),before=bridge.get(key);
 let record,what;
 if(/vacaciones/.test(q)){record={...before,kind:"vacation",extraMins:0,auto:false};what="Marcar vacaciones el "+key;}
 else if(/turno/.test(q)){
  const shift=/\\btarde\\b/.test(q)?"afternoon":/\\bmanana\\b/.test(q)?"morning":null;
  if(!shift){answer("Indica turno de mañana o de tarde.");return true;}
  record={...before,kind:"work",shift,start:shift==="morning"?"06:00":"14:00",end:shift==="morning"?"14:00":"22:00",auto:false};
  what="Cambiar turno el "+key+" a "+(shift==="morning"?"mañana":"tarde");
 }else if(/extra/.test(q)&&/quita|elimina/.test(q)){
  record={...before,extraMins:0,auto:false};what="Eliminar horas extra el "+key;
 }else return false;
 proposal={date:key,record,before,what};
 answer("Vista previa: "+what+". ¿Confirmas? No guardaré nada hasta tu autorización.");
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
 const match=s.match(/(\d+(?:[.,]\d+)?)\s*(hora|horas|h)\s*(extra|extras)/);
 if(match&&/(anad|apunt|pon|registr|sum)/.test(s)){
  const extra=Math.round(Number(match[1].replace(",","."))*60);
  if(e.kind!=="work"){answer("Ese día figura como descanso. Primero debes registrarlo como día trabajado.");return;}
  if(!(extra>0&&extra<=720)){answer("Indícame entre 1 minuto y 12 horas extra.");return;}
  proposal={date:key,before:e,record:{...e,extraMins:(Number(e.extraMins)||0)+extra},what:"Añadir "+(extra/60)+" h extra el "+human(day)};
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
el("mj-ai-yes").onclick=()=>{if(!proposal)return;const p=proposal;proposal=null;el("mj-ai-confirm").classList.remove("visible");if(p.changes){let done=0;try{for(const c of p.changes){if((Number(bridge.get(c.date).extraMins)||0)!==c.before)throw Error("El día "+c.date+" cambió desde la vista previa.");bridge.update(c.date,c.record);done++;}answer("Guardado: "+p.what+". Días actualizados: "+done+".");}catch(error){answer("Error al guardar: "+done+" días actualizados antes del fallo. Revisa el calendario antes de repetir la orden. "+(error.message||""));}}else{try{if(p.before&&JSON.stringify(bridge.get(p.date))!==JSON.stringify(p.before))throw Error("El registro cambió desde la vista previa.");bridge.update(p.date,p.record);answer("Guardado: "+p.what+".");}catch(error){answer("No se pudo guardar: "+(error.message||"Error desconocido"));}}};
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
