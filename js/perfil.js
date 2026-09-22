"use strict";
async function loadSessionProfile() {
  if (!user) {
    profile = null;
    userSkills = [];
    return;
  }

  profile = await checked(
    db.from("perfiles").select("*").eq("id", user.id).single(),
  );

  const skills = await checked(
    db.from("perfil_oficios").select("oficio_id").eq("perfil_id", user.id),
  );

  userSkills = skills.map((s) => Number(s.oficio_id));
}

async function loadProfile() {
  requireUser();

  await loadSessionProfile();
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
