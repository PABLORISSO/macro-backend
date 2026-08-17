const WORLD_BANK_BASE_URL = "https://api.worldbank.org/v2/country/AR/indicator";

const INDICADOR_IMPORTACIONES = "NE.IMP.GNFS.CD";
const INDICADOR_EXPORTACIONES = "NE.EXP.GNFS.CD";
const INDICADOR_IMPORTACIONES_BIENES = "TM.VAL.MRCH.CD.WT";
const INDICADOR_IMPORTACIONES_SERVICIOS = "BM.GSR.NFSV.CD";
const INDICADOR_EXPORTACIONES_BIENES = "TX.VAL.MRCH.CD.WT";
const INDICADOR_EXPORTACIONES_SERVICIOS = "BX.GSR.NFSV.CD";

async function fetchWorldBankSeries(indicatorId, { desde, hasta, limit = 30 } = {}) {
  const url = `${WORLD_BANK_BASE_URL}/${indicatorId}?format=json&per_page=200`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo obtener la serie ${indicatorId}`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.[1]) ? payload[1] : [];

  let datos = rows
    .filter((item) => item?.value != null && item?.date)
    .map((item) => ({
      fecha: String(item.date),
      valor: Number(item.value),
    }))
    .filter((item) => Number.isFinite(item.valor));

  if (desde) {
    datos = datos.filter((item) => Number(item.fecha) >= Number(desde));
  }

  if (hasta) {
    datos = datos.filter((item) => Number(item.fecha) <= Number(hasta));
  }

  datos.sort((a, b) => Number(a.fecha) - Number(b.fecha));

  if (limit && Number.isFinite(Number(limit)) && Number(limit) > 0) {
    datos = datos.slice(-Number(limit));
  }

  return {
    fuente: "World Bank Open Data",
    pais: "Argentina",
    frecuencia: "anual",
    indicatorId,
    datos,
    ultimoDato: datos[datos.length - 1] || null,
  };
}

function fetchImportaciones(params = {}) {
  return fetchWorldBankSeries(INDICADOR_IMPORTACIONES, params);
}

function fetchExportaciones(params = {}) {
  return fetchWorldBankSeries(INDICADOR_EXPORTACIONES, params);
}

async function fetchDesgloseComercioExterior(params = {}) {
  const [impTotal, impBienes, impServicios, expTotal, expBienes, expServicios] =
    await Promise.all([
      fetchWorldBankSeries(INDICADOR_IMPORTACIONES, params),
      fetchWorldBankSeries(INDICADOR_IMPORTACIONES_BIENES, params),
      fetchWorldBankSeries(INDICADOR_IMPORTACIONES_SERVICIOS, params),
      fetchWorldBankSeries(INDICADOR_EXPORTACIONES, params),
      fetchWorldBankSeries(INDICADOR_EXPORTACIONES_BIENES, params),
      fetchWorldBankSeries(INDICADOR_EXPORTACIONES_SERVICIOS, params),
    ]);

  return {
    fuente: "World Bank Open Data",
    pais: "Argentina",
    frecuencia: "anual",
    importaciones: {
      total: impTotal,
      bienes: impBienes,
      servicios: impServicios,
    },
    exportaciones: {
      total: expTotal,
      bienes: expBienes,
      servicios: expServicios,
    },
  };
}

module.exports = {
  fetchImportaciones,
  fetchExportaciones,
  fetchDesgloseComercioExterior,
  INDICADOR_IMPORTACIONES,
  INDICADOR_EXPORTACIONES,
  INDICADOR_IMPORTACIONES_BIENES,
  INDICADOR_IMPORTACIONES_SERVICIOS,
  INDICADOR_EXPORTACIONES_BIENES,
  INDICADOR_EXPORTACIONES_SERVICIOS,
};
