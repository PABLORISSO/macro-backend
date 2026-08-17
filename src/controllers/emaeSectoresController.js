const { obtenerEmaeSectores } = require("../services/emaeSectoresService");

async function getEmaeSectores(req, res) {
  try {
    const datos = await obtenerEmaeSectores();

    // Último período disponible
    const ultimaFecha = datos.reduce(
      (max, d) => (d.fecha > max ? d.fecha : max),
      ""
    );

    // Filtrar solo el último mes para el gráfico de barras
    const ultimoPeriodo = datos.filter((d) => d.fecha === ultimaFecha);

    // Ordenar por var_interanual descendente
    ultimoPeriodo.sort(
      (a, b) => (b.var_interanual ?? 0) - (a.var_interanual ?? 0)
    );

    return res.json({
      fuente: "INDEC (procesado propio)",
      indicador: "EMAE por sector de actividad",
      ultimaFecha,
      sectores: ultimoPeriodo,
      // También exponer el histórico completo para uso futuro
      historico: datos,
    });
  } catch (err) {
    console.error("Error en getEmaeSectores:", err.message);
    return res.status(500).json({ error: "Error al obtener EMAE por sectores" });
  }
}

module.exports = { getEmaeSectores };
