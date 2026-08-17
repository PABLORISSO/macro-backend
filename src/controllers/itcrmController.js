const { fetchITCRM } = require("../services/itcrmService");

async function getITCRM(req, res) {
  try {
    const { desde, frecuencia, limit } = req.query;

    const data = await fetchITCRM({
      desde,
      frecuencia,
      limit: limit ? Number(limit) : undefined,
    });

    res.json(data);
  } catch (error) {
    console.error("Error ITCRM:", error.message);
    res.status(500).json({ error: "Error al obtener el ITCRM" });
  }
}

module.exports = { getITCRM };
