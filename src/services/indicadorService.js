const indicadores = require("../data/indicators.json");

const obtenerIndicadores = () => {
  return indicadores;
};

module.exports = { obtenerIndicadores };