const express = require("express");
const router = express.Router();
const { getEmaeSectores } = require("../controllers/emaeSectoresController");

router.get("/", getEmaeSectores);

module.exports = router;
