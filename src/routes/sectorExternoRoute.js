const express = require("express");
const router = express.Router();

const {
  getBienes,
  getBienesCsv,
  getServicios,
  getServiciosCsv,
  getIngresoPrimario,
  getIngresoPrimarioCsv,
  getIngresoSecundario,
  getIngresoSecundarioCsv,
  getCuentaCorriente,
  getCuentaCorrienteCsv,
  getCuentaFinanciera,
  getCuentaFinancieraCsv,
  getCuentaCapital, 
  getCuentaCapitalCsv,
  getResumenBalanzaPagos,
  getResumenBalanzaPagosCsv,
} = require("../controllers/sectorExternoController");

router.get("/bienes", getBienes);
router.get("/bienes/csv", getBienesCsv);

router.get("/resumen-balanza-pagos", getResumenBalanzaPagos);
router.get("/resumen-balanza-pagos/csv", getResumenBalanzaPagosCsv);


router.get("/servicios", getServicios);
router.get("/servicios/csv", getServiciosCsv);

router.get("/ingreso-primario", getIngresoPrimario);
router.get("/ingreso-primario/csv", getIngresoPrimarioCsv);

router.get("/ingreso-secundario", getIngresoSecundario);
router.get("/ingreso-secundario/csv", getIngresoSecundarioCsv);

router.get("/cuenta-corriente", getCuentaCorriente);
router.get("/cuenta-corriente/csv", getCuentaCorrienteCsv);

router.get("/cuenta-financiera", getCuentaFinanciera);
router.get("/cuenta-financiera/csv", getCuentaFinancieraCsv);

router.get("/cuenta-capital", getCuentaCapital);
router.get("/cuenta-capital/csv", getCuentaCapitalCsv);

module.exports = router;
