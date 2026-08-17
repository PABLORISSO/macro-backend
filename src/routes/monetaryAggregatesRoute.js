const express = require("express");
const router = express.Router();
const {
  getMonetaryAggregates,
  getMonetaryCatalog,
} = require("../controllers/monetaryAggregatesController");

router.get("/agregados-monetarios", getMonetaryAggregates);
router.get("/agregados-monetarios/catalogo", getMonetaryCatalog);

module.exports = router;
