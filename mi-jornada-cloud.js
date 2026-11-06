import {initializeApp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {getFirestore,doc,getDocFromServer,runTransaction,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import config from "./firebase-web-config.js";

// Cada cuenta solo accede a /users/{uid}/backups/primary. Nunca sobreescribir sin comparar.
const bridge=window.miJornadaBridge, app=initializeApp(config), auth=getAuth(app), db=getFirestore(app);
let user=null, remote=null, ready=false, writing=false, pending=null;
const el=id=>document.getElementById(id);
const style=document.createElement("style");
style.textContent="#mj-cloud-shade{position:fixed;inset:0;background:#000b;display:none;place-items:center;padding:16px;z-index:170}#mj-cloud-shade.open{display:grid}#mj-cloud-box{background:#0c2033;color:#f5f9ff;border:1px solid #32658b;border-radius:20px;width:min(520px,100%);max-height:92vh;overflow:auto;padding:20px;box-shadow:0 16px 60px #0009;font-family:system-ui}#mj-cloud-box h2{margin:0;font-size:1.4rem}#mj-cloud-box p{color:#c8dce9;line-height:1.5}#mj-cloud-box label{display:block;margin:12px 0}#mj-cloud-box input{display:block;background:#061a2c;color:#fff;padding:11px;border:1px solid #4b7894;border-radius:10px;width:100%;margin-top:5px;font:inherit}#mj-cloud-box button{background:#1578bc;color:#fff;border:0;border-radius:10px;padding:11px 13px;margin:5px;cursor:pointer}#mj-cloud-box button.secondary{background:#234258}#mj-cloud-box .top{display:flex;align-items:center;justify-content:space-between}#mj-cloud-box section[hidden],#mj-cloud-box form[hidden]{display:none}#mj-cloud-status{margin:13px 0;white-space:pre-wrap}";
document.head.appendChild(style);
const layer=document.createElement("div");
layer.id="mj-cloud-shade";
layer.innerHTML=[
"<div id='mj-cloud-box' role='dialog' aria-modal='true' aria-label='Mi nube'>",
"<div class='top'><h2>☁️ Mi nube</h2><button type='button' class='secondary' id='mj-cloud-close'>Cerrar</button></div>",
"<p>Protege tus registros en tu cuenta de Firebase y recupéralos desde otro dispositivo.</p>",
"<p id='mj-cloud-status' role='status'></p>",
"<form id='mj-cloud-login'><label>Correo electrónico<input id='mj-cloud-email' type='email' required autocomplete='email'></label>",
"<label>Contraseña<input id='mj-cloud-pass' type='password' minlength='6' required autocomplete='current-password'></label>",
"<button type='submit'>Iniciar sesión</button><button type='button' id='mj-cloud-create' class='secondary'>Crear cuenta</button></form>",
"<section id='mj-cloud-account' hidden><p id='mj-cloud-who'></p><button type='button' id='mj-cloud-refresh'>Comprobar nube</button><button type='button' id='mj-cloud-logout' class='secondary'>Salir</button></section>",
"<section id='mj-cloud-choose' hidden><p id='mj-cloud-choose-text'></p>",
"<button type='button' id='mj-cloud-upload'>Conservar este dispositivo y subirlo</button>",
"<button type='button' id='mj-cloud-download' class='secondary'>Recuperar copia de la nube</button></section>",
"<p style='font-size:.82rem'>Los datos de este dispositivo no se borrarán al entrar. Si ambas copias difieren, podrás decidir cuál conservar. Puedes exportar una copia JSON antes.</p></div>"
].join("");
document.body.appendChild(layer);
const status=s=>{el("mj-cloud-status").textContent=s;};
const lastKey=uid=>"miJornada.cloud.last.v1."+uid;
function local(){return JSON.stringify(bridge.read());}
function parse(p){const o=JSON.parse(p);if(!o||o.app!=="Mi Jornada"||!o.data||typeof o.data!=="object"||Array.isArray(o.data)||!o.automatico||typeof o.automatico.enabled!=="boolean"||!o.automatico.since)throw Error("Copia no válida");return o;}
function choice(message){ready=false;el("mj-cloud-choose").hidden=false;el("mj-cloud-download").hidden=remote===null;el("mj-cloud-choose-text").textContent=message;status("Elige la copia que deseas conservar.");}
function synced(message){ready=true;el("mj-cloud-choose").hidden=true;status(message);const label=document.querySelector(".mj-sidebar-foot span");if(label)label.textContent="Nube conectada · datos locales y online";}
function remember(payload){if(user)localStorage.setItem(lastKey(user.uid),payload);}
function restore(payload){bridge.restore(parse(payload));remember(payload);remote=payload;synced("Copia recuperada. Tus jornadas ya aparecen en este dispositivo.");}
async function check(){
 if(!user)return;
 const uid=user.uid;ready=false;el("mj-cloud-choose").hidden=true;status("Buscando datos en Firebase...");
 try{
  const ref=doc(db,"users",uid,"backups","primary");
  const snap=await getDocFromServer(ref);
  if(!user||user.uid!==uid)return;
  const p=snap.exists()?snap.data().payload:null;
  if(p!==null && typeof p!=="string")throw Error("Copia no válida");
  if(p!==null)parse(p);
  remote=p;
  const here=local(),last=localStorage.getItem(lastKey(uid));
  if(p===here){remember(here);synced("Tus jornadas están sincronizadas.");}
  else if(last===here&&p!==null){restore(p);}
  else if(last&&last===p){synced("Subiendo cambios realizados en este dispositivo...");schedule();}
  else if(p===null)choice("Tu cuenta está vacía. Puedes subir los registros que tienes en este dispositivo.");
  else choice("Hay registros distintos en este dispositivo y en la nube. Exporta una copia JSON si quieres conservar una versión adicional.");
 }catch(e){ready=false;status("No se pudo leer Firestore: "+(e.code||e.message||e)+". Revisa la base de datos y sus reglas de seguridad.");}
}
async function save(force){
 if((!ready&&!force)||!user||writing)return;
 writing=true;clearTimeout(pending);const payload=local(),uid=user.uid,expected=remote;
 if(payload.length>900000){writing=false;status("La copia supera el tamaño permitido. Exporta una copia JSON.");return;}
 status("Guardando en Firebase...");
 try {
  await runTransaction(db,async tx=>{
   const ref=doc(db,"users",uid,"backups","primary"),s=await tx.get(ref);
   const actual=s.exists()?s.data().payload:null;
   if(actual!==expected)throw Error("Otra sesión cambió la copia. Revisa antes de reemplazarla.");
   tx.set(ref,{payload:payload,updatedAt:serverTimestamp(),schemaVersion:3});
  });
  if(!user||user.uid!==uid)return;
  remote=payload;remember(payload);synced("Guardado en la nube correctamente.");
  if(local()!==payload)schedule();
 }catch(e){ready=false;status("No se ha sobrescrito la nube. "+(e.code||e.message||e)+". Pulsa «Comprobar nube» para revisar.");}
 finally{writing=false;}
}
function schedule(){if(!ready||!user)return;clearTimeout(pending);pending=setTimeout(()=>save(false),1200);}
window.addEventListener("mi-jornada:data-changed",schedule);
window.addEventListener("mi-jornada:open-tool",e=>{if(e.detail&&e.detail.page==="cloud")layer.classList.add("open");});
el("mj-cloud-close").onclick=()=>layer.classList.remove("open");
layer.onclick=e=>{if(e.target===layer)layer.classList.remove("open");};
el("mj-cloud-login").onsubmit=async e=>{e.preventDefault();status("Iniciando sesión...");try{await signInWithEmailAndPassword(auth,el("mj-cloud-email").value.trim(),el("mj-cloud-pass").value);}catch(err){status("No se pudo entrar: "+(err.code||err.message));}};
el("mj-cloud-create").onclick=async()=>{if(!el("mj-cloud-email").validity.valid||el("mj-cloud-pass").value.length<6){status("Introduce un correo válido y contraseña de al menos 6 caracteres.");return;}if(!confirm("¿Crear una cuenta con este correo?"))return;status("Creando cuenta...");try{await createUserWithEmailAndPassword(auth,el("mj-cloud-email").value.trim(),el("mj-cloud-pass").value);}catch(err){status("No se pudo crear: "+(err.code||err.message));}};
el("mj-cloud-logout").onclick=async()=>{clearTimeout(pending);await signOut(auth);};
el("mj-cloud-refresh").onclick=check;
el("mj-cloud-upload").onclick=()=>{if(remote!==null&&!confirm("Esto sustituye la copia de la nube. ¿Lo confirmas?"))return;ready=true;save(true);};
el("mj-cloud-download").onclick=()=>{if(remote===null||!confirm("Esto reemplazará la copia de este dispositivo por la de la nube. ¿Lo confirmas?"))return;try{restore(remote);}catch(e){status("No se pudo recuperar. Tus datos locales siguen aquí.");}};
onAuthStateChanged(auth,person=>{
 clearTimeout(pending);user=person;remote=null;ready=false;writing=false;
 el("mj-cloud-login").hidden=!!person;el("mj-cloud-account").hidden=!person;el("mj-cloud-choose").hidden=true;
 if(person){el("mj-cloud-pass").value="";el("mj-cloud-who").textContent="Cuenta: "+(person.email||"conectada");check();}
 else{status("Inicia sesión para usar tu nube. Todo permanece guardado en este dispositivo.");const label=document.querySelector(".mj-sidebar-foot span");if(label)label.textContent="Datos guardados en este dispositivo";}
});
