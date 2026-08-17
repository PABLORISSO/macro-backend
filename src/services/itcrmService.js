// Índice de Tipo de Cambio Real Multilateral (ITCRM)
// Fuente: datos.gob.ar / BCRA – Base 17-Dic-2015 = 100
// Serie diaria actualizada: 116.4_TCRZE_2015_D_36_4

const fs = require("fs");
const path = require("path");

const SERIES_ID = "116.4_TCRZE_2015_D_36_4";
const BASE_URL = "https://apis.datos.gob.ar/series/api/series";
const LOCAL_DAILY_CSV = path.join(__dirname, "..", "data", "itcrm", "itcrm_diario.csv");
const LOCAL_MONTHLY_CSV = path.join(__dirname, "..", "data", "itcrm", "itcrm_mensual.csv");

let cache = null;
let cacheTs = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas

function leerCsvLocal(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return null;

  const rows = lines.slice(1)
    .map((line) => line.split(",").map((part) => part.trim()))
    .filter((parts) => parts.length >= 2)
    .map(([fecha, valor]) => ({
      fecha,
      valor: Number(valor),
    }))
    .filter((row) => row.fecha && Number.isFinite(row.valor))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return rows.length ? rows : null;
}

function obtenerMes(fecha) {
  return String(fecha || "").slice(0, 7);
}

function completarMensualConDiario(mensual, diario) {
  const resultado = Array.isArray(mensual) ? [...mensual] : [];
  const mesesExistentes = new Set(resultado.map((row) => obtenerMes(row.fecha)));
  const mesActual = new Date().toISOString().slice(0, 7);

  const porMes = new Map();
  for (const row of Array.isArray(diario) ? diario : []) {
    const mes = obtenerMes(row.fecha);
    if (!mes) continue;
    porMes.set(mes, row);
  }

  const mesesDiarios = [...porMes.keys()].sort();
  for (const mes of mesesDiarios) {
    // Solo completar meses cerrados (evita mes en curso parcial)
    if (mes >= mesActual) continue;
    if (mesesExistentes.has(mes)) continue;
    const row = porMes.get(mes);
    if (!row) continue;
    resultado.push(row);
  }

  return resultado.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

async function resolverITCRMLocal(frecuencia) {
  const diario = leerCsvLocal(LOCAL_DAILY_CSV);
  const mensualBase = leerCsvLocal(LOCAL_MONTHLY_CSV);

  if (frecuencia === "diaria") {
    if (!diario) return null;
    return {
      fuente: "BCRA / CSV local",
      frecuencia,
      datos: diario,
      ultimoDato: diario[diario.length - 1] ?? null,
    };
  }

  if (!mensualBase && !diario) return null;

  const datos = completarMensualConDiario(mensualBase || [], diario || []);

  if (!datos) return null;

  return {
    fuente: "BCRA / CSV local",
    frecuencia,
    datos,
    ultimoDato: datos[datos.length - 1] ?? null,
  };
}

async function fetchITCRM(options = {}) {
  const ahora = Date.now();
  const limit = Number.isFinite(options.limit) ? options.limit : 1000;
  const frecuencia = options.frecuencia || "mensual"; // "diaria" | "mensual"

  if (!options.desde) {
    const local = await resolverITCRMLocal(frecuencia);

    if (local) {
      if (frecuencia === "mensual") {
        cache = local;
        cacheTs = ahora;
      }

      return local;
    }
  }

  // Cache para la solicitud mensual por defecto (solo si no hubo local disponible)
  if (!options.desde && frecuencia === "mensual" && cache && ahora - cacheTs < CACHE_TTL) {
    return cache;
  }

  // Construir URL — usar collapse nativo para el modo mensual
  const params = new URLSearchParams({
    ids: SERIES_ID,
    limit: String(limit),
    sort: "asc",
  });
  if (frecuencia === "mensual") {
    params.set("collapse", "month");
  }
  if (options.desde) params.set("start_date", options.desde);

  const url = `${BASE_URL}/?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error datos.gob.ar: ${response.status}`);
  }

  const json = await response.json();

  // datos.gob.ar devuelve: { data: [[fecha, valor], ...], meta: [...] }
  const raw = json?.data ?? [];

  const datos = raw
    .map(([fecha, valor]) => ({
      fecha,
      valor: valor !== null ? Number(valor) : null,
    }))
    .filter((d) => d.fecha && d.valor !== null && Number.isFinite(d.valor));

  const resultado = {
    fuente: "BCRA / datos.gob.ar — Índice de Tipo de Cambio Real Multilateral (Base 17-Dic-2015=100)",
    frecuencia,
    datos,
    ultimoDato: datos[datos.length - 1] ?? null,
  };

  if (!options.desde && frecuencia === "mensual") {
    cache = resultado;
    cacheTs = ahora;
  }

  return resultado;
}

module.exports = { fetchITCRM };
