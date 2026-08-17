#!/usr/bin/env node

const SERIES_ID = "116.4_TCRZE_2015_D_36_4";
const BASE_URL = "https://apis.datos.gob.ar/series/api/series";

function getArgs() {
  const args = process.argv.slice(2);
  const out = {
    frecuencia: "mensual", // mensual | diaria
    desde: undefined,
    limit: 5000,
  };

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--frecuencia" && args[i + 1]) {
      out.frecuencia = args[i + 1];
      i += 1;
    } else if (a === "--desde" && args[i + 1]) {
      out.desde = args[i + 1];
      i += 1;
    } else if (a === "--limit" && args[i + 1]) {
      const n = Number(args[i + 1]);
      if (Number.isFinite(n) && n > 0) out.limit = n;
      i += 1;
    }
  }

  return out;
}

async function main() {
  const { frecuencia, desde, limit } = getArgs();

  const params = new URLSearchParams({
    ids: SERIES_ID,
    sort: "asc",
    limit: String(limit),
  });

  if (frecuencia === "mensual") {
    params.set("collapse", "month");
  }

  if (desde) {
    params.set("start_date", desde);
  }

  const url = `${BASE_URL}/?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al consultar datos.gob.ar`);
  }

  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];

  const rows = data
    .map((r) => ({ fecha: r?.[0], valor: Number(r?.[1]) }))
    .filter((r) => r.fecha && Number.isFinite(r.valor));

  if (!rows.length) {
    console.log("Sin datos para los parámetros indicados.");
    return;
  }

  const primera = rows[0];
  const ultima = rows[rows.length - 1];
  const ultimos5 = rows.slice(-5);

  console.log("Serie:", SERIES_ID);
  console.log("Frecuencia:", frecuencia);
  console.log("Registros:", rows.length);
  console.log("Primera fecha:", primera.fecha, "valor:", primera.valor.toFixed(2));
  console.log("Última fecha:", ultima.fecha, "valor:", ultima.valor.toFixed(2));
  console.log("\nÚltimos 5 registros:");
  for (const r of ultimos5) {
    console.log(`- ${r.fecha}: ${r.valor.toFixed(2)}`);
  }
}

main().catch((err) => {
  console.error("Error ejecutando chequeo ITCRM:", err.message);
  process.exit(1);
});
