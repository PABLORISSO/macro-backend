const express = require("express");
const router = express.Router();
const {
	getAnalisisDolar,
	getAnalisisAgregados,
	getAnalisisActividad,
	getAnalisisActividadDinamica,
	getChatInflacion,
} = require("../controllers/aiAnalysisController");

router.post("/analisis-dolar", getAnalisisDolar);
router.post("/analisis-agregados", getAnalisisAgregados);
router.post("/analisis-actividad", getAnalisisActividad);
router.post("/analisis-actividad-dinamica", getAnalisisActividadDinamica);
router.post("/chat-inflacion", getChatInflacion);

module.exports = router;
