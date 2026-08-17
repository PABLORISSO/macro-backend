const express = require("express");
const router = express.Router();
const { getConsumo } = require("../controllers/consumoController");

router.get("/consumo", getConsumo);

module.exports = router;
