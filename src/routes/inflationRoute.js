const express = require("express");
const router = express.Router();
const { getInflacion, getInflacionCategorias, getInflacionRegiones, getInflacionRegionesInteranual, getInteranualNivelGeneralConceptos } = require("../controllers/inflationController");

router.get("/", getInflacion);
router.get("/categorias", getInflacionCategorias);
router.get("/regiones", getInflacionRegiones);
router.get("/regiones/interanual", getInflacionRegionesInteranual);
router.get("/interanual/conceptos", getInteranualNivelGeneralConceptos);

module.exports = router;