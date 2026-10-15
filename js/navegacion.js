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
      "notificaciones",
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
  if (id === "notificaciones") await refreshNotifications();
  if (id === "panel") { await loadPanel(); await loadAgenda(); }
  if (id === "bandeja") await refreshInbox();
  if (id === "explorar" && db) await search();
  if (id === "chat") {
    $("#mensajes").textContent = "Cargando conversación…";
    await loadMessages();
    chatTimer = setInterval(() => {
      if (!document.hidden) run(loadMessages);
    }, 5000);
  }
  document.querySelectorAll(".mobile-nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === id && !button.dataset.scrollTarget);
    if (button.dataset.view !== id) button.removeAttribute("aria-current");
    else if (!button.dataset.scrollTarget) button.setAttribute("aria-current", "page");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document
  .querySelectorAll("[data-view]")
  .forEach((b) =>
    b.addEventListener("click", () => run(async () => {
      await view(b.dataset.view);
      if (b.dataset.scrollTarget) {
        document.querySelectorAll(".mobile-nav-item").forEach(item => {
          item.classList.toggle("active", item === b);
          item.removeAttribute("aria-current");
        });
        b.setAttribute("aria-current", "page");
        document.getElementById(b.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, b)),
  );
function syncUser() {
  document.body.classList.toggle("signed-in", !!user);
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
    stopNotifications();
    inboxRows = [];
    sessionOwner = user?.id || null;
    $("#badgeMensajes").hidden = true;
    $("#badgeMensajesMovil").hidden = true;
    $("#listaConversaciones").replaceChildren();
    $("#mensajes").replaceChildren();
    $("#misPublicaciones").replaceChildren();
    $("#misPostulaciones").replaceChildren();
    if (user) {
      setTimeout(() => refreshInbox().catch(() => {}), 0);
      startNotifications();
      inboxTimer = setInterval(() => {
        if (!document.hidden) refreshInbox().catch(() => {});
      }, 5000);
    }
  }
}
