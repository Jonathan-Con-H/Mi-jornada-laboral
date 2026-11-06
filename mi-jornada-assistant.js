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
"<div class='head'><strong>✦ Asistente · funciones iniciales</strong><button id='mj-ai-full' title='Ampliar'>⛶</button><button id='mj-ai-close'>✕</button></div>",
"<p id='mj-ai-help'>Consulta turnos y horas, o pide anotar horas extra. Los cambios siempre requieren confirmación. No es todavía una IA conversacional.</p>",
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
 if(/mañana/.test(q))d.setDate(d.getDate()+1);
 else if(/pasado mañana/.test(q))d.setDate(d.getDate()+2);
 else if(/sábado/.test(q))d.setDate(d.getDate()+(6-d.getDay()+7)%7);
 else if(/domingo/.test(q))d.setDate(d.getDate()+(7-d.getDay())%7);
 return d;
}
function human(d){return d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"});}
function onCommand(q){
 const s=q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
 proposal=null;el("mj-ai-confirm").classList.remove("visible");
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
  if(!(extra>0&&extra<=720)){answer("Indícame entre 1 minuto y 12 horas extra.");return;}
  proposal={date:key,record:{...e,extraMins:(Number(e.extraMins)||0)+extra},what:"Añadir "+(extra/60)+" h extra el "+human(day)};
  answer("Voy a "+proposal.what.toLowerCase()+". ¿Confirmas? No lo guardaré hasta que pulses «Confirmar cambio».");
  el("mj-ai-confirm").classList.add("visible");return;
 }
 if(/sabado.*trabaj|trabaj.*sabado/.test(s)){
  const d=dateByWords("sabado"),k=iso(d),record=bridge.get(k);
  proposal={date:k,record:{...record,kind:"work",breakMins:30,owed:.5,auto:false},what:"Registrar trabajo el "+human(d)};
  answer("Puedo marcar el "+human(d)+" como trabajado, con el turno previsto y 30 minutos de descanso. ¿Confirmas?");
  el("mj-ai-confirm").classList.add("visible");return;
 }
 if(/turno|trabaj.*(manana|hoy|sabado|domingo)/.test(s)){
  answer("El "+human(day)+" tienes "+(e.kind==="rest"?"descanso previsto":("turno de "+(e.shift==="morning"?"mañana de 06:00 a 14:00":"tarde de 14:00 a 22:00"))+".");return;
 }
 answer("Todavía solo puedo consultar tus turnos, las horas pendientes del mes y proponer horas extra o trabajo en sábado. Para otras peticiones sigo necesitando integrar un motor de IA.");
}
function open(){panel.classList.add("open");el("mj-ai-input").focus();}
function close(){panel.classList.remove("open");if(window.speechSynthesis)window.speechSynthesis.cancel();}
window.addEventListener("mi-jornada:open-tool",e=>{if(e.detail&&e.detail.page==="ai")open();});
el("mj-ai-close").onclick=close;
el("mj-ai-full").onclick=()=>panel.classList.toggle("full");
el("mj-ai-form").onsubmit=event=>{event.preventDefault();const q=el("mj-ai-input").value.trim();if(!q)return;el("mj-ai-input").value="";bubbleMsg("user",q);onCommand(q);};
el("mj-ai-yes").onclick=()=>{if(!proposal)return;const p=proposal;proposal=null;el("mj-ai-confirm").classList.remove("visible");bridge.update(p.date,p.record);answer("Guardado: "+p.what+".");};
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
