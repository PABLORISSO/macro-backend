const {
  analizarDolarMepMayorista,
  analizarActividadEconomica,
  analizarActividadDinamica,
} = require("../services/aiAnalysisService");
const { fetchExchangeRate } = require("../services/exchangeRateService");

// Cache en memoria: se regenera una vez por día
let cache = null;

function cacheVigente() {
  if (!cache) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaCache = new Date(cache.timestamp).toISOString().slice(0, 10);
  return hoy === fechaCache;
}

async function getAnalisisDolar(req, res) {
  try {
    // Si hay cache del día de hoy, devolver directo
    if (cacheVigente()) {
      return res.json({ ...cache, fromCache: true });
    }

    const exchangePayload = await fetchExchangeRate({
      desde: "2025-01-01",
      frecuencia: "diaria",
      limit: 300,
    });

    const mayoristData = exchangePayload?.datos || [];
    const mayoristActual = mayoristData[mayoristData.length - 1]?.valor;

    // Aquí debería traer MEP/CCL actuales, pero como vienen de API externa,
    // por ahora usamos un proxy o dejamos fallback
    const mepActual = req.body?.mepActual || mayoristActual * 1.05; // aproximado

    if (!mayoristActual || !mepActual) {
      return res.status(400).json({
        error: "Faltan datos de cotización para análisis",
      });
    }

    const analisis = await analizarDolarMepMayorista({
      mepActual,
      mayoristActual,
      mepHistorico: mayoristData.slice(-30),
      mayoristHistorico: mayoristData.slice(-30),
    });

    // Guardar en cache
    cache = analisis;

    res.json({ ...analisis, fromCache: false });
  } catch (error) {
    console.error("Error en getAnalisisDolar:", error.message);
    const isAiUnavailable = /ECONNREFUSED|fetch failed|ENOTFOUND|timeout/i.test(
      error.message || ""
    );
    const status = isAiUnavailable ? 503 : 500;
    res.status(status).json({
      error: isAiUnavailable
        ? "Servicio de IA no disponible"
        : "Error al generar análisis",
      detalle: error.message,
    });
  }
}

// Cache para agregados monetarios
let cacheAgregados = null;

function cacheAgregadosVigente() {
  if (!cacheAgregados) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaCache = new Date(cacheAgregados.timestamp).toISOString().slice(0, 10);
  return hoy === fechaCache;
}

async function getAnalisisAgregados(req, res) {
  try {
    if (cacheAgregadosVigente()) {
      return res.json({ ...cacheAgregados, fromCache: true });
    }

    const { fetchMonetaryAggregates } = require("../services/monetaryAggregatesService");
    const { analizarAgregadosMonetarios } = require("../services/aiAnalysisService");

    const data = await fetchMonetaryAggregates({
      desde: "2025-01-01",
      frecuencia: "diaria",
      limit: 30,
    });

    const seriesVisibles = (data.series || []).filter((s) => !s._interno);

    const resultado = await analizarAgregadosMonetarios({ series: seriesVisibles });

    cacheAgregados = resultado;
    return res.json({ ...resultado, fromCache: false });
  } catch (error) {
    console.error("Error en getAnalisisAgregados:", error.message);
    const isAiUnavailable = /ECONNREFUSED|fetch failed|ENOTFOUND|timeout/i.test(
      error.message || ""
    );
    const status = isAiUnavailable ? 503 : 500;
    res.status(status).json({
      error: isAiUnavailable
        ? "Servicio de IA no disponible"
        : "Error al generar análisis de agregados",
      detalle: error.message,
    });
  }
}

let cacheActividad = null;
let cacheActividadDinamica = null;

function cacheActividadVigente() {
  if (!cacheActividad) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaCache = new Date(cacheActividad.timestamp).toISOString().slice(0, 10);
  return hoy === fechaCache;
}

function cacheActividadDinamicaVigente(payloadKey) {
  if (!cacheActividadDinamica) return false;
  return cacheActividadDinamica.key === payloadKey;
}

async function getAnalisisActividad(req, res) {
  try {
    if (cacheActividadVigente()) {
      return res.json({ ...cacheActividad, fromCache: true });
    }

    const {
      fecha,
      varInteranual,
      varMensual,
      varTendencia,
      nivelEmae,
      nivelDesestacionalizado,
      nivelTendencia,
    } = req.body || {};

    if (
      !fecha ||
      typeof varInteranual !== "number" ||
      typeof nivelEmae !== "number" ||
      typeof nivelDesestacionalizado !== "number" ||
      typeof nivelTendencia !== "number"
    ) {
      return res.status(400).json({ error: "Faltan datos para análisis de actividad" });
    }

    const resultado = await analizarActividadEconomica({
      fecha,
      varInteranual,
      varMensual: typeof varMensual === "number" ? varMensual : 0,
      varTendencia: typeof varTendencia === "number" ? varTendencia : 0,
      nivelEmae,
      nivelDesestacionalizado,
      nivelTendencia,
    });

    cacheActividad = resultado;
    return res.json({ ...resultado, fromCache: false });
  } catch (error) {
    console.error("Error en getAnalisisActividad:", error.message);
    const isAiUnavailable = /ECONNREFUSED|fetch failed|ENOTFOUND|timeout/i.test(
      error.message || ""
    );
    const status = isAiUnavailable ? 503 : 500;
    return res.status(status).json({
      error: isAiUnavailable
        ? "Servicio de IA no disponible"
        : "Error al generar análisis de actividad",
      detalle: error.message,
    });
  }
}

async function getAnalisisActividadDinamica(req, res) {
  try {
    const {
      fecha,
      varInteranual,
      varMensual,
      historialReciente = [],
    } = req.body || {};

    if (
      !fecha ||
      typeof varInteranual !== "number" ||
      typeof varMensual !== "number"
    ) {
      return res.status(400).json({ error: "Faltan datos para análisis de dinámica" });
    }

    const payloadKey = JSON.stringify({
      fecha,
      varInteranual,
      varMensual,
      historialReciente,
    });

    if (cacheActividadDinamicaVigente(payloadKey)) {
      return res.json({ ...cacheActividadDinamica.value, fromCache: true });
    }

    const resultado = await analizarActividadDinamica({
      fecha,
      varInteranual,
      varMensual,
      historialReciente,
    });

    cacheActividadDinamica = {
      key: payloadKey,
      value: resultado,
    };

    return res.json({ ...resultado, fromCache: false });
  } catch (error) {
    console.error("Error en getAnalisisActividadDinamica:", error.message);
    const isAiUnavailable = /ECONNREFUSED|fetch failed|ENOTFOUND|timeout/i.test(
      error.message || ""
    );
    const status = isAiUnavailable ? 503 : 500;
    return res.status(status).json({
      error: isAiUnavailable
        ? "Servicio de IA no disponible"
        : "Error al generar análisis de dinámica",
      detalle: error.message,
    });
  }
}

async function getChatInflacion(req, res) {
  try {
    const { pregunta, contexto = {}, historial = [] } = req.body || {};
    if (!pregunta || typeof pregunta !== "string" || !pregunta.trim()) {
      return res.status(400).json({ error: "Falta la pregunta" });
    }
    const { chatInflacion } = require("../services/aiAnalysisService");
    const resultado = await chatInflacion({ pregunta: pregunta.trim(), contexto, historial });
    return res.json(resultado);
  } catch (error) {
    console.error("Error en getChatInflacion:", error.message);
    const isAiUnavailable = /ECONNREFUSED|fetch failed|ENOTFOUND|timeout/i.test(error.message || "");
    const status = isAiUnavailable ? 503 : 500;
    return res.status(status).json({
      error: isAiUnavailable ? "Servicio de IA no disponible" : "Error al responder pregunta",
      detalle: error.message,
    });
  }
}

module.exports = {
  getAnalisisDolar,
  getAnalisisAgregados,
  getAnalisisActividad,
  getAnalisisActividadDinamica,
  getChatInflacion,
};
