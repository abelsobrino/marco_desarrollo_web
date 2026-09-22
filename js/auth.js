"use strict";
$("#togglePassword").addEventListener("click", () => {
  const input = $("#loginPassword");

  const visible = input.type === "text";

  input.type = visible ? "password" : "text";

  $("#togglePassword").textContent = visible ? "👁️‍🗨️" : "👀";

  $("#togglePassword").setAttribute(
    "aria-label",
    visible ? "Mostrar contraseña" : "Ocultar contraseña",
  );
});
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

  await loadSessionProfile();

  const savedMode = getSavedMode();

  if (savedMode) {
    await chooseMode(savedMode);
  } else {
    await view("eleccion");
  }
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
