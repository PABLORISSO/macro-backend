const express = require("express");
const router = express.Router();

const {
  obtenerDashboardLatam,
} = require("../services/internationalService");

router.get("/latam", async (req, res) => {
  try {
    const data = await obtenerDashboardLatam();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error obteniendo dashboard internacional",
    });
  }
});

module.exports = router;