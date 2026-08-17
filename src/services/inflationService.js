const fs = require("fs");
const path = require("path");
const { getIpcMensual, IPC_SERIE_ID } = require("../clients/indecClient");

const FALLBACK_SERIE = [
  { fecha: "2025-10", inflacionMensual: 3.2 },
  { fecha: "2025-11", inflacionMensual: 2.9 },
  { fecha: "2025-12", inflacionMensual: 2.7 },
  { fecha: "2026-01", inflacionMensual: 2.5 },
  { fecha: "2026-02", inflacionMensual: 2.4 },
  { fecha: "2026-03", inflacionMensual: 2.3 },
];

const CACHE_TTL_MS = 30 * 60 * 1000;
let cacheInflacion = null;
let cacheTimestamp = 0;

const IPC_CSV_PATH = path.join(__dirname, "..", "data", "ipc", "ipc_aperturas_largo.csv");

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizarPorcentaje(valor) {
  if (valor === null || valor === undefined) return null;

  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;

  const porcentaje = Math.abs(numero) <= 1 ? numero * 100 : numero;
  return Number(porcentaje.toFixed(2));
}

function parsearCsvLine(linea) {
  return linea.split(",").map((campo) => campo.trim());
}

function leerSerieLocal() {
  if (!fs.existsSync(IPC_CSV_PATH)) {
    return null;
  }

  const content = fs.readFileSync(IPC_CSV_PATH, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);

  if (lines.length <= 1) {
    return null;
  }

  const rows = lines.slice(1).map(parsearCsvLine).filter((parts) => parts.length >= 8);

  const serie = rows
    .filter((parts) => {
      const region = normalizarTexto(parts[1]);
      const tipoVariacion = normalizarTexto(parts[2]);
      const bloque = normalizarTexto(parts[3]);
      const concepto = normalizarTexto(parts[4]);

      return (
        region === "total nacional" &&
        tipoVariacion.includes("mensual") &&
        bloque === "nivel general" &&
        concepto === "nivel general"
      );
    })
    .map((parts) => ({
      fecha: parts[0],
      inflacionMensual: normalizarPorcentaje(parts[5]),
    }))
    .filter((row) => row.fecha && Number.isFinite(row.inflacionMensual))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return serie.length ? serie : null;
}

function normalizarSerie(apiResponse) {
  const data = Array.isArray(apiResponse?.data) ? apiResponse.data : [];

  return data
    .filter((row) => Array.isArray(row) && row.length >= 2)
    .map(([fecha, valor]) => ({
      fecha,
      inflacionMensual: normalizarPorcentaje(valor),
    }));
}

async function obtenerInflacionMensual() {
  const now = Date.now();
  if (cacheInflacion && now - cacheTimestamp < CACHE_TTL_MS) {
    return cacheInflacion;
  }

  try {
    const serieLocal = leerSerieLocal();

    if (serieLocal && serieLocal.length) {
      const payloadLocal = {
        fuente: "IPC CSV local",
        serieId: IPC_SERIE_ID,
        indicador: "IPC Nivel General Nacional - variación mensual",
        datos: serieLocal,
        ultimoDato: serieLocal[serieLocal.length - 1],
      };

      cacheInflacion = payloadLocal;
      cacheTimestamp = now;
      return payloadLocal;
    }

    const raw = await getIpcMensual({ startDate: "2020-01" });
    const serie = normalizarSerie(raw);

    if (!serie.length) {
      const payloadFallbackVacio = {
        fuente: "Fallback local",
        serieId: IPC_SERIE_ID,
        indicador: "IPC Nivel General Nacional - variación mensual",
        datos: FALLBACK_SERIE,
        ultimoDato: FALLBACK_SERIE[FALLBACK_SERIE.length - 1],
      };

      cacheInflacion = payloadFallbackVacio;
      cacheTimestamp = now;
      return payloadFallbackVacio;
    }

    const payload = {
      fuente: "INDEC / datos.gob.ar",
      serieId: IPC_SERIE_ID,
      indicador: "IPC Nivel General Nacional - variación mensual",
      datos: serie,
      ultimoDato: serie.length ? serie[serie.length - 1] : null,
    };

    cacheInflacion = payload;
    cacheTimestamp = now;
    return payload;
  } catch (error) {
    const payloadFallbackError = {
      fuente: "Fallback local",
      serieId: IPC_SERIE_ID,
      indicador: "IPC Nivel General Nacional - variación mensual",
      datos: FALLBACK_SERIE,
      ultimoDato: FALLBACK_SERIE[FALLBACK_SERIE.length - 1],
      errorFuente: error?.message || "No disponible",
    };

    cacheInflacion = payloadFallbackError;
    cacheTimestamp = now;
    return payloadFallbackError;
  }
}

module.exports = {
  obtenerInflacionMensual,
};



