const { obtenerConsumo } = require("../services/consumoService");
const { fetchBcraVariable } = require("../services/bcraService");

const getConsumo = async (req, res) => {
  try {
    const data = obtenerConsumo();

    // opcional: obtener serie de salario desde BCRA si está configurada
    const salarioVarId = process.env.BCRA_SALARIO_VARIABLE_ID;
    if (salarioVarId) {
      try {
        const serie = await fetchBcraVariable(salarioVarId, req.query.desde || "1990-01-01");
        data.salarioSerie = serie;
      } catch (err) {
        // no bloquear respuesta por fallo en BCRA; adjuntar error para debugging
        data.salarioSerie = [];
        data.salarioSerieError = err.message;
      }
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener la información de consumo" });
  }
};

module.exports = { getConsumo };
