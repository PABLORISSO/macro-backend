const { obtenerEmae } = require("../services/emaeService");

async function getEmae(req, res) {
  try {
    const { startDate } = req.query;
    const data = await obtenerEmae({ startDate });
    res.status(200).json(data);
  } catch (error) {
    console.error("Error en getEmae:", error.message);
    res.status(500).json({ error: "No se pudo obtener el EMAE" });
  }
}

module.exports = { getEmae };
