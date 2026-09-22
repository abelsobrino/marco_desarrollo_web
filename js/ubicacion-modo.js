"use strict";
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
