import {getApps,getApp,initializeApp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-functions.js";
import config from "./firebase-web-config.js";
const bridge=window.miJornadaBridge;
if(!bridge)throw Error("Mi Jornada no está preparada");
const app=getApps().length?getApp():initializeApp(config),auth=getAuth(app);
const api=httpsCallable(getFunctions(app,"europe-southwest1"),"miJornadaAI",{timeout:90000});
const $=id=>document.getElementById(id);
const posKey="miJornada.ai.position",voiceKey="miJornada.ai.voice.v2";
let user=null,id=null,pending=null,before=null,busy=false,voice=localStorage.getItem(voiceKey)==="on";
const css=document.createElement("style");
css.textContent=[
"#mj-ai-bubble-v2{position:fixed;right:22px;bottom:85px;width:58px;height:58px;background:#0871b8;color:#fff;border:1px solid #59c2ff;border-radius:50%;font:700 1.6rem system-ui;z-index:150;box-shadow:0 8px 25px #0008;touch-action:none;cursor:grab}",
"#mj-ai-panel-v2{display:none;position:fixed;right:16px;bottom:150px;width:min(420px,calc(100vw - 24px));height:min(625px,80vh);z-index:151;background:#071a2b;color:white;border:1px solid #397ca4;border-radius:17px;box-shadow:0 20px 60px #000b;flex-direction:column;overflow:hidden;font:14px system-ui}",
"#mj-ai-panel-v2.open{display:flex}#mj-ai-panel-v2.full{inset:8px;width:auto;height:auto}",
"#mj-ai-panel-v2 button,#mj-ai-panel-v2 select{border:1px solid #3078a5;background:#14567e;color:#fff;border-radius:9px;padding:8px;cursor:pointer;font:inherit}",
"#mj-ai-panel-v2 button:disabled{opacity:.5}#mj-ai-panel-v2 .head,#mj-ai-panel-v2 .bar{display:flex;align-items:center;gap:7px;padding:9px;background:#0c2e45}",
"#mj-ai-panel-v2 .head strong{flex:1}#mj-ai-panel-v2 .bar{background:#0a2439;border-bottom:1px solid #285775}",
"#mj-ai-panel-v2 .bar select{flex:1;min-width:0}#mj-ai-panel-v2 .messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:12px}",
"#mj-ai-panel-v2 .msg{max-width:94%;padding:10px;border-radius:12px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}",
"#mj-ai-panel-v2 .msg.user{align-self:flex-end;background:#09699d}#mj-ai-panel-v2 .msg.assistant{align-self:flex-start;background:#194058}",
"#mj-ai-panel-v2 .status{min-height:23px;color:#bcd8eb;font-size:.8rem;padding:5px 10px}",
"#mj-ai-panel-v2 .confirm{display:none;flex-direction:column;gap:7px;padding:9px;background:#102d42}#mj-ai-panel-v2 .confirm.visible{display:flex}#mj-ai-panel-v2 .confirm div{display:flex;gap:9px}#mj-ai-panel-v2 .confirm button{flex:1}",
"#mj-ai-panel-v2 .form{display:flex;gap:5px;padding:9px;border-top:1px solid #356584}#mj-ai-panel-v2 .form input{flex:1;min-width:0;background:#041625;color:#fff;border:1px solid #3e799c;border-radius:9px;padding:10px;font:inherit}",
"#mj-ai-panel-v2 .bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;font-size:.75rem}",
"#mj-ai-panel-v2 .memory-view{display:none;position:absolute;inset:0;background:#071b2b;z-index:3;padding:10px;overflow:auto}#mj-ai-panel-v2 .memory-view.open{display:block}",
"#mj-ai-panel-v2 .memory-row{display:grid;grid-template-columns:1fr auto;gap:5px;padding:8px 0;border-bottom:1px solid #305373}",
"#mj-ai-panel-v2 .memory-view input{background:#061a2b;color:#fff;border:1px solid #40779b;border-radius:7px;padding:8px;min-width:0;width:100%}",
"@media(max-width:600px){#mj-ai-panel-v2{right:5px;bottom:72px;width:calc(100vw - 10px);height:min(650px,80vh)}}"
].join("");
document.head.appendChild(css);
const bubble=document.createElement("button");bubble.id="mj-ai-bubble-v2";bubble.type="button";bubble.textContent="✦";bubble.title="Asistente IA";document.body.appendChild(bubble);
const panel=document.createElement("section");panel.id="mj-ai-panel-v2";panel.setAttribute("aria-label","Asistente IA de Mi Jornada");
panel.innerHTML=[
'<div class="head"><strong>✦ Mi Jornada · IA</strong><button type="button" id="mj-ai-memory-open">Memoria</button><button type="button" id="mj-ai-full">⛶</button><button type="button" id="mj-ai-close">✕</button></div>',
'<div class="bar"><select id="mj-ai-chats" aria-label="Conversaciones"><option value="">Conversación nueva</option></select><button type="button" id="mj-ai-new">＋</button><button type="button" id="mj-ai-delete">🗑</button></div>',
'<div class="messages" id="mj-ai-messages" aria-live="polite"></div><div class="status" id="mj-ai-status" role="status"></div>',
'<div class="confirm" id="mj-ai-confirm"><span id="mj-ai-change-text"></span><div><button type="button" id="mj-ai-yes">Confirmar</button><button type="button" id="mj-ai-no">Cancelar</button></div></div>',
'<form class="form" id="mj-ai-form"><input id="mj-ai-input" autocomplete="off" maxlength="2000" placeholder="Escribe o dicta un mensaje" aria-label="Mensaje"><button type="button" id="mj-ai-mic" title="Dictar">🎙</button><button type="submit" id="mj-ai-send">Enviar</button></form>',
'<div class="bottom"><label><input type="checkbox" id="mj-ai-voice"> Responder con voz</label><span>Cambios solo con confirmación</span></div>',
'<div class="memory-view" id="mj-ai-memory-view"><div class="head"><strong>Memoria de la IA</strong><button type="button" id="mj-ai-memory-close">Volver</button></div><p>Puedes consultar, modificar y borrar tus recuerdos.</p><div id="mj-ai-memory-list"></div><p>Nuevo recuerdo</p><input id="mj-ai-memory-key" maxlength="70" placeholder="Nombre"><input id="mj-ai-memory-value" maxlength="300" placeholder="Lo que debo recordar"><button type="button" id="mj-ai-memory-add">Guardar recuerdo</button></div>'
].join("");
document.body.appendChild(panel);
function status(s){$("mj-ai-status").textContent=s;}
function display(role,s){
 const div=document.createElement("div");div.className="msg "+role;div.textContent=String(s||"");
 $("mj-ai-messages").append(div);$("mj-ai-messages").scrollTop=$("mj-ai-messages").scrollHeight;
}
function welcome(){display("assistant","Hola. Puedo conversar contigo, consultar tu calendario, proponerte cambios y recordar preferencias. Inicia sesión en Mi nube para usar la IA.");}
function clearProposal(){pending=null;before=null;$("mj-ai-confirm").classList.remove("visible");}
function reset(){clearProposal();$("mj-ai-messages").replaceChildren();}
function speak(s){
 if(!voice||!window.speechSynthesis)return;
 try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(s).slice(0,3000));u.lang="es-ES";window.speechSynthesis.speak(u);}catch(e){}
}
function dataContext(){
 const snap=bridge.read(),cut=new Date();cut.setDate(cut.getDate()-365);
 const min=[cut.getFullYear(),String(cut.getMonth()+1).padStart(2,"0"),String(cut.getDate()).padStart(2,"0")].join("-");
 const data={};Object.keys(snap.data||{}).filter(k=>k>=min).sort().slice(-210).forEach(k=>data[k]=snap.data[k]);
 return {app:snap.app,automatico:snap.automatico,data,anchor:"2026-10-19",rotation:["morning","afternoon","morning","morning"],timeZone:"Europe/Madrid"};
}
function friendly(error){
 const code=String(error?.code||"");
 if(code.includes("permission-denied"))return "Tu cuenta no está autorizada para esta IA. Revisa el UID propietario.";
 if(code.includes("unauthenticated"))return "Inicia sesión en Mi nube.";
 if(code.includes("resource-exhausted"))return error.message||"Límite de uso alcanzado.";
 if(code.includes("not-found"))return "No se encuentra esa conversación.";
 return "La IA todavía no está disponible o no responde. Tus jornadas no se han modificado.";
}
async function call(payload){if(!user)throw Error("Inicia sesión en Mi nube.");return (await api(payload)).data;}
async function refresh(select){
 try{
  const x=await call({op:"list"}),drop=$("mj-ai-chats");drop.replaceChildren();drop.add(new Option("Conversación nueva",""));
  for(const chat of x.conversations||[])drop.add(new Option(chat.title||"Conversación",chat.id));
  drop.value=select||"";
 }catch(e){status(friendly(e));}
}
async function load(chatId){
 if(busy)return;id=chatId||null;reset();if(!id){welcome();return;}
 status("Recuperando conversación…");
 try{const x=await call({op:"load",conversationId:id});for(const m of x.messages||[])if(["user","assistant"].includes(m.role))display(m.role,m.text);status("");}
 catch(e){status(friendly(e));}
}
function propose(p){
 pending=p;before=p.type==="update_day"?JSON.stringify(bridge.get(p.date)):null;
 $("mj-ai-change-text").textContent=p.type==="remember"?"Guardar recuerdo «"+p.key+"»: "+p.value:
  "Modificar "+p.date+": "+Object.entries(p.changes||{}).map(([k,v])=>k+" = "+String(v)).join(", ");
 $("mj-ai-confirm").classList.add("visible");
}
async function send(q){
 if(busy)return;
 if(!user){status("Primero entra en Mi nube.");return;}
 clearProposal();display("user",q);busy=true;$("mj-ai-send").disabled=true;status("Pensando…");
 try{
  const out=await call({op:"chat",conversationId:id,message:q,snapshot:dataContext()});
  id=out.conversationId;display("assistant",out.reply||"No tengo respuesta.");speak(out.reply||"");
  if(out.proposal)propose(out.proposal);await refresh(id);
 }catch(e){display("assistant",friendly(e));}
 finally{busy=false;$("mj-ai-send").disabled=false;status("");}
}
$("mj-ai-form").onsubmit=e=>{e.preventDefault();const q=$("mj-ai-input").value.trim();if(!q)return;$("mj-ai-input").value="";send(q);};
$("mj-ai-yes").onclick=async()=>{
 if(!pending)return;const p=pending;try{
  if(p.type==="update_day"){
   if(JSON.stringify(bridge.get(p.date))!==before){display("assistant","La jornada cambió desde la propuesta. No he sobrescrito ningún dato.");return;}
   bridge.update(p.date,{...bridge.get(p.date),...p.changes});
   display("assistant","Jornada actualizada en el dispositivo. Mi nube sincronizará el cambio.");
  }else if(p.type==="remember"){
   await call({op:"memory_set",key:p.key,value:p.value});display("assistant","Recuerdo guardado en la memoria.");
  }
 }catch(e){display("assistant","No se ha guardado: "+friendly(e));}
 finally{clearProposal();}
};
$("mj-ai-no").onclick=()=>{clearProposal();display("assistant","Cambio cancelado.");};
$("mj-ai-new").onclick=()=>{id=null;$("mj-ai-chats").value="";reset();welcome();};
$("mj-ai-chats").onchange=e=>load(e.target.value);
$("mj-ai-delete").onclick=async()=>{
 if(!id||!confirm("¿Eliminar esta conversación de la nube?"))return;
 try{await call({op:"delete",conversationId:id});id=null;reset();welcome();await refresh();status("Conversación eliminada.");}
 catch(e){status(friendly(e));}
};
async function memoryView(){
 $("mj-ai-memory-view").classList.add("open");$("mj-ai-memory-list").replaceChildren();
 try{
  const response=await call({op:"memory"}),items=response.items||{};
  for(const [key,value] of Object.entries(items)){
   const row=document.createElement("div");row.className="memory-row";
   const label=document.createElement("strong");label.textContent=key;label.style.gridColumn="1/-1";
   const input=document.createElement("input");input.value=value;input.maxLength=300;
   const actions=document.createElement("div");
   const save=document.createElement("button");save.textContent="Guardar";
   save.onclick=async()=>{try{await call({op:"memory_set",key,value:input.value});status("Recuerdo modificado.");}catch(e){status(friendly(e));}};
   const remove=document.createElement("button");remove.textContent="Borrar";
   remove.onclick=async()=>{if(!confirm("¿Olvidar «"+key+"»?"))return;try{await call({op:"memory_delete",key});row.remove();status("Recuerdo eliminado.");}catch(e){status(friendly(e));}};
   actions.append(save,remove);row.append(label,input,actions);$("mj-ai-memory-list").append(row);
  }
  if(!Object.keys(items).length){const p=document.createElement("p");p.textContent="No hay recuerdos guardados."; $("mj-ai-memory-list").append(p);}
 }catch(e){status(friendly(e));}
}
$("mj-ai-memory-open").onclick=memoryView;
$("mj-ai-memory-close").onclick=()=>$("mj-ai-memory-view").classList.remove("open");
$("mj-ai-memory-add").onclick=async()=>{
 const key=$("mj-ai-memory-key").value.trim(),value=$("mj-ai-memory-value").value.trim();
 if(!key||!value){status("Escribe un nombre y un valor.");return;}
 try{await call({op:"memory_set",key,value});$("mj-ai-memory-key").value="";$("mj-ai-memory-value").value="";await memoryView();status("Recuerdo guardado.");}catch(e){status(friendly(e));}
};
$("mj-ai-voice").checked=voice;
$("mj-ai-voice").onchange=e=>{voice=e.target.checked;localStorage.setItem(voiceKey,voice?"on":"off");if(!voice&&window.speechSynthesis)window.speechSynthesis.cancel();};
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SpeechRecognition){
 const rec=new SpeechRecognition();rec.lang="es-ES";rec.interimResults=false;
 $("mj-ai-mic").onclick=()=>{try{rec.start();status("Te escucho…");}catch(e){status("No se pudo activar el micrófono.");}};
 rec.onresult=e=>{$("mj-ai-input").value=e.results[0][0].transcript;$("mj-ai-form").requestSubmit();};
 rec.onerror=()=>status("No se ha reconocido la voz. Puedes escribir.");
}else{$("mj-ai-mic").disabled=true;$("mj-ai-mic").title="Dictado no admitido por este navegador";}
function open(){panel.classList.add("open");$("mj-ai-input").focus();}
function close(){panel.classList.remove("open");if(window.speechSynthesis)window.speechSynthesis.cancel();}
$("mj-ai-close").onclick=close;
$("mj-ai-full").onclick=()=>panel.classList.toggle("full");
window.addEventListener("mi-jornada:open-tool",e=>{if(e.detail?.page==="ai")open();});
onAuthStateChanged(auth,async p=>{user=p;id=null;reset();welcome();if(p){status("Cuenta conectada.");await refresh();}else status("Inicia sesión en Mi nube.");});
try{const p=JSON.parse(localStorage.getItem(posKey)||"null");if(p){
 bubble.style.left=Math.max(0,Math.min(innerWidth-60,Number(p.x)||0))+"px";
 bubble.style.top=Math.max(0,Math.min(innerHeight-60,Number(p.y)||0))+"px";
 bubble.style.right="auto";bubble.style.bottom="auto";
}}catch(e){}
let drag=null,moved=false;
bubble.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY,left:bubble.getBoundingClientRect().left,top:bubble.getBoundingClientRect().top};moved=false;bubble.setPointerCapture(e.pointerId);});
bubble.addEventListener("pointermove",e=>{
 if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.abs(dx)+Math.abs(dy)>9)moved=true;if(!moved)return;
 bubble.style.left=Math.max(0,Math.min(innerWidth-60,drag.left+dx))+"px";
 bubble.style.top=Math.max(0,Math.min(innerHeight-60,drag.top+dy))+"px";
 bubble.style.right="auto";bubble.style.bottom="auto";
});
bubble.addEventListener("pointerup",()=>{drag=null;if(moved)localStorage.setItem(posKey,JSON.stringify({x:parseInt(bubble.style.left,10),y:parseInt(bubble.style.top,10)}));});
bubble.addEventListener("click",()=>{if(moved){moved=false;return;}panel.classList.contains("open")?close():open();});
