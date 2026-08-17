const { obtenerIndicadores } = require("../services/indicadorService");

const getIndicadores = (req, res) => {
  try {
    const indicadores = obtenerIndicadores();
    res.status(200).json(indicadores);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron obtener los indicadores" });
  }
};

module.exports = { getIndicadores };