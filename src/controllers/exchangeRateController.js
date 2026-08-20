const {
  fetchExchangeRate,
  getCurrentExchangeRatesTable,
  getExchangeRateSeriesCatalog,
  getExchangeRateTable,
  getHistoricalExchangeRateSeries,
  getLegacyDollarQuotes,
} = require("../services/exchangeRateService");

const { getHistoricalSeriesFromDb } = require("../services/dbExchangeRateService");

function handleExchangeRateError(error, res, fallbackMessage) {
  const statusCode = error?.statusCode || 500;
  if (statusCode >= 500) {
    console.error("Error tipo de cambio:", error.message);
  }
  return res.status(statusCode).json({ error: fallbackMessage || error.message || "Error interno" });
}

async function getExchangeRate(req, res) {
  try {
    const { desde, hasta, frecuencia, limit, serie } = req.query;

    const data = await fetchExchangeRate({
      serie,
      desde,
      hasta,
      frecuencia,
      limit: limit ? Number(limit) : undefined,
    });

    res.json(data);
  } catch (error) {
    handleExchangeRateError(error, res, "Error al obtener el tipo de cambio");
  }
}

async function getCotizacionesActuales(req, res) {
  try {
    const { familias, series } = req.query;
    const payload = getCurrentExchangeRatesTable({ familias, series });
    res.json(payload);
  } catch (error) {
    handleExchangeRateError(error, res, "Error al obtener cotizaciones actuales");
  }
}

async function getHistoricoSerie(req, res) {
  try {
    const { nombre } = req.params;
    const { desde, hasta, frecuencia, limit } = req.query;

    // Intentar consulta a la Base de Datos PostgreSQL (Supabase) primero
    const dbData = await getHistoricalSeriesFromDb(nombre, {
      desde,
      hasta,
      limit: limit ? Number(limit) : undefined,
    }).catch(() => null);

    if (dbData && dbData.length > 0) {
      return res.json({
        fuente: "PostgreSQL (Supabase)",
        serie: nombre,
        total: dbData.length,
        datos: dbData,
      });
    }

    // Fallback a archivos CSV
    const payload = getHistoricalExchangeRateSeries(nombre, {
      desde,
      hasta,
      frecuencia,
      limit: limit ? Number(limit) : undefined,
    });

    res.json(payload);
  } catch (error) {
    handleExchangeRateError(error, res, "Error al obtener serie histórica");
  }
}


async function getTablaTipoCambio(req, res) {
  try {
    const { series, desde, hasta, frecuencia, limit, orden } = req.query;
    const payload = getExchangeRateTable({
      series,
      desde,
      hasta,
      frecuencia,
      orden,
      limit: limit ? Number(limit) : undefined,
    });

    res.json(payload);
  } catch (error) {
    handleExchangeRateError(error, res, "Error al obtener la tabla de tipo de cambio");
  }
}

async function getCatalogoTipoCambio(req, res) {
  try {
    const items = getExchangeRateSeriesCatalog();
    res.json({ total: items.length, items });
  } catch (error) {
    handleExchangeRateError(error, res, "Error al obtener el catálogo de series");
  }
}

async function getLegacyCotizacionesDolares(req, res) {
  try {
    const payload = getLegacyDollarQuotes();
    res.json(payload);
  } catch (error) {
    handleExchangeRateError(error, res, "Error al obtener cotizaciones actuales");
  }
}

module.exports = {
  getExchangeRate,
  getCotizacionesActuales,
  getHistoricoSerie,
  getTablaTipoCambio,
  getCatalogoTipoCambio,
  getLegacyCotizacionesDolares,
};