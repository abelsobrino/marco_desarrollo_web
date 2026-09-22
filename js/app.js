"use strict";
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
  if (user && activeView !== "recuperacion") {
    await loadSessionProfile();

    const savedMode = getSavedMode();

    if (savedMode) {
      await chooseMode(savedMode);
    } else {
      await view("eleccion");
    }
  } else {
    await search(false);
  }
}
run(start);
