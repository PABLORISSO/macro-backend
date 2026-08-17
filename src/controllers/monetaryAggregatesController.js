const {
  fetchMonetaryAggregates,
  fetchMonetaryCatalog,
} = require("../services/monetaryAggregatesService");

async function getMonetaryAggregates(req, res) {
  try {
    const { desde, frecuencia, limit } = req.query;

    const data = await fetchMonetaryAggregates({
      desde,
      frecuencia,
      limit: limit ? Number(limit) : undefined,
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: "Error al obtener agregados monetarios",
      detalle: error.message,
    });
  }
}

async function getMonetaryCatalog(req, res) {
  try {
    const data = await fetchMonetaryCatalog();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: "Error al obtener catálogo monetario",
      detalle: error.message,
    });
  }
}

module.exports = { getMonetaryAggregates, getMonetaryCatalog };
