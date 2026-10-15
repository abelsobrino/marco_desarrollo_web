"use strict";
let perfilPublicoOrigen = "explorar";
let perfilPublicoConsultado = null;

function bindWorkerProfiles(root) {
  root?.querySelectorAll("[data-worker-profile]").forEach((button) => {
    button.onclick = () =>
      run(() => openWorkerProfile(button.dataset.workerProfile), button);
  });
}

async function openWorkerProfile(id) {
  requireDB();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Perfil inválido.");
  perfilPublicoOrigen =
    activeView === "perfilPublico" ? perfilPublicoOrigen : activeView;
  const [perfilResp, skillsResp] = await Promise.all([
    db
      .from("perfiles")
      .select("id,nombre,presentacion,distrito_id,foto_path,ofrece_servicios")
      .eq("id", id)
      .single(),
    db
      .from("perfil_oficios")
      .select("oficio_id,experiencia")
      .eq("perfil_id", id),
  ]);
  if (perfilResp.error || !perfilResp.data)
    throw new Error("No se pudo consultar el perfil del trabajador.");
  const p = perfilResp.data;
  if (!p.ofrece_servicios && user?.id !== id)
    throw new Error("Este perfil no ofrece servicios actualmente.");
  if (skillsResp.error)
    throw new Error("No fue posible consultar los oficios del trabajador.");
  perfilPublicoConsultado = id;
  const foto = p.foto_path
    ? db.storage.from("avatares").getPublicUrl(p.foto_path).data.publicUrl
    : "";
  const distrito =
    nameOf("distritos", p.distrito_id) || "Distrito no especificado";
  const km = distanciaAlDestino(p.distrito_id);
  const ubicacion = `${esc(distrito)}${km !== null ? ` · A ${km.toFixed(1)} km aproximadamente` : ""}`;
  $("#perfilPublicoContenido").innerHTML = `
    <article class="public-profile-hero">
      ${foto ? `<img class="avatar" src="${esc(foto)}" alt="Foto de ${esc(p.nombre)}">` : '<span class="person-initial" aria-hidden="true"><i class="fa-solid fa-user"></i></span>'}
      <div>
        <p class="eyebrow">PERFIL DEL TRABAJADOR</p>
        <h1>${esc(p.nombre)}</h1>
        <p class="worker-distance"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${ubicacion}</p>
        <div>${(skillsResp.data || []).map((s) => `<span class="tag">${esc(nameOf("oficios", s.oficio_id))} · ${Number(s.experiencia) || 0} años de experiencia</span>`).join("") || '<span class="muted">Sin oficios registrados</span>'}</div>
        <p class="public-profile-intro">${esc(p.presentacion || "Este trabajador todavía no añadió una presentación.")}</p>
        ${user?.id === id ? '<p class="muted">Así ven tu perfil las personas que buscan contratarte.</p>' : `<button type="button" id="contactarDesdePerfil" class="primary"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i> Enviar mensaje</button>`}
      </div>
    </article>`;
  if (document.getElementById("contactarDesdePerfil")) {
    $("#contactarDesdePerfil").onclick = () =>
      run(async () => {
        if (!user) {
          await view("acceso");
          notice("Inicia sesión para contactar al trabajador.");
          return;
        }
        const idConv = await checked(
          db.rpc("iniciar_conversacion_directa", { p_destinatario: id }),
        );
        await openConversation("direct:" + idConv);
      }, $("#contactarDesdePerfil"));
  }
  $("#perfilPublicoResumen").textContent =
    "Cargando opiniones sobre servicios finalizados…";
  $("#perfilPublicoEstado").textContent = "";
  $("#perfilPublicoResenas").replaceChildren();
  await view("perfilPublico");
  const { data, error } = await db.rpc("resenas_publicas_trabajador", {
    p_trabajador: id,
  });
  if (perfilPublicoConsultado !== id) return;
  if (error) {
    $("#perfilPublicoResumen").textContent = "";
    $("#perfilPublicoEstado").textContent =
      "No se pudieron consultar las reseñas.";
    return;
  }
  const rows = data || [];
  const media = rows.length
    ? rows.reduce((s, r) => s + Number(r.puntuacion), 0) / rows.length
    : 0;
  $("#perfilPublicoResumen").innerHTML = rows.length
    ? `<span class="resenas-valoracion"><span class="resena-stars" aria-label="Calificación media">★</span> ${media.toFixed(1)} / 5</span> · ${rows.length} reseña${rows.length === 1 ? "" : "s"}`
    : "Este trabajador todavía no tiene reseñas de servicios registrados en ChambaCerca.";
  $("#perfilPublicoResenas").innerHTML = rows
    .map((r) => {
      const estrellas = Math.max(1, Math.min(5, Number(r.puntuacion) || 1));
      const fecha = r.creado_en
        ? new Date(r.creado_en).toLocaleDateString("es-PE")
        : "";
      return `<article class="resena-card"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2"><strong>${r.origen === "directa" ? "Servicio contratado por mensaje" : "Trabajo publicado"}</strong><span class="resena-stars" aria-label="${estrellas} de 5 estrellas">${"★".repeat(estrellas)}${"☆".repeat(5 - estrellas)}</span></div><p>${esc(r.comentario || "Sin comentario.")}</p>${fecha ? `<small>${esc(fecha)}</small>` : ""}</article>`;
    })
    .join("");
}

$("#volverPerfilPublico").onclick = () => run(() => view(perfilPublicoOrigen));
$("#verMisResenas").onclick = () =>
  run(() => openWorkerProfile(user.id), $("#verMisResenas"));
