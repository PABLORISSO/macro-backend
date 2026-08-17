const express = require("express");
const router = express.Router();
const { getITCRM } = require("../controllers/itcrmController");

router.get("/itcrm", getITCRM);

module.exports = router;
