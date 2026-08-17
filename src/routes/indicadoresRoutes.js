const express = require("express");
const router = express.Router();
const { getIndicadores } = require("../controllers/indicadoresController");

router.get("/", getIndicadores);

module.exports = router;