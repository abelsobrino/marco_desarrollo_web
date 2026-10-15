"use strict";
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
  await search(true);
});
function workerCard(p) {
  const skills = p.perfil_oficios || [];
  const ratings = [
    ...(p.calificaciones || []),
    ...(p.calificaciones_directas || []),
  ];

  const avg = ratings.length
    ? (ratings.reduce((s, r) => s + r.puntuacion, 0) / ratings.length).toFixed(
        1,
      )
    : null;

  const photo = p.foto_path
    ? db.storage.from("avatares").getPublicUrl(p.foto_path).data.publicUrl
    : null;

  const km = distanciaAlDestino(p.distrito_id);
  const distrito = nameOf("distritos", p.distrito_id) || "Distrito no indicado";
  const ubicacionTxt = `<p class="worker-distance">📍 ${esc(distrito)}${km !== null ? ` · A ${km.toFixed(1)} km de ti aproximadamente` : ""}</p>`;

  return `
    <article class="worker-card">

      ${
        photo
          ? `<img
              class="avatar"
              src="${esc(photo)}"
              alt="Foto de ${esc(p.nombre)}"
              loading="lazy"
            >`
          : ""
      }

      <h2>${esc(p.nombre)}</h2>

      ${ubicacionTxt}

      <div>
        ${skills
          .map(
            (s) => `
              <span class="tag">
                ${esc(nameOf("oficios", s.oficio_id))}
                · ${s.experiencia} años
              </span>
            `,
          )
          .join("")}
      </div>

      <p>
        ${esc(p.presentacion || "Sin presentación todavía.")}
      </p>

      <p class="worker-reviews">
        ${
          avg
            ? `★ ${avg} / 5 · ${ratings.length} reseñas`
            : "Sin calificaciones aún"
        }
      </p>

      <p class="muted">${Number(p.trabajos_realizados || 0)} trabajos completados y confirmados</p>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" data-worker-profile="${esc(p.id)}"><i class="fa-solid fa-user" aria-hidden="true"></i> Perfil y reseñas</button>
        ${user && user.id !== p.id ? `<button class="primary" data-direct="${esc(p.id)}"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i> Enviar mensaje</button>` : user?.id === p.id ? "" : "<small>Inicia sesión para conversar.</small>"}
      </div>
    </article>
  `;
}
function etiquetaEstado(value) {
  const labels = {
    abierta: "Abierto",
    asignada: "Asignado",
    finalizada: "Finalizado",
    cancelada: "Cancelado",
    pendiente: "Pendiente",
    confirmada: "Confirmado",
    programado: "Programado",
    cancelado: "Cancelado",
  };
  const text = String(value || "").toLowerCase();
  return (
    labels[text] ||
    (text ? text.charAt(0).toUpperCase() + text.slice(1) : "Sin estado")
  );
}
function jobCard(p, extra = "") {
  const km = distanciaAlDestino(p.distrito_id);
  const distanciaTxt =
    km !== null
      ? `<p class="muted">📍 A ${km.toFixed(1)} km de ti (aprox.)</p>`
      : "";
  return `<article><span class="tag">${esc(etiquetaEstado(p.estado))}</span><h2>${esc(p.titulo)}</h2><p>${esc(p.descripcion)}</p><p class="muted">${esc(nameOf("oficios", p.oficio_id))} · ${esc(nameOf("distritos", p.distrito_id))}<br>Fecha: ${esc(p.fecha)}</p>${distanciaTxt}<p><strong>${money(p.pago)}</strong> · ${esc(p.modalidad_pago)}</p>${extra}</article>`;
}
async function search(applyFilters = false) {
  const generation = ++searchGeneration;

  const f = new FormData($("#filtros"));

  const district = f.get("distrito");
  const skill = f.get("oficio");

  $("#resultados").textContent = "Buscando…";

  let rows = [];

  if (mode === "trabajadores") {
    let query = db
      .from("perfiles")
      .select(
        "*,perfil_oficios(*),calificaciones!calificaciones_trabajador_id_fkey(puntuacion)",
      )
      .eq("ofrece_servicios", true)
      .order("nombre")
      .limit(100);

    if (user) {
      query = query.neq("id", user.id);
    }

    if (applyFilters && district) {
      query = query.eq("distrito_id", Number(district));
    }

    rows = await checked(query);

    if (applyFilters && skill) {
      rows = rows.filter((p) =>
        p.perfil_oficios.some((s) => Number(s.oficio_id) === Number(skill)),
      );
    }

    if (rows.length) {
      const ids = rows.map((p) => p.id);
      const [completed, direct, directReviews] = await Promise.all([
        db
          .from("publicaciones")
          .select("trabajador_id")
          .in("trabajador_id", ids)
          .eq("estado", "finalizada"),
        db
          .from("servicios_directos")
          .select("trabajador_id")
          .in("trabajador_id", ids)
          .eq("cliente_finalizo", true)
          .eq("trabajador_finalizo", true),
        db
          .from("calificaciones_directas")
          .select("trabajador_id,puntuacion")
          .in("trabajador_id", ids),
      ]);
      if (!completed.error && !direct.error && !directReviews.error) {
        for (const p of rows) {
          p.trabajos_realizados =
            completed.data.filter((j) => j.trabajador_id === p.id).length +
            direct.data.filter((j) => j.trabajador_id === p.id).length;
          p.calificaciones_directas = directReviews.data.filter(
            (j) => j.trabajador_id === p.id,
          );
        }
      }
    }
    rows = ordenarPorDistancia(rows);

    if (generation !== searchGeneration) {
      return;
    }

    $("#resultados").innerHTML = rows.map(workerCard).join("");
    bindDirectButtons();
    bindWorkerProfiles($("#resultados"));
  } else {
    if (!userSkills.length) {
      $("#resultados").innerHTML = `
        <article>
          <h2>Completa tus oficios</h2>

          <p>
            Para mostrarte oportunidades necesitamos
            saber qué trabajos realizas.
          </p>

          <button
            class="primary"
            id="completarOficios"
          >
            Completar mi perfil
          </button>
        </article>
      `;

      $("#completarOficios").onclick = () => run(() => view("perfil"));

      return;
    }

    let query = db
      .from("publicaciones")
      .select("*")
      .eq("estado", "abierta")
      .gte("fecha", today())
      .in("oficio_id", userSkills)
      .limit(100);

    if (applyFilters && district) {
      query = query.eq("distrito_id", Number(district));
    }

    if (applyFilters && skill) {
      query = query.eq("oficio_id", Number(skill));
    }

    rows = await checked(query);

    rows = ordenarPorDistancia(rows);

    if (generation !== searchGeneration) {
      return;
    }

    $("#resultados").innerHTML = rows
      .map((p) =>
        jobCard(
          p,
          p.cliente_id === user?.id
            ? "<p>Esta es tu publicación.</p>"
            : `
              <button
                data-apply="${p.id}"
                class="primary"
              >
                Enviar propuesta
              </button>
            `,
        ),
      )
      .join("");

    $("#resultados")
      .querySelectorAll("[data-apply]")
      .forEach((b) => {
        b.onclick = () =>
          run(async () => {
            requireUser();

            openForm(
              "Enviar propuesta al cliente",

              `
                <label>
                  Presenta tu propuesta

                  <textarea
                    name="mensaje"
                    required
                    minlength="5"
                    maxlength="1000"
                  ></textarea>
                </label>
              `,

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
          }, b);
      });
  }

  if (!rows.length) {
    $("#resultados").innerHTML = `
      <article>

        <h2>No hay resultados</h2>

        <p>
          No encontramos resultados con estos
          criterios.
        </p>

      </article>
    `;
  }
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
  const completedWork = applications.filter(
    (a) =>
      a.publicaciones?.estado === "finalizada" &&
      a.publicaciones?.trabajador_id === user.id,
  ).length;
  const summary = document.querySelector("#resumenTrabajos");
  if (summary)
    summary.textContent = `${completedWork} trabajo${completedWork === 1 ? "" : "s"} finalizado${completedWork === 1 ? "" : "s"} mediante publicaciones`;
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
      '<button id="programarTrabajo">📅 Definir horario</button> <button id="finalizarTrabajo" class="primary">Marcar como finalizado</button>';
  if (p.estado === "finalizada" && !reviews.length)
    controls =
      '<button id="calificarTrabajo" class="primary">Calificar trabajador</button>';
  $("#detalleContenido").innerHTML =
    jobCard(p, controls) +
    (reviews.length
      ? `<p>Calificación registrada: ${"★".repeat(reviews[0].puntuacion)}${"☆".repeat(5 - reviews[0].puntuacion)} · ${esc(reviews[0].comentario)}</p>`
      : "") +
    "<h2>Postulantes</h2>" +
    apps
      .map(
        (a) =>
          `<article><h2>${esc(a.perfiles.nombre)}</h2><p>${esc(a.mensaje)}</p>${p.trabajador_id === a.trabajador_id ? '<span class="tag">Seleccionado</span>' : ""}<div class="tabs"><button data-worker-profile="${esc(a.trabajador_id)}"><i class="fa-solid fa-star" aria-hidden="true"></i> Perfil y reseñas</button><button data-chat="${a.id}">Conversar</button>${p.estado === "abierta" ? `<button data-accept="${a.id}" class="primary">Seleccionar trabajador</button>` : ""}</div></article>`,
      )
      .join("");
  if (!apps.length)
    $("#detalleContenido").insertAdjacentHTML(
      "beforeend",
      "<p>Aún no hay postulaciones.</p>",
    );
  bindDetails($("#detalleContenido"));
  bindWorkerProfiles($("#detalleContenido"));
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
  if ($("#programarTrabajo"))
    $("#programarTrabajo").onclick = () =>
      openForm(
        "Programar horario",
        '<label>Desde<input type="time" name="inicio" required></label><label>Hasta<input type="time" name="fin" required></label><p class="muted">Se usará la fecha de la publicación. Los horarios confirmados no pueden cruzarse.</p>',
        async (f) => {
          await checked(
            db.rpc("programar_publicacion", {
              p_publicacion: id,
              p_inicio: f.get("inicio"),
              p_fin: f.get("fin"),
            }),
          );
          notice("Horario guardado.");
          await loadDetail(id);
        },
      );
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

let agendaOffset = 0;
let agendaDiaElegido = null;
let agendaReservas = [];
let agendaExternos = [];
function fechaLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function semanaBase(offset = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}
function sumarDias(fecha, dias) {
  const d = new Date(fecha.getTime());
  d.setDate(d.getDate() + dias);
  return d;
}
async function loadAgenda() {
  const panel = document.querySelector("#agendaDias");
  if (!panel || !user || !db) return;
  const lunes = semanaBase(agendaOffset),
    domingo = sumarDias(lunes, 6);
  const inicio = fechaLocal(lunes),
    fin = fechaLocal(domingo);
  if (!agendaDiaElegido || agendaDiaElegido < inicio || agendaDiaElegido > fin)
    agendaDiaElegido = fechaLocal(agendaOffset === 0 ? new Date() : lunes);
  const titulo = document.querySelector("#tituloSemana");
  titulo.textContent = `${lunes.toLocaleDateString("es-PE", { day: "numeric", month: "short" })} – ${domingo.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}`;
  const { data, error } = await db
    .from("reservas_agenda")
    .select(
      "id,titulo,fecha,hora_inicio,hora_fin,estado,cliente_id,trabajador_id,publicacion_id,conversacion_id",
    )
    .gte("fecha", inicio)
    .lte("fecha", fin)
    .or(`cliente_id.eq.${user.id},trabajador_id.eq.${user.id}`)
    .order("hora_inicio");
  const salida = document.querySelector("#agendaTrabajos");
  if (error) {
    salida.textContent = "No se pudo cargar la agenda";
    return;
  }
  agendaReservas = (data || []).filter((r) => r.estado !== "cancelada");
  const { data: externos, error: errorExternos } = await db
    .from("trabajos_externos")
    .select(
      "id,titulo,fecha,hora_inicio,hora_fin,lugar,cliente,detalles,estado",
    )
    .eq("trabajador_id", user.id)
    .gte("fecha", inicio)
    .lte("fecha", fin)
    .order("hora_inicio");
  if (errorExternos) {
    salida.textContent = "No se pudieron cargar los trabajos externos.";
    return;
  }
  agendaExternos = (externos || []).filter((e) => e.estado !== "cancelado");
  panel.replaceChildren();
  for (let i = 0; i < 7; i++) {
    const fecha = sumarDias(lunes, i),
      key = fechaLocal(fecha),
      n =
        agendaReservas.filter((r) => r.fecha === key).length +
        agendaExternos.filter(
          (r) => r.fecha === key && r.estado !== "cancelado",
        ).length;
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className =
      "agenda-dia" + (agendaDiaElegido === key ? " active" : "");
    boton.setAttribute("aria-pressed", String(agendaDiaElegido === key));
    const nombre = document.createElement("small");
    nombre.textContent = fecha.toLocaleDateString("es-PE", {
      weekday: "short",
    });
    const numero = document.createElement("strong");
    numero.textContent = String(fecha.getDate());
    const marcador = document.createElement("span");
    marcador.className = "punto";
    marcador.textContent = n ? `${n} trabajo${n === 1 ? "" : "s"}` : "Libre";
    boton.append(nombre, numero, marcador);
    boton.onclick = () => {
      agendaDiaElegido = key;
      renderAgenda();
    };
    panel.append(boton);
  }
  renderAgenda();
}
function renderAgenda() {
  const fecha = agendaDiaElegido,
    titulo = document.querySelector("#agendaDiaTitulo"),
    panel = document.querySelector("#agendaTrabajos");
  if (!panel) return;
  titulo.textContent = new Date(fecha + "T12:00:00").toLocaleDateString(
    "es-PE",
    { weekday: "long", day: "numeric", month: "long" },
  );
  document.querySelectorAll(".agenda-dia").forEach((b, i) => {
    const k = fechaLocal(sumarDias(semanaBase(agendaOffset), i));
    b.classList.toggle("active", k === fecha);
    b.setAttribute("aria-pressed", String(k === fecha));
  });
  panel.replaceChildren();
  const registros = agendaReservas.filter((r) => r.fecha === fecha);
  const externos = agendaExternos.filter((r) => r.fecha === fecha);
  if (!registros.length && !externos.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Sin reservas para este día.";
    panel.append(p);
    return;
  }
  for (const r of registros) {
    const box = document.createElement("article");
    box.className = "agenda-tarjeta";
    const h = document.createElement("h4");
    h.textContent = r.titulo;
    const horario = document.createElement("p");
    horario.textContent = `${r.hora_inicio.slice(0, 5)} – ${r.hora_fin.slice(0, 5)} · ${r.trabajador_id === user.id ? "Como trabajador" : "Como cliente"}`;
    const estado = document.createElement("span");
    estado.className = "agenda-estado";
    estado.textContent =
      r.estado === "pendiente"
        ? "Pendiente de aprobación"
        : r.estado === "confirmada"
          ? "✓ Confirmada"
          : r.estado === "finalizada"
            ? "Finalizada"
            : "Cancelada";
    const acciones = document.createElement("div");
    acciones.className = "tabs";
    const boton = (texto, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = texto;
      b.onclick = () => run(fn, b);
      acciones.append(b);
    };
    if (r.estado === "pendiente" && r.trabajador_id === user.id) {
      boton("Aceptar", async () => {
        await checked(
          db.rpc("responder_reserva_directa", {
            p_reserva: r.id,
            p_aceptar: true,
          }),
        );
        await loadAgenda();
        notice("Reserva confirmada.");
      });
      boton("Rechazar", async () => {
        await checked(
          db.rpc("responder_reserva_directa", {
            p_reserva: r.id,
            p_aceptar: false,
          }),
        );
        await loadAgenda();
      });
    }
    if (["pendiente", "confirmada"].includes(r.estado))
      boton("Cancelar reserva", async () => {
        if (!confirm("¿Cancelar esta reserva?")) return;
        await checked(db.rpc("cancelar_reserva_agenda", { p_reserva: r.id }));
        await loadAgenda();
      });
    box.append(h, horario, estado, acciones);
    panel.append(box);
  }
  for (const e of externos) {
    const box = document.createElement("article");
    box.className = "agenda-tarjeta agenda-externa";
    const encabezado = document.createElement("div");
    encabezado.className = "agenda-etiqueta";
    encabezado.textContent = "Trabajo externo · Privado";
    const h = document.createElement("h4");
    h.textContent = e.titulo;
    const horario = document.createElement("p");
    horario.textContent = `${e.hora_inicio.slice(0, 5)} – ${e.hora_fin.slice(0, 5)} · ${e.estado === "programado" ? "Programado" : e.estado === "finalizado" ? "Finalizado" : "Cancelado"}`;
    const ubicacion = document.createElement("p");
    ubicacion.textContent = e.lugar
      ? `Lugar: ${e.lugar}`
      : "Lugar no especificado";
    const cliente = document.createElement("p");
    cliente.textContent = e.cliente
      ? `Contacto: ${e.cliente}`
      : "Sin contacto registrado";
    const detalle = document.createElement("p");
    detalle.textContent = e.detalles ? `Detalles: ${e.detalles}` : "Sin notas";
    const acciones = document.createElement("div");
    acciones.className = "tabs";
    const boton = (titulo, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = titulo;
      b.onclick = () => run(fn, b);
      acciones.append(b);
    };
    if (e.estado === "programado") {
      boton("Editar", () => abrirTrabajoExterno(e));
      boton("Marcar finalizado", async () => {
        await checked(
          db
            .from("trabajos_externos")
            .update({ estado: "finalizado" })
            .eq("id", e.id)
            .eq("trabajador_id", user.id),
        );
        await loadAgenda();
        notice("Trabajo externo finalizado.");
      });
      boton("Cancelar", async () => {
        if (!confirm("¿Cancelar este trabajo externo?")) return;
        await checked(
          db
            .from("trabajos_externos")
            .update({ estado: "cancelado" })
            .eq("id", e.id)
            .eq("trabajador_id", user.id),
        );
        await loadAgenda();
      });
    }
    if (e.estado === "cancelado")
      boton("Eliminar", async () => {
        if (!confirm("¿Eliminar este registro de tu agenda?")) return;
        await checked(
          db
            .from("trabajos_externos")
            .delete()
            .eq("id", e.id)
            .eq("trabajador_id", user.id),
        );
        await loadAgenda();
      });
    box.append(encabezado, h, horario, ubicacion, cliente, detalle, acciones);
    panel.append(box);
  }
}
function abrirTrabajoExterno(externo = null) {
  if (!user) {
    notice("Inicia sesión para administrar tu agenda.");
    return;
  }
  const fecha = externo?.fecha || agendaDiaElegido || fechaLocal(new Date());
  const campos = `<label>Trabajo o servicio<input name="titulo" minlength="5" maxlength="120" required placeholder="Ej. Instalación de tomacorrientes"></label>
 <label>Fecha<input type="date" name="fecha" required></label>
 <div class="agenda-form-horas"><label>Hora de inicio<input type="time" name="inicio" required></label><label>Hora de fin<input type="time" name="fin" required></label></div>
 <label>Lugar<input name="lugar" maxlength="250" placeholder="Dirección o distrito"></label>
 <label>Cliente o contacto (opcional)<input name="cliente" maxlength="120" placeholder="Nombre o referencia"></label>
 <label>Detalles (privados)<textarea name="detalles" maxlength="1500" rows="3" placeholder="Materiales, indicaciones, observaciones..."></textarea></label>
 <p class="muted">Este compromiso solo aparece en tu agenda. Bloquea su horario y no cuenta como trabajo verificado en ChambaCerca.</p>`;
  openForm(
    externo ? "Editar trabajo externo" : "Agregar trabajo externo",
    campos,
    async (form) => {
      const datos = {
        titulo: String(form.get("titulo") || "").trim(),
        fecha: String(form.get("fecha") || ""),
        hora_inicio: String(form.get("inicio") || ""),
        hora_fin: String(form.get("fin") || ""),
        lugar: String(form.get("lugar") || "").trim(),
        cliente: String(form.get("cliente") || "").trim(),
        detalles: String(form.get("detalles") || "").trim(),
      };
      if (
        datos.titulo.length < 5 ||
        !datos.fecha ||
        !datos.hora_inicio ||
        !datos.hora_fin ||
        datos.hora_fin <= datos.hora_inicio
      )
        throw new Error(
          "Revisa el título, la fecha y el horario. La hora final debe ser posterior a la inicial.",
        );
      if (!externo)
        await checked(
          db
            .from("trabajos_externos")
            .insert({ ...datos, trabajador_id: user.id }),
        );
      else
        await checked(
          db
            .from("trabajos_externos")
            .update(datos)
            .eq("id", externo.id)
            .eq("trabajador_id", user.id),
        );
      const destino = new Date(datos.fecha + "T12:00:00");
      const base = semanaBase(0);
      agendaOffset = Math.round((semanaBasePara(destino) - base) / 604800000);
      agendaDiaElegido = datos.fecha;
      await loadAgenda();
      notice(
        externo
          ? "Trabajo externo actualizado."
          : "Trabajo externo agregado a tu agenda.",
      );
    },
  );
  const form = document.querySelector("#accionForm");
  if (form) {
    const valores = {
      titulo: externo?.titulo || "",
      fecha,
      inicio: externo?.hora_inicio?.slice(0, 5) || "09:00",
      fin: externo?.hora_fin?.slice(0, 5) || "10:00",
      lugar: externo?.lugar || "",
      cliente: externo?.cliente || "",
      detalles: externo?.detalles || "",
    };
    for (const [name, value] of Object.entries(valores)) {
      const input = form.elements.namedItem(name);
      if (input) input.value = value;
    }
  }
}
function semanaBasePara(fecha) {
  const d = new Date(fecha.getTime());
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
const botonExterno = document.querySelector("#agregarTrabajoExterno");
if (botonExterno) botonExterno.onclick = () => abrirTrabajoExterno();
document.querySelector("#semanaAnterior").onclick = () => {
  agendaOffset--;
  run(loadAgenda);
};
document.querySelector("#semanaSiguiente").onclick = () => {
  agendaOffset++;
  run(loadAgenda);
};
document.querySelector("#semanaActual").onclick = () => {
  agendaOffset = 0;
  agendaDiaElegido = null;
  run(loadAgenda);
};
