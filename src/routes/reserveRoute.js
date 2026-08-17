const express = require("express");
const router = express.Router();
const { getReserves } = require("../controllers/reserveController");

router.get("/reservas", getReserves);

module.exports = router;