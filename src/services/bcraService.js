const fetch = global.fetch || require('node-fetch');

async function fetchBcraVariable(idVariable, desde = '1990-01-01') {
  const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${desde}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`BCRA API error ${response.status} for variable ${idVariable}`);
  }

  const json = await response.json();
  const detalle = json?.results?.[0]?.detalle || [];

  return detalle
    .map((item) => ({ fecha: String(item.fecha || '').slice(0, 10), valor: Number(item.valor) }))
    .filter((d) => d.fecha && Number.isFinite(d.valor))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

module.exports = { fetchBcraVariable };
