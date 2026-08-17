const {
  fetchImportaciones,
  fetchExportaciones,
  fetchDesgloseComercioExterior,
} = require("../services/comercioExteriorService");

async function getImportaciones(req, res) {
  try {
    const { desde, hasta, limit } = req.query;
    const data = await fetchImportaciones({ desde, hasta, limit });
    res.json(data);
  } catch (error) {
    console.error("Error en getImportaciones:", error.message);
    res.status(500).json({
      error: "Error al obtener importaciones",
      detalle: error.message,
    });
  }
}

async function getExportaciones(req, res) {
  try {
    const { desde, hasta, limit } = req.query;
    const data = await fetchExportaciones({ desde, hasta, limit });
    res.json(data);
  } catch (error) {
    console.error("Error en getExportaciones:", error.message);
    res.status(500).json({
      error: "Error al obtener exportaciones",
      detalle: error.message,
    });
  }
}

async function getDesgloseComercio(req, res) {
  try {
    const { desde, hasta, limit } = req.query;
    const data = await fetchDesgloseComercioExterior({ desde, hasta, limit });
    res.json(data);
  } catch (error) {
    console.error("Error en getDesgloseComercio:", error.message);
    res.status(500).json({
      error: "Error al obtener desglose de comercio exterior",
      detalle: error.message,
    });
  }
}



module.exports = {
  getImportaciones,
  getExportaciones,
  getDesgloseComercio,
};
