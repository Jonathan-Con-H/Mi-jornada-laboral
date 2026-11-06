"use strict";
/**
 * Mi Jornada - API privada para el asistente.
 * Las jornadas NO se modifican desde el servidor; los cambios propuestos
 * requieren confirmacion en el navegador. Solo el propietario usa la IA.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const MJ_OWNER_UID = defineSecret("MJ_OWNER_UID");
const db = getFirestore();
const OWNER_ONLY = {
  region: "europe-southwest1",
  secrets: [OPENAI_API_KEY, MJ_OWNER_UID],
  cors: ["https://jonathan-con-h.github.io"],
  maxInstances: 2,
  timeoutSeconds: 90,
  memory: "256MiB",
};
const nullableString = { anyOf: [{type:"string"}, {type:"null"}] };
const nullableNumber = { anyOf: [{type:"number"}, {type:"null"}] };
const CHANGES = {
  type:"object", additionalProperties:false,
  properties: {
    kind:nullableString, shift:nullableString, start:nullableString,
    end:nullableString, breakMins:nullableNumber, owed:nullableNumber,
    extraMins:nullableNumber, notes:nullableString
  },
  required:["kind","shift","start","end","breakMins","owed","extraMins","notes"]
};
const FORMAT = {
  type:"json_schema", name:"jornada_assistant", strict:true,
  schema:{type:"object",additionalProperties:false,properties:{
    reply:{type:"string"},
    action:{type:"string",enum:["none","update_day","remember"]},
    date:{type:"string"},
    changes:CHANGES,
    memory:{type:"object",additionalProperties:false,properties:{
      key:{type:"string"}, value:{type:"string"}
    },required:["key","value"]}
  },required:["reply","action","date","changes","memory"]}
};
function str(v,max=4000){return typeof v==="string"?v.trim().slice(0,max):"";}
function guard(request){
  if(!request.auth)throw new HttpsError("unauthenticated","Inicia sesión en Mi nube.");
  const allowed = MJ_OWNER_UID.value();
  if(!allowed || request.auth.uid!==allowed)
    throw new HttpsError("permission-denied","Esta IA está reservada a la cuenta propietaria.");
  return request.auth.uid;
}
function chatRef(uid,id){
  if(typeof id!=="string" || !/^[A-Za-z0-9_-]{8,60}$/.test(id))
    throw new HttpsError("invalid-argument","Conversación no válida.");
  return db.collection("users").doc(uid).collection("assistantChats").doc(id);
}
function memoryRef(uid){return db.collection("users").doc(uid).collection("assistant").doc("memory");}
async function limit(uid){
  const ref=db.collection("users").doc(uid).collection("assistant").doc("rate");
  const now=Date.now(),today=new Date(now).toISOString().slice(0,10);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),v=snap.exists?snap.data():{},count=v.day===today?Number(v.count)||0:0;
    if(count>=120)throw new HttpsError("resource-exhausted","Has alcanzado el límite diario de 120 mensajes.");
    if(now-(Number(v.last)||0)<1300)throw new HttpsError("resource-exhausted","Espera un momento antes de enviar otro mensaje.");
    tx.set(ref,{day:today,count:count+1,last:now});
  });
}
function validateChanges(changes){
  if(!changes || typeof changes!=="object")return null;
  const out={};
  if(changes.kind!==null){if(!["work","rest"].includes(changes.kind))return null;out.kind=changes.kind;}
  if(changes.shift!==null){if(!["morning","afternoon"].includes(changes.shift))return null;out.shift=changes.shift;}
  for(const field of ["start","end"]){
    const v=changes[field];
    if(v!==null){if(typeof v!=="string" || !/^\d{2}:\d{2}$/.test(v))return null;
      const [h,m]=v.split(":").map(Number);if(h>23||m>59)return null;out[field]=v;}
  }
  for(const [field,max] of [["breakMins",600],["owed",24],["extraMins",720]]){
    const v=changes[field];
    if(v!==null){if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>max)return null;out[field]=v;}
  }
  if(changes.notes!==null){
    if(typeof changes.notes!=="string"||changes.notes.length>1500)return null;
    out.notes=changes.notes;
  }
  return Object.keys(out).length?out:null;
}
async function respond(uid,body){
  const message=str(body.message,2000);
  if(!message)throw new HttpsError("invalid-argument","Escribe un mensaje.");
  await limit(uid);
  let ref=body.conversationId?chatRef(uid,body.conversationId):db.collection("users").doc(uid).collection("assistantChats").doc();
  const existing=await ref.get();
  if(body.conversationId&&!existing.exists)
    throw new HttpsError("not-found","No encuentro esta conversación.");
  const messages=existing.exists && Array.isArray(existing.data().messages)?existing.data().messages.slice(-40):[];
  const memSnap=await memoryRef(uid).get();
  const memory=memSnap.exists && memSnap.data().items && typeof memSnap.data().items==="object"?memSnap.data().items:{};
  const snapshot=body.snapshot && typeof body.snapshot==="object"?JSON.stringify(body.snapshot):"{}";
  if(snapshot.length>115000)throw new HttpsError("invalid-argument","Hay demasiados datos para esta consulta.");
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const instructions=[
    "Eres el asistente personal de Mi Jornada. Responde en español natural y de manera concreta.",
    "Fecha actual en España: "+today+". Interpreta fechas relativas con ese dato.",
    "Datos de calendario: desde el 19/10/2026 la rotación es 3 semanas de mañana y una de tarde,",
    "con turnos 06:00-14:00 o 14:00-22:00, de lunes a viernes; descanso 30 min.",
    "No inventes jornadas registradas ni acciones realizadas. Calcula solo a partir de los datos disponibles.",
    "Puedes conversar con naturalidad sobre cualquier tema, pero las funciones laborales son prioritarias.",
    "Si piden MODIFICAR una jornada, usa action=update_day, date=AAAA-MM-DD, changes con solo",
    "los campos a cambiar y null en el resto. Para añadir horas extra calcula el valor TOTAL",
    "extraMins existente + nuevo incremento; si no conoces el actual, pregunta antes.",
    "owed está en HORAS (0.5 significa 30 minutos); extraMins y breakMins están en MINUTOS.",
    "Un cambio es una PROPUESTA, nunca se guarda hasta confirmación explícita del usuario.",
    "No propongas una edición si no hay fecha clara o datos suficientes.",
    "Las vacaciones, bajas, permisos, papelera, alarmas y gestión de nóminas NO están",
    "implementadas en la aplicación actual; no prometas guardarlas.",
    "Si el usuario pide recordar explícitamente un dato, propone action=remember,",
    "memory.key y memory.value. Las memorias solo se guardan al confirmarlas.",
    "Nunca incluyas contraseñas, tokens o claves en la memoria.",
    "Si no hay acción, usa action=none, date vacía, changes todos null, memory key/value vacíos.",
    "Datos de usuario que se comparten para ESTA consulta: "+snapshot.slice(0,112000),
    "Memoria controlada por el usuario: "+JSON.stringify(memory).slice(0,9000)
  ].join("\n");
  const input=messages.filter(m=>m&&["user","assistant"].includes(m.role))
    .slice(-20).map(m=>({role:m.role,content:str(m.text,3000)}));
  input.push({role:"user",content:message});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),75000);
  let api;
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+OPENAI_API_KEY.value()},
      body:JSON.stringify({
        model:"gpt-6-luna",instructions,input,
        reasoning:{effort:"low"},store:false,max_output_tokens:1600,
        text:{format:FORMAT}
      }),
      signal:controller.signal
    });
    if(!response.ok){
      const error=await response.text();
      console.error("Error del proveedor",response.status,error.slice(0,350));
      throw new HttpsError("unavailable","La IA no ha podido responder. Revisa la configuración del servicio.");
    }
    api=await response.json();
  }catch(e){
    if(e instanceof HttpsError)throw e;
    console.error("Fallo de IA",String(e));
    throw new HttpsError("unavailable","No se pudo contactar con la IA.");
  }finally{clearTimeout(timer);}
  const output=(api.output||[]).flatMap(item=>item.type==="message"?(item.content||[]):[])
    .find(part=>part.type==="output_text");
  let result;
  try{result=JSON.parse(output?.text||"");}catch(e){
    throw new HttpsError("internal","Respuesta de IA no válida. Prueba otra vez.");
  }
  const reply=str(result.reply,4000)||"No he podido responder. Prueba de nuevo.";
  let proposal=null;
  if(result.action==="update_day"&&/^\d{4}-\d{2}-\d{2}$/.test(result.date||"")){
    const changes=validateChanges(result.changes);
    if(changes)proposal={type:"update_day",date:result.date,changes};
  }else if(result.action==="remember"){
    const key=str(result.memory?.key,70),value=str(result.memory?.value,300);
    if(key && value)proposal={type:"remember",key,value};
  }
  const saved=[...messages,{role:"user",text:message,time:new Date().toISOString()},
    {role:"assistant",text:reply,time:new Date().toISOString()}].slice(-60);
  await ref.set({
    title:existing.exists?str(existing.data().title,100):message.slice(0,70),
    messages:saved,updatedAt:new Date(),createdAt:existing.exists?existing.data().createdAt:new Date()
  });
  return {conversationId:ref.id,reply,proposal};
}
exports.miJornadaAI=onCall(OWNER_ONLY,async request=>{
  const uid=guard(request),body=request.data||{},op=str(body.op,30);
  if(op==="chat")return await respond(uid,body);
  if(op==="list"){
    const snap=await db.collection("users").doc(uid).collection("assistantChats")
      .orderBy("updatedAt","desc").limit(30).get();
    return {conversations:snap.docs.map(d=>({id:d.id,title:str(d.data().title,100),
      updatedAt:d.data().updatedAt?.toDate?.().toISOString()||null}))};
  }
  if(op==="load"){
    const s=await chatRef(uid,body.conversationId).get();
    if(!s.exists)throw new HttpsError("not-found","Conversación no encontrada.");
    return {conversationId:s.id,messages:(s.data().messages||[]).slice(-60)};
  }
  if(op==="delete"){
    await chatRef(uid,body.conversationId).delete();
    return {deleted:true};
  }
  if(op==="memory"){
    const s=await memoryRef(uid).get();
    return {items:s.exists?s.data().items||{}:{}};
  }
  if(op==="memory_set"||op==="memory_delete"){
    const key=str(body.key,70);
    if(!key||!(/^[^/]{1,70}$/.test(key)))throw new HttpsError("invalid-argument","Nombre de memoria no válido.");
    const ref=memoryRef(uid);
    await db.runTransaction(async tx=>{
      const doc=await tx.get(ref),items=doc.exists?{...(doc.data().items||{})}:{};
      if(op==="memory_set"){
        const value=str(body.value,300);
        if(!value)throw new HttpsError("invalid-argument","El recuerdo no puede estar vacío.");
        if(Object.keys(items).length>=40 && !(key in items))
          throw new HttpsError("resource-exhausted","Límite de 40 recuerdos.");
        items[key]=value;
      }else delete items[key];
      tx.set(ref,{items,updatedAt:new Date()});
    });
    return {saved:true};
  }
  throw new HttpsError("invalid-argument","Operación no reconocida.");
});
