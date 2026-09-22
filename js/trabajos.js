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
  const ratings = p.calificaciones || [];

  const avg = ratings.length
    ? (ratings.reduce((s, r) => s + r.puntuacion, 0) / ratings.length).toFixed(
        1,
      )
    : null;

  const photo = p.foto_path
    ? db.storage.from("avatares").getPublicUrl(p.foto_path).data.publicUrl
    : null;

  const km = kmDesdeMiDistrito(p.distrito_id);
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

      <p>
        ${
          avg
            ? `★ ${avg} / 5 · ${ratings.length} calificaciones`
            : "Sin calificaciones aún"
        }
      </p>

    </article>
  `;
}
function jobCard(p, extra = "") {
  const km = kmDesdeMiDistrito(p.distrito_id);
  const distanciaTxt =
    km !== null
      ? `<p class="muted">📍 A ${km.toFixed(1)} km de ti (aprox.)</p>`
      : "";
  return `<article><span class="tag">${esc(p.estado)}</span><h2>${esc(p.titulo)}</h2><p>${esc(p.descripcion)}</p><p class="muted">${esc(nameOf("oficios", p.oficio_id))} · ${esc(nameOf("distritos", p.distrito_id))}<br>Fecha: ${esc(p.fecha)}</p>${distanciaTxt}<p><strong>${money(p.pago)}</strong> · ${esc(p.modalidad_pago)}</p>${extra}</article>`;
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

    if (applyFilters) {
      rows = ordenarPorDistancia(rows);
    }

    if (generation !== searchGeneration) {
      return;
    }

    $("#resultados").innerHTML = rows.map(workerCard).join("");
  }

  else {
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
