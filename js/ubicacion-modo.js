"use strict";
$("#gps").onclick = () =>
  run(async () => {
    requireDB();
    if (!navigator.geolocation)
      throw new Error(
        "Tu navegador no permite geolocalización. Selecciona el distrito.",
      );
    if (!window.isSecureContext)
      throw new Error(
        "La geolocalización requiere HTTPS o localhost. Abre el sitio con un servidor seguro.",
      );
    notice("Solicitando ubicación...");
    const position = await obtenerPosicion();
    const precision = Math.round(position.coords.accuracy);
    const cercano = distritoMasCercano(
      position.coords.latitude,
      position.coords.longitude,
    );
    if (!cercano)
      throw new Error(
        "Los distritos no tienen coordenadas registradas todavía. Selecciona el distrito manualmente.",
      );
    $("#filtros [name=distrito]").value = cercano.distrito.id;
    notice(
      `Distrito sugerido: ${cercano.distrito.nombre} ` +
        `(a ${cercano.km.toFixed(1)} km de tu posición, precisión ±${precision} m). ` +
        `Verifica la selección antes de buscar.`,
    );
    await search();
  }, $("#gps"));

// Códigos de error de la Geolocation API:
// 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
const MENSAJES_ERROR_GPS = {
  1: "Bloqueaste el permiso de ubicación. Actívalo desde el candado de la barra de direcciones y vuelve a intentar, o selecciona el distrito manualmente.",
  2: "No se pudo determinar tu ubicación. Verifica que la ubicación esté activada en tu computadora o celular (en Windows: Configuración > Privacidad > Ubicación; en Mac: Ajustes > Privacidad y seguridad > Localización), o selecciona el distrito manualmente.",
  3: "La búsqueda de ubicación tardó demasiado. Intenta de nuevo o selecciona el distrito manualmente.",
};

function pedirPosicion(opciones) {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      resolve,
      (e) =>
        reject(
          new Error(
            MENSAJES_ERROR_GPS[e.code] ||
              "No se pudo obtener tu ubicación. Selecciona el distrito manualmente.",
          ),
        ),
      opciones,
    ),
  );
}

// Primer intento: GPS de precisión (celulares). Si falla o no hay chip GPS
// (la mayoría de laptops), reintenta con triangulación por red/WiFi, que
// responde más rápido aunque con menos precisión.
async function obtenerPosicion() {
  try {
    return await pedirPosicion({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
    });
  } catch (primerError) {
    try {
      return await pedirPosicion({
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000,
      });
    } catch {
      throw primerError;
    }
  }
}

// Compara la posición del usuario contra las coordenadas guardadas de cada
// distrito (catalogs.distritos[].latitud/.longitud) y devuelve el más
// cercano. Esto evita depender de que un servicio externo de geocodificación
// reconozca el distrito exacto: en Lima, muchas veces solo identifica la
// ciudad ("Lima") y no el distrito puntual.
function distritoMasCercano(lat, lon) {
  let mejor = null;
  for (const d of catalogs.distritos) {
    if (d.latitud == null || d.longitud == null) continue;
    const km = distanciaKm(lat, lon, d.latitud, d.longitud);
    if (!mejor || km < mejor.km) mejor = { distrito: d, km };
  }
  return mejor;
}


async function chooseMode(choice) {
  if (!user) {
    await view("acceso");
    return;
  }

  const hiring = choice === "contratar";

  mode = hiring ? "trabajadores" : "trabajos";

  saveMode(choice);

  $("#modoEtiqueta").textContent = hiring
    ? "ESTÁS BUSCANDO UN TRABAJADOR"
    : "ESTÁS OFRECIENDO TUS SERVICIOS";

  $("#explorarTitulo").textContent = hiring
    ? "Encuentra a quien puede ayudarte."
    : "Encuentra tu próxima oportunidad.";

  $("#explorarDescripcion").textContent = hiring
    ? "Busca trabajadores por oficio y distrito."
    : "Estas son oportunidades relacionadas con tus oficios.";

  $("#accionesModo").hidden = false;

  $("#publicarAccion").hidden = !hiring;
  $("#perfilAccion").hidden = hiring;

  $("#verTrabajadores").classList.toggle("primary", hiring);
  $("#verTrabajos").classList.toggle("primary", !hiring);

  const oficioSelect = $("#filtros [name=oficio]");

  if (hiring) {
    fillSelect(oficioSelect, catalogs.oficios, "Todos los oficios");
  } else {
    const misOficios = catalogs.oficios.filter((o) =>
      userSkills.includes(Number(o.id)),
    );

    fillSelect(oficioSelect, misOficios, "Todos mis oficios");
  }

  await view("explorar");
}
document
  .querySelectorAll("[data-mode]")
  .forEach((b) => (b.onclick = () => run(() => chooseMode(b.dataset.mode), b)));
$("#verTrabajadores").onclick = () => run(() => chooseMode("contratar"));
$("#verTrabajos").onclick = () => run(() => chooseMode("trabajar"));