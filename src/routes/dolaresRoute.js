const express = require("express");
const router = express.Router();
const {
  getHistoricalExchangeRateSeries,
} = require("../services/exchangeRateService");
const { getLegacyCotizacionesDolares } = require("../controllers/exchangeRateController");

router.get("/dolares/cotizaciones", getLegacyCotizacionesDolares);

router.get("/dolares/historico/mep", async (req, res) => {
  try {
    const data = getHistoricalExchangeRateSeries("mep", {
      desde: req.query.desde,
      hasta: req.query.hasta,
      frecuencia: req.query.frecuencia,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(data.datos.map((item) => ({ fecha: item.fecha, venta: item.valor })));
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get("/dolares/historico/ccl", async (req, res) => {
  try {
    const data = getHistoricalExchangeRateSeries("ccl", {
      desde: req.query.desde,
      hasta: req.query.hasta,
      frecuencia: req.query.frecuencia,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(data.datos.map((item) => ({ fecha: item.fecha, venta: item.valor })));
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
