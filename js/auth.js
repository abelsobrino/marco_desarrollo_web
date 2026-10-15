"use strict";
const passwordPolicy = (value) => ({
  length: value.length >= 8 && value.length <= 72,
  upper: /[A-ZÁÉÍÓÚÑ]/.test(value),
  lower: /[a-záéíóúñ]/.test(value),
  number: /[0-9]/.test(value),
  symbol: /[^\p{L}\p{N}\s]/u.test(value),
});
function assertPassword(password, confirm) {
  if (!Object.values(passwordPolicy(password)).every(Boolean))
    throw new Error("La contraseña debe tener entre 8 y 72 caracteres, mayúscula, minúscula, número y símbolo.");
  if (password !== confirm) throw new Error("Las contraseñas no coinciden.");
}
function updatePasswordFeedback(input) {
  const rules = document.querySelector(`[data-password-rules="${input.id}"]`);
  if (rules) {
    const result = passwordPolicy(input.value);
    rules.querySelectorAll("[data-rule]").forEach((item) => {
      const accepted = result[item.dataset.rule];
      item.classList.toggle("fulfilled", accepted);
      item.textContent = `${accepted ? "✓" : "○"} ${item.textContent.slice(2)}`;
    });
  }
  document.querySelectorAll("[data-password-match]").forEach((output) => {
    const confirmation = document.getElementById(output.dataset.passwordMatch);
    const original = confirmation?.form?.querySelector('input[name="password"]');
    if (!original) return;
    const match = !!confirmation.value && confirmation.value === original.value;
    output.textContent = !confirmation.value ? "" : match ? "✓ Las contraseñas coinciden" : "Las contraseñas no coinciden";
    output.classList.toggle("fulfilled", match);
    output.classList.toggle("invalid", !!confirmation.value && !match);
    confirmation.setCustomValidity(confirmation.value && !match ? "Las contraseñas no coinciden" : "");
  });
}
document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    button.innerHTML = input.type === "password" ? '<i class="fa-solid fa-eye" aria-hidden="true"></i>' : '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>';
    button.setAttribute("aria-label", input.type === "password" ? "Mostrar contraseña" : "Ocultar contraseña");
    button.setAttribute("aria-pressed", String(input.type === "text"));
  });
});
document.querySelectorAll('#registro input[type="password"], #nuevaPassword input[type="password"]').forEach((input) => {
  input.addEventListener("input", () => updatePasswordFeedback(input));
});
$("#togglePassword").addEventListener("click", () => {
  const input = $("#loginPassword");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("#togglePassword").innerHTML = show ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>' : '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
  $("#togglePassword").setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
  $("#togglePassword").setAttribute("aria-pressed", String(show));
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
  const dni = String(f.get("dni") || "").trim();
  const nombre = String(f.get("nombre") || "").trim();
  const fecha = String(f.get("fecha_nacimiento") || "");
  const password = String(f.get("password") || "");
  assertPassword(password, String(f.get("confirmar_password") || ""));
  if (!dniValidated || dniValidated.dni !== dni || dniValidated.nombre !== nombre) throw new Error("Primero consulta el DNI.");
  if (!f.has("acepto")) throw new Error("Acepta los términos y condiciones.");
  const { data, error } = await db.functions.invoke("registro-dni", {
    body: { accion: "registrar", dni, fecha_nacimiento: fecha,
      email: String(f.get("email") || "").trim(), password, acepto: true }
  });
  if (error || data?.error || !data?.ok) throw new Error(data?.error || "No se pudo completar el registro.");
  dniValidated = null;
  form.reset();
  $("#registroEstado").textContent = "Revisa tu correo y confirma la cuenta antes de ingresar.";
  notice("Consulta tu correo para confirmar el registro.");
});
$("#salirDesdePerfil").addEventListener("click", () => $("#salir").click());
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
  if (!user) throw new Error("El enlace de recuperación no está activo o ha caducado. Solicita uno nuevo.");
  const password = String(f.get("password") || "");
  assertPassword(password, String(f.get("confirmar_password") || ""));
  await checked(db.auth.updateUser({ password }));
  form.reset();
  notice("Contraseña actualizada.");
  await checked(db.auth.signOut());
  await view("acceso");
});
