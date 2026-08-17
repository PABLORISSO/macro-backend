const express = require("express");
const router = express.Router();
const {
	getCatalogoTipoCambio,
	getCotizacionesActuales,
	getExchangeRate,
	getHistoricoSerie,
	getTablaTipoCambio,
} = require("../controllers/exchangeRateController");

router.get("/tipo-cambio/series", getCatalogoTipoCambio);
router.get("/tipo-cambio/cotizaciones", getCotizacionesActuales);
router.get("/tipo-cambio/tabla", getTablaTipoCambio);
router.get("/tipo-cambio/series/:nombre", getHistoricoSerie);
router.get("/tipo-cambio", getExchangeRate);

module.exports = router;