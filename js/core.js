"use strict";
const $ = (s) => document.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    n,
  );
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function distanciaKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v === null || v === undefined))
    return null;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function distritoCoords(id) {
  const d = catalogs.distritos.find((x) => x.id === id);
  return d && d.latitud != null && d.longitud != null
    ? { lat: d.latitud, lon: d.longitud }
    : null;
}
function kmDesdeMiDistrito(distritoIdDestino) {
  if (!profile?.distrito_id || !distritoIdDestino) return null;
  const origen = distritoCoords(profile.distrito_id);
  const destino = distritoCoords(distritoIdDestino);
  return origen && destino
    ? distanciaKm(origen.lat, origen.lon, destino.lat, destino.lon)
    : null;
}

function ordenarPorDistancia(rows) {
  return rows
    .map((r) => ({ r, km: kmDesdeMiDistrito(r.distrito_id) }))
    .sort((a, b) => {
      if (a.km === null && b.km === null) return 0;
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km;
    })
    .map((x) => x.r);
}

let inboxPeer = null;
let toastTimer,
  inboxTimer,
  inboxRows = [],
  inboxPending = false,
  sessionOwner = null,
  messagesPending = false;
let db,
  user,
  profile,
  catalogs = { distritos: [], oficios: [] },
  mode = "trabajadores",
  activeView = "explorar",
  conversation,
  chatTimer,
  modalAction,
  searchGeneration = 0;

let userSkills = [];

function modeStorageKey() {
  return user ? `chambacerca_modo_${user.id}` : null;
}

function getSavedMode() {
  const key = modeStorageKey();
  return key ? localStorage.getItem(key) : null;
}

function saveMode(value) {
  const key = modeStorageKey();
  if (key) localStorage.setItem(key, value);
}

const notice = (msg, error = false) => {
  clearTimeout(toastTimer);
  $("#notice").textContent = msg;
  $("#notice").classList.toggle("error", error);
  $("#notice").hidden = false;
  toastTimer = setTimeout(() => {
    $("#notice").hidden = true;
  }, 2000);
};
const checked = async (request) => {
  const { data, error } = await request;
  if (error) throw error;
  return data;
};
function requireDB() {
  if (!db)
    throw new Error(
      "Primero configura js/config.js con la URL y la clave publicable de Supabase. Consulta LEEME.md.",
    );
}
function requireUser() {
  requireDB();
  if (!user) throw new Error("Inicia sesión para continuar.");
}
function errorText(e) {
  if (e.code === "23505")
    return "Ya existe este registro: no puedes postular o calificar dos veces el mismo trabajo.";
  if (e.message === "Invalid login credentials")
    return "Correo o contraseña incorrectos.";
  if (e.message === "Email not confirmed")
    return "Confirma tu correo antes de ingresar.";
  return e.message || "No se pudo completar la operación.";
}
async function run(fn, button) {
  try {
    if (button) {
      button.disabled = true;
      const feedback = button.closest("form")?.querySelector(".form-feedback");
      if (feedback) feedback.remove();
    }
    await fn();
  } catch (e) {
    notice(errorText(e), true);
    const form = button?.closest("form");
    if (form) {
      let feedback = form.querySelector(".form-feedback");
      if (!feedback) {
        feedback = document.createElement("p");
        feedback.className = "form-feedback";
        feedback.setAttribute("role", "alert");
        form.append(feedback);
      }
      feedback.textContent = errorText(e);
    }
  } finally {
    if (button) button.disabled = false;
  }
}
function onSubmit(id, fn) {
  $(id).addEventListener("submit", (e) => {
    e.preventDefault();
    run(() => fn(new FormData(e.target), e.target), e.submitter);
  });
}
function nameOf(table, id) {
  return catalogs[table].find((x) => x.id === Number(id))?.nombre || "";
}
function fillSelect(node, rows, empty) {
  node.innerHTML =
    `<option value="">${empty}</option>` +
    rows
      .map((r) => `<option value="${r.id}">${esc(r.nombre)}</option>`)
      .join("");
}
