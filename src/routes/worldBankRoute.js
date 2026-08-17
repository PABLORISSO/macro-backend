// Rutas para World Bank API
const express = require("express");
const router = express.Router();
const {
  fetchWorldBankIndicator,
  fetchMultipleIndicators,
  fetchDashboardIndicators,
  fetchRegionalComparison,
  INDICADORES,
} = require("../services/worldBankService");

/**
 * GET /api/worldbank/dashboard
 * Obtiene los indicadores clave para el dashboard de economía internacional
 */
router.get("/dashboard", async (req, res) => {
  try {
    const data = await fetchDashboardIndicators();
    res.json(data);
  } catch (error) {
    console.error("Error en /worldbank/dashboard:", error.message);
    res.status(500).json({ error: "No se pudo obtener indicadores World Bank" });
  }
});

/**
 * GET /api/worldbank/indicator/:code
 * Obtiene un indicador específico de World Bank
 * Parámetros query:
 * - mrv: últimos N años (default: 10)
 * - dateRange: rango de años (ej: 2015:2023)
 */
router.get("/indicator/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const { mrv, dateRange } = req.query;

    const options = {
      ...(mrv && { mrv: parseInt(mrv) }),
      ...(dateRange && { dateRange }),
    };

    const data = await fetchWorldBankIndicator(code, options);
    res.json(data);
  } catch (error) {
    console.error(`Error en /worldbank/indicator/:`, error.message);
    res.status(500).json({ error: "No se pudo obtener el indicador" });
  }
});

/**
 * GET /api/worldbank/indicators
 * Obtiene múltiples indicadores
 * Parámetros query:
 * - codes: código de indicadores separados por coma (ej: NY.GDP.MKTP.KD.ZG,FP.CPI.TOTL.ZG)
 * - mrv: últimos N años
 */
router.get("/indicators", async (req, res) => {
  try {
    const { codes, mrv, country = "arg" } = req.query;

    if (!codes) {
      return res.status(400).json({ error: "Se requiere parámetro 'codes'" });
    }

    const indicatorCodes = codes.split(",").map((c) => c.trim());
    const options = {
      ...(mrv && { mrv: parseInt(mrv) }),
    };

    const data = await fetchMultipleIndicators(indicatorCodes, options);
    res.json({
      pais: country.toUpperCase(),
      indicadores: data,
      fuente: "World Bank",
    });
  } catch (error) {
    console.error("Error en /worldbank/indicators:", error.message);
    res.status(500).json({ error: "No se pudo obtener los indicadores" });
  }
});

/**
 * GET /api/worldbank/regional
 * Comparativa regional para un indicador
 * Parámetros query:
 * - indicator: código del indicador (default: NY.GDP.MKTP.KD.ZG)
 * - countries: países separados por coma (default: ar,br,chl,col)
 */
router.get("/regional", async (req, res) => {
  try {
    const { indicator = "NY.GDP.MKTP.KD.ZG", countries = "ar,br,chl,col" } = req.query;

    const countryList = countries
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    if (!countryList.length) {
      return res.status(400).json({ error: "Se requiere al menos un país" });
    }

    const data = await fetchRegionalComparison(indicator, countryList);
    res.json(data);
  } catch (error) {
    console.error("Error en /worldbank/regional:", error.message);
    res.status(500).json({ error: "No se pudo obtener comparativa regional" });
  }
});

/**
 * GET /api/worldbank/available
 * Lista todos los indicadores disponibles
 */
router.get("/available", (req, res) => {
  const indicadores = Object.entries(INDICADORES).map(([key, code]) => ({
    key,
    code,
  }));

  res.json({
    pais: "Argentina",
    indicadores,
    total: indicadores.length,
    ejemplo: {
      endpoint: "/api/worldbank/indicator/NY.GDP.MKTP.KD.ZG",
      parametros: "?mrv=10",
    },
  });
});

module.exports = router;
