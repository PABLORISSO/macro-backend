const express = require("express");
const {
	getImportaciones,
	getExportaciones,
	getDesgloseComercio,
} = require("../controllers/comercioExteriorController");

const router = express.Router();

router.get("/importaciones", getImportaciones);
router.get("/exportaciones", getExportaciones);
router.get("/desglose", getDesgloseComercio);

module.exports = router;
