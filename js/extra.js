"use strict";
let dniValidated = null, directInboxRows = [], notificationTimer = null, notificationChannel = null;
window.userCoords = null;
function distanciaAlDestino(distritoId) {
  const dest = distritoCoords(distritoId);
  const orig = window.userCoords || (profile?.distrito_id ? distritoCoords(profile.distrito_id) : null);
  return orig && dest ? distanciaKm(orig.lat, orig.lon, dest.lat, dest.lon) : null;
}
$("#verTerminos").onclick = () => $("#terminosDialog").showModal();
$("#cerrarTerminos").onclick = () => $("#terminosDialog").close();
$("#registroDni").addEventListener("input", () => {
  dniValidated = null; $("#registroNombre").value = "";
  $("#estadoDni").textContent = "Verifica el DNI antes de registrarte.";
});
$("#validarDni").onclick = () => run(async () => {
  requireDB();
  const dni = $("#registroDni").value.trim();
  if (!/^\d{8}$/.test(dni)) throw new Error("El DNI debe tener ocho números.");
  const {data, error} = await db.functions.invoke("registro-dni", {body:{accion:"validar",dni}});
  if (error || data?.error) throw new Error(data?.error || "No se pudo consultar el DNI.");
  if (!data?.ok || !data?.nombre) throw new Error("No se encontraron los nombres del DNI.");
  dniValidated = {dni, nombre:data.nombre};
  $("#registroNombre").value = data.nombre;
  $("#estadoDni").textContent = "✓ Datos encontrados. Completa tu fecha de nacimiento.";
}, $("#validarDni"));
function bindDirectButtons() {
  $("#resultados").querySelectorAll("[data-direct]").forEach(button => button.onclick = () => run(async () => {
    requireUser();
    const {data, error} = await db.rpc("iniciar_conversacion_directa", {p_destinatario:button.dataset.direct});
    if(error) throw error;
    await openConversation("direct:" + data);
  }, button));
}
async function refreshDirectInbox() {
  directInboxRows = await checked(db.from("conversaciones_directas")
    .select("id,cliente_id,trabajador_id,creado_en").or(`cliente_id.eq.${user.id},trabajador_id.eq.${user.id}`).order("creado_en",{ascending:false}));
  if(!directInboxRows.length) return;
  const ids = [...new Set(directInboxRows.map(r => r.cliente_id===user.id?r.trabajador_id:r.cliente_id))];
  const peers = await checked(db.from("perfiles").select("id,nombre").in("id",ids));
  directInboxRows.forEach(r=>r.nombre = peers.find(p=>p.id===(r.cliente_id===user.id?r.trabajador_id:r.cliente_id))?.nombre || "Usuario");
}
function appendDirectInbox(){
  const list = $("#listaConversaciones");
  if(!list) return;
  for (const r of directInboxRows) {
    const button = document.createElement("button"); button.className="conversation-row";
    button.innerHTML = `<span class="person-initial" aria-hidden="true"><i class="fa-solid fa-user"></i></span><span class="conversation-text"><strong>${esc(r.nombre)}</strong><small>Conversación directa</small><span>Ver mensajes y reservas</span></span><span class="conversation-meta"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>`;
    button.onclick = () => run(()=>openConversation("direct:"+r.id),button);
    list.append(button);
  }
}
async function loadDirectMessages(){
  const id = conversation.slice(7);
  const rows = await checked(db.from("mensajes_directos").select("id,autor_id,contenido,creado_en,leido_en").eq("conversacion_id",id).order("creado_en").limit(500));
  if(conversation !== "direct:"+id) return;
  $("#mensajes").innerHTML = rows.map(m=>`<div class="message ${m.autor_id===user.id?"mine":""}"><strong>${m.autor_id===user.id?"Tú":"Contacto"}</strong><p>${esc(m.contenido)}</p><small>${esc(new Date(m.creado_en).toLocaleString("es-PE"))}</small></div>`).join("") || "<p>Inicia la conversación para coordinar el servicio.</p>";
  const unread=rows.filter(m=>m.autor_id!==user.id&&!m.leido_en).map(m=>m.id);
  if(unread.length && !document.hidden) await checked(db.from("mensajes_directos").update({leido_en:new Date().toISOString()}).in("id",unread));
}
async function sendDirectMessage(f,form){
  const message = String(f.get("contenido")||"").trim();
  if(!message || message.length>2000) throw new Error("Mensaje inválido.");
  await checked(db.from("mensajes_directos").insert({conversacion_id:conversation.slice(7), autor_id:user.id,contenido:message}));
  form.reset(); await loadDirectMessages(); await refreshInbox();
}
async function refreshNotifications(){
  if(!user || !db) return;
  const rows = await checked(db.from("notificaciones").select("id,titulo,detalle,leida,creada_en").eq("usuario_id",user.id).order("creada_en",{ascending:false}).limit(60));
  const pending=rows.filter(r=>!r.leida).length;
  const badge=$("#badgeNotificaciones"); badge.textContent=pending>99?"99+":pending;badge.hidden=!pending;
  if(activeView==="notificaciones") $("#listaNotificaciones").innerHTML=rows.map(r=>`<article class="notification-item ${r.leida?"":"pending"}"><strong>${esc(r.titulo)}</strong><p>${esc(r.detalle)}</p><small>${esc(new Date(r.creada_en).toLocaleString("es-PE"))}</small>${r.leida?"":`<button data-notification="${esc(r.id)}">Marcar leída</button>`}</article>`).join("")||"<p>Sin notificaciones por ahora.</p>";
  $("#listaNotificaciones").querySelectorAll("[data-notification]").forEach(b=>b.onclick=()=>run(async()=>{
    await checked(db.from("notificaciones").update({leida:true}).eq("id",b.dataset.notification).eq("usuario_id",user.id));await refreshNotifications();
  },b));
}
$("#leerTodas").onclick=()=>run(async()=>{
  requireUser(); await checked(db.from("notificaciones").update({leida:true}).eq("usuario_id",user.id).eq("leida",false)); await refreshNotifications();
});
function stopNotifications(){clearInterval(notificationTimer); notificationTimer=null;if(notificationChannel&&db)db.removeChannel(notificationChannel);notificationChannel=null;$("#badgeNotificaciones").hidden=true;}
function startNotifications(){
  stopNotifications();
  refreshNotifications().catch(()=>{});
  notificationTimer=setInterval(()=>{if(!document.hidden)refreshNotifications().catch(()=>{});},10000);
  notificationChannel=db.channel("alertas-"+user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"notificaciones",filter:"usuario_id=eq."+user.id},payload=>{
    if(document.hidden || !user) return;
    notice(payload.new?.titulo||"Tienes una nueva notificación");
    refreshNotifications().catch(()=>{});
  }).subscribe();
}
async function directServiceActions(){
  if(!conversation?.startsWith('direct:'))return;
  const id=conversation.slice(7);
  const box=$('#chatTrabajo');
  if(!box)return;
  box.replaceChildren();
  box.append(document.createTextNode('Conversación directa · Acuerda los detalles antes de comenzar. '));
  const confirm=document.createElement('button');confirm.textContent='✓ Confirmar servicio realizado';
  confirm.onclick=()=>run(async()=>{await checked(db.rpc('confirmar_servicio_directo',{p_conversacion:id}));notice('Confirmación registrada. La otra parte también debe confirmar.');},confirm);
  const review=document.createElement('button');review.textContent='★ Calificar servicio';
  review.onclick=()=>openForm('Calificar un servicio terminado',
    '<label>Estrellas<select name="estrellas"><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></label><label>Tu experiencia<textarea name="opinion" required minlength="5" maxlength="1000"></textarea></label>',
    async f=>{await checked(db.rpc('calificar_servicio_directo',{p_conversacion:id,p_puntuacion:Number(f.get('estrellas')),p_comentario:String(f.get('opinion')).trim()}));notice('Calificación registrada.');});
  const reservar=document.createElement('button');reservar.textContent='📅 Proponer fecha y horario';
  reservar.onclick=()=>openForm('Proponer una reserva',
   '<label>Servicio<input name="titulo" required minlength="5" maxlength="120" placeholder="Ej. Reparación de tubería"></label><label>Fecha<input type="date" name="fecha" required></label><label>Desde<input type="time" name="inicio" required></label><label>Hasta<input type="time" name="fin" required></label><p class="muted">El trabajador deberá aceptar la propuesta. No se permiten horarios cruzados una vez confirmados.</p>',
   async f=>{await checked(db.rpc('proponer_reserva_directa',{p_conversacion:id,p_titulo:String(f.get('titulo')).trim(),p_fecha:f.get('fecha'),p_inicio:f.get('inicio'),p_fin:f.get('fin')}));notice('Propuesta enviada. Espera que el trabajador la confirme.');});
  box.append(reservar,confirm,review);
}
