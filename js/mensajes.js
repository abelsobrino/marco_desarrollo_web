"use strict";
async function loadMessages() {
  requireUser();

  if (messagesPending || !conversation) {
    return;
  }

  messagesPending = true;

  if (conversation.startsWith("direct:")) { try { await loadDirectMessages(); } finally { messagesPending = false; } return; }
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
  if (conversation?.startsWith("direct:")) { await sendDirectMessage(f, form); return; }
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
    const [jobsResult, directResult] = await Promise.allSettled([
      db.rpc("bandeja_mensajes"),
      refreshDirectInbox(),
    ]);
    if (owner !== user?.id) return;
    const jobs = jobsResult.status === "fulfilled" ? jobsResult.value : null;
    inboxRows = jobs && !jobs.error ? jobs.data || [] : [];
    if (directResult.status === "rejected") directInboxRows = [];
    const directCount = await db.from("mensajes_directos")
      .select("id", {count: "exact", head: true})
      .neq("autor_id", owner).is("leido_en", null);
    if (owner !== user?.id) return;
    const count = inboxRows.reduce((sum, r) => sum + Number(r.no_leidos), 0)
      + (!directCount.error ? Number(directCount.count || 0) : 0);
    const badge = $("#badgeMensajes");
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
    const mobileBadge = $("#badgeMensajesMovil");
    if (mobileBadge) { mobileBadge.textContent = badge.textContent; mobileBadge.hidden = count === 0; }
    $("#btnMensajes").setAttribute("aria-label", count ? `Mensajes, ${count} sin leer` : "Mensajes");
    $("#btnMensajes").title = count ? `${count} mensajes sin leer` : "Mensajes";
    $("#estadoBandeja").textContent = jobs?.error && !directInboxRows.length
      ? "Los chats de postulaciones aún no están disponibles. Comprueba la configuración de Supabase."
      : "";
    if (activeView === "bandeja") renderInbox();
  } catch (e) {
    if (owner === user?.id) $("#estadoBandeja").textContent = "No se pudieron actualizar todos los mensajes. Intenta de nuevo.";
    throw e;
  } finally {
    inboxPending = false;
  }
}

let inboxTipo = "directas";
function renderInbox() {
  const list = $("#listaConversaciones");
  const isDirect = inboxTipo === "directas";
  document.querySelectorAll("[data-inbox-tab]").forEach((button) => {
    const selected = button.dataset.inboxTab === inboxTipo;
    button.classList.toggle("btn-primary", selected);
    button.classList.toggle("btn-outline-primary", !selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  list.replaceChildren();
  if (isDirect) {
    appendDirectInbox();
    if (!directInboxRows.length) list.innerHTML = '<article class="empty-inbox"><h2>Aún no tienes conversaciones directas</h2><p>Entra al perfil de un trabajador y selecciona «Enviar mensaje» para comenzar.</p></article>';
    return;
  }
  const groups = new Map();
  for (const row of inboxRows) {
    if (!groups.has(row.persona_id)) groups.set(row.persona_id, []);
    groups.get(row.persona_id).push(row);
  }
  const threads = inboxPeer ? groups.get(inboxPeer) || [] : null;
  const rows = threads || [...groups.values()].map(group => ({
    ...group[0],
    no_leidos: group.reduce((n, r) => n + Number(r.no_leidos), 0),
    thread_count: group.length,
  }));
  list.innerHTML =
    (threads ? '<button type="button" id="volverPersonas" class="text-button">← Todas las personas</button>' : "") +
    rows.map(r => `<button type="button" class="conversation-row" data-peer="${esc(r.persona_id)}" data-conversation="${esc(r.conversacion_id)}"><span class="person-initial" aria-hidden="true">${esc(r.nombre?.slice(0,1)?.toUpperCase() || "?")}</span><span class="conversation-text"><strong>${esc(r.nombre)}</strong><small>${r.thread_count > 1 ? `${r.thread_count} trabajos · Selecciona un chat` : esc(r.titulo)}</small><span>${esc(r.ultimo_mensaje)}</span></span><span class="conversation-meta"><small>${esc(new Date(r.ultima_fecha).toLocaleDateString("es-PE"))}</small>${Number(r.no_leidos) ? `<span class="unread-count">${Number(r.no_leidos)}</span>` : ""}</span></button>`).join("");
  if (!rows.length) list.innerHTML = '<article class="empty-inbox"><h2>No tienes chats de postulaciones</h2><p>Cuando envíes o recibas una postulación, aparecerá aquí.</p></article>';
  $("#volverPersonas")?.addEventListener("click", () => {inboxPeer = null;renderInbox();});
  list.querySelectorAll("[data-conversation]").forEach(b => b.onclick = () => run(async () => {
    if (!inboxPeer && (groups.get(b.dataset.peer)||[]).length > 1) {
      inboxPeer = b.dataset.peer;
      renderInbox();
    } else await openConversation(b.dataset.conversation);
  }, b));
}
document.querySelectorAll("[data-inbox-tab]").forEach(button => {
  button.onclick = () => { inboxTipo = button.dataset.inboxTab; inboxPeer = null; renderInbox(); };
});

async function openConversation(id) {
  requireUser();

  conversation = id;

  const thread = inboxRows.find((r) => r.conversacion_id === id);

  const directo = id.startsWith("direct:") ? directInboxRows.find(r=>r.id===id.slice(7)) : null;
  $("#chatNombre").textContent = thread?.nombre || directo?.nombre || "Conversación";
  $("#chatTrabajo").textContent = directo ? "Conversación directa · Coordina los detalles con tu contacto." : (thread?.titulo || "Coordina aquí los detalles del trabajo.");

  await view("chat");
  if(id.startsWith("direct:")) await directServiceActions();
}
$("#actualizarBandeja").onclick = () =>
  run(refreshInbox, $("#actualizarBandeja"));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && user) {
    refreshInbox().catch(() => {});
    if (activeView === "chat") run(loadMessages);
  }
});
