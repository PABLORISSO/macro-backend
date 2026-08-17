const express = require("express");
const router = express.Router();
const { getEmae } = require("../controllers/emaeController");

router.get("/", getEmae);

module.exports = router;
