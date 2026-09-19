"use strict";
const $ = (s) => document.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    n,
  );
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function distanciaKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v === null || v === undefined))
    return null;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function distritoCoords(id) {
  const d = catalogs.distritos.find((x) => x.id === id);
  return d && d.latitud != null && d.longitud != null
    ? { lat: d.latitud, lon: d.longitud }
    : null;
}
function kmDesdeMiDistrito(distritoIdDestino) {
  if (!profile?.distrito_id || !distritoIdDestino) return null;
  const origen = distritoCoords(profile.distrito_id);
  const destino = distritoCoords(distritoIdDestino);
  return origen && destino
    ? distanciaKm(origen.lat, origen.lon, destino.lat, destino.lon)
    : null;
}

let inboxPeer = null;
let toastTimer,
  inboxTimer,
  inboxRows = [],
  inboxPending = false,
  sessionOwner = null,
  messageLimit = 100,
  messagesPending = false;
let db,
  user,
  profile,
  catalogs = { distritos: [], oficios: [] },
  mode = "trabajadores",
  activeView = "explorar",
  conversation,
  chatTimer,
  modalAction,
  searchGeneration = 0;
const notice = (msg, error = false) => {
  clearTimeout(toastTimer);
  $("#notice").textContent = msg;
  $("#notice").classList.toggle("error", error);
  $("#notice").hidden = false;
  toastTimer = setTimeout(() => {
    $("#notice").hidden = true;
  }, 2000);
};
const checked = async (request) => {
  const { data, error } = await request;
  if (error) throw error;
  return data;
};
function requireDB() {
  if (!db)
    throw new Error(
      "Primero configura js/config.js con la URL y la clave publicable de Supabase. Consulta LEEME.md.",
    );
}
function requireUser() {
  requireDB();
  if (!user) throw new Error("Inicia sesión para continuar.");
}
function errorText(e) {
  if (e.code === "23505")
    return "Ya existe este registro: no puedes postular o calificar dos veces el mismo trabajo.";
  if (e.message === "Invalid login credentials")
    return "Correo o contraseña incorrectos.";
  if (e.message === "Email not confirmed")
    return "Confirma tu correo antes de ingresar.";
  return e.message || "No se pudo completar la operación.";
}
async function run(fn, button) {
  try {
    if (button) {
      button.disabled = true;
      const feedback = button.closest("form")?.querySelector(".form-feedback");
      if (feedback) feedback.remove();
    }
    await fn();
  } catch (e) {
    notice(errorText(e), true);
    const form = button?.closest("form");
    if (form) {
      let feedback = form.querySelector(".form-feedback");
      if (!feedback) {
        feedback = document.createElement("p");
        feedback.className = "form-feedback";
        feedback.setAttribute("role", "alert");
        form.append(feedback);
      }
      feedback.textContent = errorText(e);
    }
  } finally {
    if (button) button.disabled = false;
  }
}
function onSubmit(id, fn) {
  $(id).addEventListener("submit", (e) => {
    e.preventDefault();
    run(() => fn(new FormData(e.target), e.target), e.submitter);
  });
}
function nameOf(table, id) {
  return catalogs[table].find((x) => x.id === Number(id))?.nombre || "";
}
function fillSelect(node, rows, empty) {
  node.innerHTML =
    `<option value="">${empty}</option>` +
    rows
      .map((r) => `<option value="${r.id}">${esc(r.nombre)}</option>`)
      .join("");
}
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
onSubmit("#login", async (f, form) => {
  requireDB();
  const data = await checked(
    db.auth.signInWithPassword({
      email: f.get("email").trim(),
      password: f.get("password"),
    }),
  );
  user = data.user;
  syncUser();
  form.reset();
  notice("¡Bienvenido!");
  await view("eleccion");
});
onSubmit("#registro", async (f, form) => {
  requireDB();
  const data = await checked(
    db.auth.signUp({
      email: f.get("email").trim(),
      password: f.get("password"),
      options: {
        data: { nombre: f.get("nombre").trim() },
        emailRedirectTo: location.origin + location.pathname,
      },
    }),
  );
  form.reset();
  if (data.session) {
    user = data.user;
    syncUser();
    notice("Cuenta creada.");
    await view("eleccion");
  } else {
    $("#registroEstado").textContent =
      "La cuenta requiere confirmación de correo. Para la presentación, desactiva Confirm email en Supabase antes de crear nuevas cuentas.";
    notice("Revisa la configuración de confirmación.", true);
  }
});
$("#salir").addEventListener("click", () =>
  run(async () => {
    requireDB();
    await checked(db.auth.signOut());
    user = null;
    profile = null;
    conversation = null;
    syncUser();
    $("#mensajes").replaceChildren();
    $("#misPublicaciones").replaceChildren();
    $("#misPostulaciones").replaceChildren();
    await view("acceso");
    notice("Sesión cerrada.");
  }),
);
$("#recuperar").addEventListener("click", () =>
  run(async () => {
    requireDB();
    const email = $("#login [name=email]");
    if (!email.value || !email.reportValidity())
      throw new Error(
        "Escribe tu correo en el formulario de inicio de sesión.",
      );
    await checked(
      db.auth.resetPasswordForEmail(email.value.trim(), {
        redirectTo: location.origin + location.pathname,
      }),
    );
    notice(
      "Si el correo está registrado, recibirás un enlace para cambiar tu contraseña.",
    );
  }),
);
onSubmit("#nuevaPassword", async (f, form) => {
  requireUser();
  await checked(db.auth.updateUser({ password: f.get("password") }));
  form.reset();
  notice("Contraseña actualizada.");
  await view("perfil");
});
async function loadProfile() {
  requireUser();
  profile = await checked(
    db.from("perfiles").select("*").eq("id", user.id).single(),
  );
  const form = $("#perfilForm");
  for (const key of ["nombre", "distrito_id", "presentacion"])
    form.elements[key].value = profile[key] ?? "";
  form.elements.ofrece_servicios.checked = profile.ofrece_servicios;
  await loadMySkills();
}
async function loadMySkills() {
  const rows = await checked(
    db
      .from("perfil_oficios")
      .select("*,oficios(nombre)")
      .eq("perfil_id", user.id),
  );
  $("#misOficios").innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<p>${esc(r.oficios.nombre)} · ${r.experiencia} años <button data-remove="${r.oficio_id}">Quitar</button></p>`,
        )
        .join("")
    : "<p>Agrega los oficios en los que trabajas. Puedes tener más de uno.</p>";
  $("#misOficios")
    .querySelectorAll("[data-remove]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          run(async () => {
            await checked(
              db
                .from("perfil_oficios")
                .delete()
                .eq("perfil_id", user.id)
                .eq("oficio_id", b.dataset.remove),
            );
            await loadMySkills();
          }, b)),
    );
}
onSubmit("#perfilForm", async (f, form) => {
  requireUser();
  let path = profile.foto_path,
    uploaded = false;
  const file = f.get("foto");
  if (file?.size) {
    if (
      file.size > 2097152 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new Error("Usa JPG, PNG o WebP de hasta 2 MB.");
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[file.type];
    path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    await checked(
      db.storage
        .from("avatares")
        .upload(path, file, { contentType: file.type, upsert: false }),
    );
    uploaded = true;
  }
  try {
    await checked(
      db
        .from("perfiles")
        .update({
          nombre: f.get("nombre").trim(),
          distrito_id: Number(f.get("distrito_id")),
          presentacion: f.get("presentacion").trim(),
          ofrece_servicios: f.has("ofrece_servicios"),
          foto_path: path,
        })
        .eq("id", user.id),
    );
  } catch (e) {
    if (uploaded) await db.storage.from("avatares").remove([path]);
    throw e;
  }
  if (uploaded && profile.foto_path)
    await db.storage.from("avatares").remove([profile.foto_path]);
  form.elements.foto.value = "";
  await loadProfile();
  notice("Perfil guardado.");
});
onSubmit("#oficioForm", async (f) => {
  requireUser();
  await checked(
    db.from("perfil_oficios").upsert({
      perfil_id: user.id,
      oficio_id: Number(f.get("oficio_id")),
      experiencia: Number(f.get("experiencia")),
    }),
  );
  await loadMySkills();
  notice("Oficio guardado.");
});
onSubmit("#publicacionForm", async (f, form) => {
  requireUser();
  await checked(
    db.from("publicaciones").insert({
      cliente_id: user.id,
      titulo: f.get("titulo").trim(),
      descripcion: f.get("descripcion").trim(),
      oficio_id: Number(f.get("oficio_id")),
      distrito_id: Number(f.get("distrito_id")),
      fecha: f.get("fecha"),
      pago: Number(f.get("pago")),
      modalidad_pago: f.get("modalidad_pago"),
    }),
  );
  form.reset();
  notice("Trabajo publicado.");
  await view("panel");
});
$("#publicacionForm [name=fecha]").min = today();
onSubmit("#filtros", async () => {
  requireDB();
  await search();
});
function workerCard(p) {
  const skills = p.perfil_oficios || [],
    ratings = p.calificaciones || [],
    avg = ratings.length
      ? (
          ratings.reduce((s, r) => s + r.puntuacion, 0) / ratings.length
        ).toFixed(1)
      : null;
  const photo = p.foto_path
    ? db.storage.from("avatares").getPublicUrl(p.foto_path).data.publicUrl
    : null;
  const km = kmDesdeMiDistrito(p.distrito_id);
  const distanciaTxt =
    km !== null
      ? `<p class="muted">📍 A ${km.toFixed(1)} km de ti (aprox.)</p>`
      : "";
  return `<article>${photo ? `<img class="avatar" src="${esc(photo)}" alt="Foto de ${esc(p.nombre)}" loading="lazy">` : ""}<h2>${esc(p.nombre)}</h2><p class="muted">${esc(nameOf("distritos", p.distrito_id))}</p>${distanciaTxt}<div>${skills.map((s) => `<span class="tag">${esc(nameOf("oficios", s.oficio_id))} · ${s.experiencia} años</span>`).join("")}</div><p>${esc(p.presentacion || "Sin presentación todavía.")}</p><p>${avg ? `★ ${avg} / 5 · ${ratings.length} calificaciones` : "Sin calificaciones aún"}</p><button data-publish>Publicar un trabajo</button><p class="muted">Publica en su oficio para recibir postulaciones.</p></article>`;
}
function jobCard(p, extra = "") {
  const km = kmDesdeMiDistrito(p.distrito_id);
  const distanciaTxt =
    km !== null
      ? `<p class="muted">📍 A ${km.toFixed(1)} km de ti (aprox.)</p>`
      : "";
  return `<article><span class="tag">${esc(p.estado)}</span><h2>${esc(p.titulo)}</h2><p>${esc(p.descripcion)}</p><p class="muted">${esc(nameOf("oficios", p.oficio_id))} · ${esc(nameOf("distritos", p.distrito_id))}<br>Fecha: ${esc(p.fecha)}</p>${distanciaTxt}<p><strong>${money(p.pago)}</strong> · ${esc(p.modalidad_pago)}</p>${extra}</article>`;
}
async function search() {
  const generation = ++searchGeneration;
  const f = new FormData($("#filtros")),
    district = f.get("distrito"),
    skill = f.get("oficio"),
    term = f.get("buscar").trim().toLocaleLowerCase("es");
  $("#resultados").textContent = "Buscando…";
  let rows;
  if (mode === "trabajadores") {
    let query = db
      .from("perfiles")
      .select(
        "*,perfil_oficios(*),calificaciones!calificaciones_trabajador_id_fkey(puntuacion)",
      )
      .eq("ofrece_servicios", true)
      .order("nombre")
      .limit(100);
    if (district) query = query.eq("distrito_id", district);
    rows = await checked(query);
    rows = rows.filter(
      (p) =>
        (!skill ||
          p.perfil_oficios.some((s) => s.oficio_id === Number(skill))) &&
        (!term ||
          [
            p.nombre,
            p.presentacion,
            ...p.perfil_oficios.map((s) => nameOf("oficios", s.oficio_id)),
          ]
            .join(" ")
            .toLocaleLowerCase("es")
            .includes(term)),
    );
    if (generation !== searchGeneration) return;
    $("#resultados").innerHTML = rows.map(workerCard).join("");
    $("#resultados")
      .querySelectorAll("[data-publish]")
      .forEach((b) => (b.onclick = () => run(() => view("publicar"), b)));
  } else {
    let query = db
      .from("publicaciones")
      .select("*")
      .eq("estado", "abierta")
      .gte("fecha", today())
      .order("creado_en", { ascending: false })
      .limit(100);
    if (district) query = query.eq("distrito_id", district);
    if (skill) query = query.eq("oficio_id", skill);
    rows = await checked(query);
    rows = rows.filter(
      (p) =>
        !term ||
        `${p.titulo} ${p.descripcion}`.toLocaleLowerCase("es").includes(term),
    );
    if (generation !== searchGeneration) return;
    $("#resultados").innerHTML = rows
      .map((p) =>
        jobCard(
          p,
          p.cliente_id === user?.id
            ? "<p>Esta es tu publicación.</p>"
            : `<button data-apply="${p.id}" class="primary">Enviar propuesta</button>`,
        ),
      )
      .join("");
    $("#resultados")
      .querySelectorAll("[data-apply]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            run(async () => {
              requireUser();
              openForm(
                "Enviar propuesta al cliente",
                '<label>Presenta tu propuesta<textarea name="mensaje" required minlength="5" maxlength="1000"></textarea></label>',
                async (f) => {
                  await checked(
                    db.rpc("postular", {
                      p_publicacion: b.dataset.apply,
                      p_mensaje: f.get("mensaje").trim(),
                    }),
                  );
                  notice("Propuesta enviada.");
                  await view("panel");
                },
              );
            })),
      );
  }
  if (!rows.length)
    $("#resultados").innerHTML =
      "<article><h2>No hay resultados</h2><p>Prueba otro distrito u oficio. Los perfiles y trabajos aparecen cuando los usuarios los registran.</p></article>";
}
async function loadPanel() {
  requireUser();
  const [jobs, applications] = await Promise.all([
    checked(
      db
        .from("publicaciones")
        .select("*")
        .eq("cliente_id", user.id)
        .order("creado_en", { ascending: false }),
    ),
    checked(
      db
        .from("postulaciones")
        .select("*,publicaciones(*)")
        .eq("trabajador_id", user.id)
        .order("creado_en", { ascending: false }),
    ),
  ]);
  $("#misPublicaciones").innerHTML =
    jobs
      .map((p) =>
        jobCard(
          p,
          `<button data-detail="${p.id}">Ver postulantes y gestionar</button>`,
        ),
      )
      .join("") || "<p>Aún no publicaste trabajos.</p>";
  $("#misPostulaciones").innerHTML =
    applications
      .map((a) =>
        jobCard(
          a.publicaciones,
          `<p>${esc(a.mensaje)}</p><p>${a.publicaciones.trabajador_id === user.id ? "Fuiste seleccionado" : a.publicaciones.estado === "abierta" ? "Pendiente de selección" : "Proceso cerrado"}</p><button data-chat="${a.id}">Abrir chat</button>`,
        ),
      )
      .join("") || "<p>Aún no postulaste a trabajos.</p>";
  bindDetails($("#panel"));
}
function bindDetails(root) {
  root
    .querySelectorAll("[data-detail]")
    .forEach(
      (b) => (b.onclick = () => run(() => loadDetail(b.dataset.detail), b)),
    );
  root.querySelectorAll("[data-chat]").forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          await openConversation(b.dataset.chat);
        }, b)),
  );
}
async function loadDetail(id) {
  requireUser();
  const [p, apps, reviews] = await Promise.all([
    checked(
      db
        .from("publicaciones")
        .select("*")
        .eq("id", id)
        .eq("cliente_id", user.id)
        .single(),
    ),
    checked(
      db
        .from("postulaciones")
        .select("*,perfiles!postulaciones_trabajador_id_fkey(nombre)")
        .eq("publicacion_id", id),
    ),
    checked(db.from("calificaciones").select("*").eq("publicacion_id", id)),
  ]);
  let controls = "";
  if (p.estado === "abierta")
    controls = '<button id="cancelarTrabajo">Cancelar publicación</button>';
  if (p.estado === "asignada")
    controls =
      '<button id="finalizarTrabajo" class="primary">Marcar como finalizado</button>';
  if (p.estado === "finalizada" && !reviews.length)
    controls =
      '<button id="calificarTrabajo" class="primary">Calificar trabajador</button>';
  $("#detalleContenido").innerHTML =
    jobCard(p, controls) +
    (reviews.length
      ? `<p>Calificación registrada: ${reviews[0].puntuacion}/5 · ${esc(reviews[0].comentario)}</p>`
      : "") +
    "<h2>Postulantes</h2>" +
    apps
      .map(
        (a) =>
          `<article><h2>${esc(a.perfiles.nombre)}</h2><p>${esc(a.mensaje)}</p>${p.trabajador_id === a.trabajador_id ? '<span class="tag">Seleccionado</span>' : ""}<div class="tabs"><button data-chat="${a.id}">Conversar</button>${p.estado === "abierta" ? `<button data-accept="${a.id}" class="primary">Seleccionar trabajador</button>` : ""}</div></article>`,
      )
      .join("");
  if (!apps.length)
    $("#detalleContenido").insertAdjacentHTML(
      "beforeend",
      "<p>Aún no hay postulaciones.</p>",
    );
  bindDetails($("#detalleContenido"));
  $("#detalleContenido")
    .querySelectorAll("[data-accept]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          openForm(
            "Seleccionar trabajador",
            "<p>La publicación dejará de recibir postulaciones y quedará asignada a esta persona.</p>",
            async () => {
              await checked(
                db.rpc("aceptar_postulacion", {
                  p_postulacion: b.dataset.accept,
                }),
              );
              await loadDetail(id);
              notice("Trabajo asignado.");
            },
          )),
    );
  const state = (button, status, title) => {
    if ($(button))
      $(button).onclick = () =>
        openForm(
          title,
          "<p>Confirma que deseas realizar este cambio.</p>",
          async () => {
            await checked(
              db.rpc("cambiar_estado", { p_publicacion: id, p_estado: status }),
            );
            await loadDetail(id);
            notice("Estado actualizado.");
          },
        );
  };
  state("#cancelarTrabajo", "cancelada", "Cancelar publicación");
  state("#finalizarTrabajo", "finalizada", "Confirmar trabajo finalizado");
  if ($("#calificarTrabajo"))
    $("#calificarTrabajo").onclick = () =>
      openForm(
        "Calificar al trabajador",
        '<label>Puntuación<select name="puntuacion"><option value="5">5 · Excelente</option><option value="4">4 · Bueno</option><option value="3">3 · Regular</option><option value="2">2 · Malo</option><option value="1">1 · Muy malo</option></select></label><label>Comentario<textarea name="comentario" required minlength="5" maxlength="1000"></textarea></label>',
        async (f) => {
          await checked(
            db.rpc("calificar", {
              p_publicacion: id,
              p_puntuacion: Number(f.get("puntuacion")),
              p_comentario: f.get("comentario").trim(),
            }),
          );
          await loadDetail(id);
          notice("Calificación guardada.");
        },
      );
  await view("detalle");
}
function openForm(title, fields, action) {
  $("#accionTitulo").textContent = title;
  $("#accionCampos").innerHTML = fields;
  $("#dialogError").textContent = "";
  modalAction = action;
  $("#formDialog").showModal();
}
$("#cerrarDialog").onclick = () => $("#formDialog").close();
$("#accionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  try {
    await modalAction(new FormData(e.target));
    $("#formDialog").close();
  } catch (error) {
    $("#dialogError").textContent = errorText(error);
  } finally {
    button.disabled = false;
  }
});
async function loadMessages() {
  requireUser();
  if (messagesPending) return;
  messagesPending = true;
  const id = conversation,
    owner = user.id;
  try {
    const rows = await checked(
      db
        .from("mensajes")
        .select("*,perfiles!mensajes_autor_id_fkey(nombre)")
        .eq("postulacion_id", id)
        .order("creado_en", { ascending: false })
        .order("id", { ascending: false })
        .limit(messageLimit),
    );
    if (id !== conversation || owner !== user?.id || activeView !== "chat")
      return;
    const box = $("#mensajes"),
      nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 70;
    $("#mensajesAnteriores").hidden = rows.length < messageLimit;
    box.innerHTML =
      rows
        .slice()
        .reverse()
        .map(
          (m) =>
            `<div class="message ${m.autor_id === owner ? "mine" : ""}"><strong>${esc(m.perfiles.nombre)}</strong><p>${esc(m.contenido)}</p><small>${esc(new Date(m.creado_en).toLocaleString("es-PE"))}</small></div>`,
        )
        .join("") ||
      "<p>Aún no hay mensajes. Saluda y coordina los detalles del trabajo.</p>";
    if (nearBottom) box.scrollTop = box.scrollHeight;
    const pending = rows
      .filter((m) => m.autor_id !== owner && !m.leido_en)
      .map((m) => m.id);
    if (pending.length && !document.hidden) {
      await checked(db.rpc("marcar_mensajes_leidos", { p_ids: pending }));
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
// La ubicación es opcional. No se almacena la posición ni se estima por centroide.
$("#gps").onclick = () =>
  run(async () => {
    requireDB();
    if (!navigator.geolocation)
      throw new Error(
        "Tu navegador no permite geolocalización. Selecciona el distrito.",
      );
    notice(
      "Solicitando ubicación. Se enviarán las coordenadas a BigDataCloud para sugerir el distrito.",
    );
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        resolve,
        () =>
          reject(
            new Error(
              "No se pudo obtener tu ubicación. Selecciona el distrito manualmente.",
            ),
          ),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      ),
    );
    const url = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client",
    );
    url.search = new URLSearchParams({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      localityLanguage: "es",
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok)
      throw new Error(
        "No se pudo consultar la ubicación. Selecciona el distrito manualmente.",
      );
    const data = await response.json();
    const normalize = (s) =>
      String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/^distrito de /, "");
    const candidates = [
      data.locality,
      ...(data.localityInfo?.administrative || []).map((x) => x.name),
    ].map(normalize);
    const match =
      data.countryCode === "PE" &&
      catalogs.distritos.find((d) => candidates.includes(normalize(d.nombre)));
    if (!match)
      throw new Error(
        "No se identificó un distrito de cobertura. Elígelo manualmente.",
      );
    $("#filtros [name=distrito]").value = match.id;
    notice(
      `Distrito sugerido: ${match.nombre}. Verifica la selección antes de buscar.`,
    );
    await search();
  }, $("#gps"));

async function chooseMode(choice) {
  if (!user) {
    await view("acceso");
    return;
  }
  const hiring = choice === "contratar";
  mode = hiring ? "trabajadores" : "trabajos";
  $("#modoEtiqueta").textContent = hiring
    ? "ESTÁS BUSCANDO UN TRABAJADOR"
    : "ESTÁS OFRECIENDO TUS SERVICIOS";
  $("#explorarTitulo").textContent = hiring
    ? "Encuentra a quien puede ayudarte."
    : "Encuentra tu próxima oportunidad.";
  $("#explorarDescripcion").textContent = hiring
    ? "Busca profesionales o publica el trabajo que necesitas. Tú eliges a quién contratar."
    : "Revisa lo que necesitan los clientes y envía tu propuesta. Ellos podrán conversar contigo y contratarte.";
  $("#accionesModo").hidden = false;
  $("#publicarAccion").hidden = !hiring;
  $("#perfilAccion").hidden = hiring;
  $("#verTrabajadores").classList.toggle("primary", hiring);
  $("#verTrabajos").classList.toggle("primary", !hiring);
  await view("explorar");
}
document
  .querySelectorAll("[data-mode]")
  .forEach((b) => (b.onclick = () => run(() => chooseMode(b.dataset.mode), b)));
// Tabs keep the same language and actions as the selected mode.
$("#verTrabajadores").onclick = () => run(() => chooseMode("contratar"));
$("#verTrabajos").onclick = () => run(() => chooseMode("trabajar"));

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
  messageLimit = 100;
  const thread = inboxRows.find((r) => r.conversacion_id === id);
  $("#chatNombre").textContent = thread?.nombre || "Conversación";
  $("#chatTrabajo").textContent =
    thread?.titulo || "Coordina aquí los detalles del trabajo.";
  await view("chat");
}
$("#actualizarBandeja").onclick = () =>
  run(refreshInbox, $("#actualizarBandeja"));
$("#mensajesAnteriores").onclick = () =>
  run(async () => {
    messageLimit += 100;
    await loadMessages();
  }, $("#mensajesAnteriores"));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && user) {
    refreshInbox().catch(() => {});
    if (activeView === "chat") run(loadMessages);
  }
});

async function start() {
  const config = window.CHAMBACERCA_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseKey) {
    notice(
      "Falta conectar Supabase. Sigue LEEME.md y completa js/config.js. No se están mostrando datos de ejemplo.",
    );
    $("#resultados").innerHTML =
      "<article><h2>Conecta tu proyecto</h2><p>Ejecuta database/01_supabase.sql en Supabase y configura la URL y la clave publicable.</p></article>";
    return;
  }
  if (!window.supabase)
    throw new Error(
      "No se pudo cargar Supabase. Revisa tu conexión a Internet.",
    );
  db = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
  db.auth.onAuthStateChange((event, session) => {
    user = session?.user || null;
    syncUser();
    if (event === "PASSWORD_RECOVERY")
      setTimeout(() => run(() => view("recuperacion")), 0);
    if (event === "SIGNED_OUT") {
      clearInterval(chatTimer);
      conversation = null;
      if (!["explorar", "acceso", "registroVista"].includes(activeView))
        setTimeout(() => run(() => view("acceso")), 0);
    }
  });
  const session = await checked(db.auth.getSession());
  user = session.session?.user || null;
  syncUser();
  const [districts, skills] = await Promise.all([
    checked(db.from("distritos").select("*").order("nombre")),
    checked(db.from("oficios").select("*").order("nombre")),
  ]);
  catalogs = { distritos: districts, oficios: skills };
  document
    .querySelectorAll("select[name=distrito],select[name=distrito_id]")
    .forEach((s) =>
      fillSelect(
        s,
        districts,
        s.name === "distrito"
          ? "Todos los distritos"
          : "Selecciona un distrito",
      ),
    );
  document
    .querySelectorAll("select[name=oficio],select[name=oficio_id]")
    .forEach((s) =>
      fillSelect(
        s,
        skills,
        s.name === "oficio" ? "Todos los oficios" : "Selecciona un oficio",
      ),
    );
  if (user && activeView !== "recuperacion") await view("eleccion");
  else await search();
}
run(start);
