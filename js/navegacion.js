"use strict";
async function view(id) {
  if (
    [
      "perfil",
      "panel",
      "publicar",
      "chat",
      "detalle",
      "recuperacion",
      "eleccion",
      "bandeja",
    ].includes(id) &&
    !user
  ) {
    notice("Inicia sesión o regístrate para continuar.");
    id = "acceso";
  }
  if (id === "bandeja" && activeView !== "bandeja") inboxPeer = null;
  activeView = id;
  clearInterval(chatTimer);
  chatTimer = null;
  document
    .querySelectorAll(".view")
    .forEach((el) => (el.hidden = el.id !== id));
  if (id === "perfil") await loadProfile();
  if (id === "panel") await loadPanel();
  if (id === "bandeja") await refreshInbox();
  if (id === "explorar" && db) await search();
  if (id === "chat") {
    $("#mensajes").textContent = "Cargando conversación…";
    await loadMessages();
    chatTimer = setInterval(() => {
      if (!document.hidden) run(loadMessages);
    }, 5000);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document
  .querySelectorAll("[data-view]")
  .forEach((b) =>
    b.addEventListener("click", () => run(() => view(b.dataset.view), b)),
  );
function syncUser() {
  document.querySelectorAll(".private").forEach((el) => (el.hidden = !user));
  $("#salir").hidden = !user;
  $("#entrar").hidden = !!user;
  if (!user) {
    mode = "trabajadores";
    $("#modoEtiqueta").textContent = "SERVICIOS Y TRABAJO EN TU DISTRITO";
    $("#explorarTitulo").textContent = "¿Necesitas ayuda o buscas una chamba?";
    $("#explorarDescripcion").textContent =
      "Conectamos a quienes necesitan un trabajo con las personas que saben hacerlo.";
    $("#accionesModo").hidden = true;
    $("#verTrabajadores").classList.add("primary");
    $("#verTrabajos").classList.remove("primary");
  }
  if (sessionOwner !== (user?.id || null)) {
    clearInterval(inboxTimer);
    inboxRows = [];
    sessionOwner = user?.id || null;
    $("#badgeMensajes").hidden = true;
    $("#listaConversaciones").replaceChildren();
    $("#mensajes").replaceChildren();
    $("#misPublicaciones").replaceChildren();
    $("#misPostulaciones").replaceChildren();
    if (user) {
      setTimeout(() => refreshInbox().catch(() => {}), 0);
      inboxTimer = setInterval(() => {
        if (!document.hidden) refreshInbox().catch(() => {});
      }, 5000);
    }
  }
}
