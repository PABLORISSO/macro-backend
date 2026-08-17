async function fetchReserves() {
  const url =
    "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/1?Desde=2024-01-01";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error BCRA reservas: ${response.status}`);
  }

  const json = await response.json();

  console.log("JSON RESERVAS BCRA:", JSON.stringify(json, null, 2));

  const detalle = json?.results?.[0]?.detalle;

  if (!Array.isArray(detalle) || detalle.length === 0) {
    throw new Error("La API devolvió reservas sin detalle o vacío");
  }

  const datosOrdenados = detalle
    .map((item) => ({
      fecha: item.fecha,
      valor: item.valor,
    }))
    .filter((item) => item.fecha && item.valor != null)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const porMes = new Map();

  for (const item of datosOrdenados) {
    const mes = item.fecha.slice(0, 7);
    porMes.set(mes, item);
  }

  const datosMensuales = Array.from(porMes.values()).slice(-24);
  const ultimoDato = datosMensuales[datosMensuales.length - 1] || null;

  return {
    ultimoDato,
    datos: datosMensuales,
  };
}

module.exports = { fetchReserves };