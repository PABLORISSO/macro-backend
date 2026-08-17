const { fetchReserves } = require("../services/reserveService");

async function getReserves(req, res) {
  try {
    const data = await fetchReserves();
    res.json(data);
  } catch (error) {
    console.error("ERROR RESERVAS:", error.message);
    res.status(500).json({
      error: "Error al obtener reservas",
      detalle: error.message,
    });
  }
}

module.exports = { getReserves };