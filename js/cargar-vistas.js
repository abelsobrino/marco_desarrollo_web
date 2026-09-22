"use strict";

const vistas = [
  "explorar",
  "acceso",
  "registro",
  "eleccion",
  "recuperacion",
  "perfil",
  "publicar",
  "actividad",
  "detalle",
  "bandeja",
  "chat",
];

const scriptsAplicacion = [
  "js/core.js",
  "js/navegacion.js",
  "js/auth.js",
  "js/perfil.js",
  "js/trabajos.js",
  "js/modal.js",
  "js/mensajes.js",
  "js/ubicacion-modo.js",
  "js/app.js",
];

async function cargarVista(nombre) {
  const respuesta = await fetch(`vistas/${nombre}.html`);

  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar vistas/${nombre}.html`);
  }

  return respuesta.text();
}

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.body.appendChild(script);
  });
}

async function iniciarInterfaz() {
  const root = document.querySelector("#vistasRoot");

  try {
    const contenido = await Promise.all(vistas.map(cargarVista));
    root.innerHTML = contenido.join("");

    for (const src of scriptsAplicacion) {
      await cargarScript(src);
    }
  } catch (error) {
    root.innerHTML = `
      <article class="panel">
        <h1>No se pudo iniciar ChambaCerca</h1>
        <p>${error.message}</p>
        <p>Abre el proyecto con Live Server o desde un servidor web.</p>
      </article>
    `;
  }
}

iniciarInterfaz();
