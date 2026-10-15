const cors = { "Access-Control-Allow-Origin": Deno.env.get("FRONTEND_ORIGIN") || "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
function securePassword(password: string): boolean {
  return password.length >= 8 && password.length <= 72 && /[A-ZÁÉÍÓÚÑ]/.test(password) && /[a-záéíóúñ]/.test(password) && /[0-9]/.test(password) && /[^\p{L}\p{N}\s]/u.test(password);
}
function ageOf(input: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return -1;
  const date = new Date(input + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input) return -1;
  const today = new Date();
  if (date > today) return -1;
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  if (today.getUTCMonth() < date.getUTCMonth() || (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate())) age--;
  return age;
}
async function lookup(dni: string) {
  const token = Deno.env.get("DNI_PROVIDER_TOKEN");
  const url = Deno.env.get("DNI_PROVIDER_URL") || "https://api.apiperu.dev/dni";
  if (!token) throw new Error("Falta configurar el proveedor de DNI.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ dni }), signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 429 ? "Límite de consultas de DNI alcanzado." : "La consulta de DNI no está disponible.");
    const result = await response.json();
    if (!result?.success || !result?.data) throw new Error("No se encontraron datos para ese DNI.");
    const d = result.data;
    const name = [d.nombres, d.apellido_paterno, d.apellido_materno].map(clean).filter(Boolean).join(" ");
    if (!name || !clean(d.apellido_paterno)) throw new Error("La consulta no devolvió nombres completos.");
    return name.toLocaleLowerCase("es-PE").replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("es-PE"));
  } finally { clearTimeout(timeout); }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Método no permitido." }, 405);
  try {
    const b = await req.json();
    const dni = clean(b.dni);
    if (!/^\d{8}$/.test(dni)) return respond({ error: "El DNI debe tener ocho dígitos." }, 400);
    if (!["validar", "registrar"].includes(b.accion)) return respond({ error: "Acción desconocida." }, 400);
    let email = "", password = "", birthDate = "";
    if (b.accion === "registrar") {
      if (b.acepto !== true) return respond({ error: "Acepta los términos." }, 400);
      birthDate = clean(b.fecha_nacimiento);
      const age = ageOf(birthDate);
      if (age < 0) return respond({ error: "Fecha de nacimiento inválida." }, 400);
      if (age < 18) return respond({ error: "Debes tener al menos 18 años." }, 403);
      email = clean(b.email).toLowerCase(); password = typeof b.password === "string" ? b.password : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: "Correo inválido." }, 400);
      if (!securePassword(password)) return respond({ error: "La contraseña debe tener entre 8 y 72 caracteres, mayúscula, minúscula, número y símbolo." }, 400);
    }
    const nombre = await lookup(dni);
    if (b.accion === "validar") return respond({ ok: true, nombre, requiereFechaNacimiento: true, mayorEdadVerificada: false });
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anon) return respond({ error: "Configuración incompleta de autenticación." }, 503);
    const result = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST", headers: { "apikey": anon, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, data: { nombre, dni_consultado: true, mayor_edad_declarada: true, identidad_verificada: false, fecha_nacimiento_declarada: birthDate, acepto_terminos_en: new Date().toISOString() } })
    });
    if (!result.ok) {
      const body = await result.json().catch(() => ({}));
      if (result.status === 429) return respond({ error: "Espera antes de intentar registrarte otra vez." }, 429);
      return respond({ error: result.status === 422 ? "Revisa el correo y la contraseña." : "No se pudo completar el registro." }, result.status);
    }
    return respond({ ok: true, mensaje: "Revisa tu correo para confirmar la cuenta." });
  } catch (e) {
    console.error("registro-dni:", e instanceof Error ? e.message : "error");
    return respond({ error: e instanceof Error && e.name === "AbortError" ? "La consulta tardó demasiado." : e instanceof Error ? e.message : "No se pudo completar la solicitud." }, 400);
  }
});
