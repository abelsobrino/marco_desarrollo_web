"use strict";
async function loadMessages() {
  requireUser();

  if (messagesPending || !conversation) {
    return;
  }

  messagesPending = true;

  const id = conversation;
  const owner = user.id;

  try {
    const pageSize = 500;
    let from = 0;
    let rows = [];

    while (true) {
      const batch = await checked(
        db
          .from("mensajes")
          .select("*,perfiles!mensajes_autor_id_fkey(nombre)")
          .eq("postulacion_id", id)
          .order("creado_en", {
            ascending: true,
          })
          .order("id", {
            ascending: true,
          })
          .range(from, from + pageSize - 1),
      );

      rows.push(...batch);

      if (batch.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    if (id !== conversation || owner !== user?.id || activeView !== "chat") {
      return;
    }

    const box = $("#mensajes");

    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 70;

    box.innerHTML =
      rows
        .map(
          (m) => `
            <div class="message ${m.autor_id === owner ? "mine" : ""}">

              <strong>
                ${esc(m.perfiles?.nombre || "Usuario")}
              </strong>

              <p>
                ${esc(m.contenido)}
              </p>

              <small>
                ${esc(new Date(m.creado_en).toLocaleString("es-PE"))}
              </small>

            </div>
          `,
        )
        .join("") ||
      `
        <p>
          Aún no hay mensajes.
          Saluda y coordina los detalles del trabajo.
        </p>
      `;

    if (nearBottom) {
      box.scrollTop = box.scrollHeight;
    }

    const pending = rows
      .filter((m) => m.autor_id !== owner && !m.leido_en)
      .map((m) => m.id);

    if (pending.length && !document.hidden) {
      await checked(
        db.rpc("marcar_mensajes_leidos", {
          p_ids: pending,
        }),
      );

      await refreshInbox();
    }
  } finally {
    messagesPending = false;
  }
}
onSubmit("#mensajeForm", async (f, form) => {
  requireUser();
  await checked(
    db.from("mensajes").insert({
      postulacion_id: conversation,
      autor_id: user.id,
      contenido: f.get("contenido").trim(),
    }),
  );
  form.reset();
  await loadMessages();
  await refreshInbox();
  $("#mensajes").scrollTop = $("#mensajes").scrollHeight;
});
async function refreshInbox() {
  if (!user || !db || inboxPending) return;
  inboxPending = true;
  const owner = user.id;
  try {
    const rows = await checked(db.rpc("bandeja_mensajes"));
    if (owner !== user?.id) return;
    inboxRows = rows || [];
    const count = inboxRows.reduce((sum, r) => sum + Number(r.no_leidos), 0);
    const badge = $("#badgeMensajes");
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
    $("#btnMensajes").setAttribute(
      "aria-label",
      count ? `Mensajes, ${count} sin leer` : "Mensajes",
    );
    $("#btnMensajes").title = count ? `${count} mensajes sin leer` : "Mensajes";
    $("#estadoBandeja").textContent = "";
    if (activeView === "bandeja") renderInbox();
  } catch (e) {
    if (owner === user?.id) {
      $("#estadoBandeja").textContent =
        "No se pudo cargar la bandeja. Reintenta. Si acabas de actualizar, ejecuta database/02_bandeja_mensajes.sql en Supabase.";
      $("#btnMensajes").title = "Bandeja no disponible";
    }
    throw e;
  } finally {
    inboxPending = false;
  }
}
function renderInbox() {
  const groups = new Map();
  for (const row of inboxRows) {
    if (!groups.has(row.persona_id)) groups.set(row.persona_id, []);
    groups.get(row.persona_id).push(row);
  }
  const threads = inboxPeer ? groups.get(inboxPeer) || [] : null;
  const rows =
    threads ||
    [...groups.values()].map((group) => ({
      ...group[0],
      no_leidos: group.reduce((n, r) => n + Number(r.no_leidos), 0),
      thread_count: group.length,
    }));
  $("#listaConversaciones").innerHTML =
    (threads
      ? '<button id="volverPersonas" class="text-button">← Todas las personas</button>'
      : "") +
    rows
      .map(
        (r) =>
          `<button class="conversation-row" data-peer="${esc(r.persona_id)}" data-conversation="${esc(r.conversacion_id)}"><span class="person-initial" aria-hidden="true">${esc(r.nombre.slice(0, 1).toUpperCase())}</span><span class="conversation-text"><strong>${esc(r.nombre)}</strong><small>${r.thread_count > 1 ? `${r.thread_count} trabajos · Selecciona una conversación` : esc(r.titulo)}</small><span>${esc(r.ultimo_mensaje)}</span></span><span class="conversation-meta"><small>${esc(new Date(r.ultima_fecha).toLocaleDateString("es-PE"))}</small>${Number(r.no_leidos) ? `<span class="unread-count">${Number(r.no_leidos)}</span>` : ""}</span></button>`,
      )
      .join("");
  if (!rows.length)
    $("#listaConversaciones").innerHTML =
      '<article class="empty-inbox"><h2>Todavía no tienes conversaciones</h2><p>Al enviar una propuesta o recibir una para tu publicación, la persona aparecerá aquí. Abre su conversación para coordinar.</p></article>';
  if ($("#volverPersonas"))
    $("#volverPersonas").onclick = () => {
      inboxPeer = null;
      renderInbox();
    };
  $("#listaConversaciones")
    .querySelectorAll("[data-conversation]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          run(async () => {
            if (!inboxPeer && groups.get(b.dataset.peer).length > 1) {
              inboxPeer = b.dataset.peer;
              renderInbox();
            } else await openConversation(b.dataset.conversation);
          }, b)),
    );
}
async function openConversation(id) {
  requireUser();

  conversation = id;

  const thread = inboxRows.find((r) => r.conversacion_id === id);

  $("#chatNombre").textContent = thread?.nombre || "Conversación";

  $("#chatTrabajo").textContent =
    thread?.titulo || "Coordina aquí los detalles del trabajo.";

  await view("chat");
}
$("#actualizarBandeja").onclick = () =>
  run(refreshInbox, $("#actualizarBandeja"));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && user) {
    refreshInbox().catch(() => {});
    if (activeView === "chat") run(loadMessages);
  }
});
