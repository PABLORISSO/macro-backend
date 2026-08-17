const BASE_URL = "https://apis.datos.gob.ar/series/api/series";
const IPC_SERIE_ID = "148.3_INIVELNAL_DICI_M_26";

async function getIpcMensual({ startDate = "2020-01", limit = 1000 } = {}) {
  const params = new URLSearchParams({
    ids: IPC_SERIE_ID,
    representation_mode: "percent_change",
    start_date: startDate,
    sort: "asc",
    limit: String(limit),
    format: "json",
    metadata: "simple",
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error("No se pudo obtener la serie IPC");
  }

  return response.json();
}

module.exports = {
  getIpcMensual,
  IPC_SERIE_ID,
};