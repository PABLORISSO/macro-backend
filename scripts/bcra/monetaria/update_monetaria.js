/**
 * update_monetaria.js
 * Descarga series de agregados monetarios desde BCRA y las guarda en CSV local
 * (modo incremental con merge por fecha).
 */

const fs = require("fs");
const path = require("path");

const BACKEND_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR = path.join(BACKEND_ROOT, "src", "data", "monetaria");

const AGREGADOS_MONETARIOS = [
  { idVariable: 15, slug: "base-monetaria", nombre: "Base monetaria" },
  { idVariable: 17, slug: "circulante-publico", nombre: "Circulante en poder del público" },
  { idVariable: 91, slug: "depositos-totales", nombre: "Depósitos totales" },
  { idVariable: 109, slug: "m2-total", nombre: "M2 total" },
  { idVariable: 197, slug: "m2-privado", nombre: "M2 privado" },
  { idVariable: 96, slug: "_plazo-fijo-privado", nombre: "Plazos fijos privados" },
];

function asegurarCarpeta() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function csvEscape(valor) {
  const texto = String(valor ?? "");
  if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function guardarCsv(rows, outFile, header) {
  const lines = rows.map((row) => header.map((key) => csvEscape(row[key] ?? "")).join(","));
  fs.writeFileSync(outFile, [header.join(","), ...lines].join("\n"), "utf8");
}

function leerCsvExistente(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return new Map();

  const map = new Map();
  lines.slice(1).forEach((line) => {
    const [fecha, valor] = line.split(",");
    const n = Number(valor);
    if (fecha && Number.isFinite(n)) {
      map.set(String(fecha).trim(), { fecha: String(fecha).trim(), valor: n });
    }
  });
  return map;
}

function mergearConExistente(existente, nuevos) {
  const merged = new Map(existente);
  for (const row of nuevos) {
    merged.set(row.fecha, row);
  }

  return [...merged.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

async function fetchBcraVariable(idVariable, desde = "1992-01-01") {
  const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${desde}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`BCRA API error ${response.status} para variable ${idVariable}`);
  }

  const json = await response.json();
  const detalle = json?.results?.[0]?.detalle || [];

  return detalle
    .map((item) => ({
      fecha: String(item.fecha || "").slice(0, 10),
      valor: Number(item.valor),
    }))
    .filter((d) => d.fecha && Number.isFinite(d.valor))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

async function procesarSerie({ idVariable, slug, nombre }) {
  const outputFile = path.join(OUTPUT_DIR, `agregado_${slug}.csv`);
  const existente = leerCsvExistente(outputFile);

  let desde = "1992-01-01";
  if (existente.size > 0) {
    const fechas = [...existente.keys()].sort();
    const ultima = fechas[fechas.length - 1];
    const dt = new Date(ultima);
    dt.setDate(dt.getDate() - 30);
    desde = dt.toISOString().slice(0, 10);
  }

  const nuevos = await fetchBcraVariable(idVariable, desde);
  const merged = mergearConExistente(existente, nuevos);
  guardarCsv(merged, outputFile, ["fecha", "valor"]);

  return {
    idVariable,
    slug,
    nombre,
    filas: merged.length,
    ultimoDato: merged[merged.length - 1] || null,
    outputFile,
  };
}

async function main() {
  asegurarCarpeta();
  console.log("=== Actualización Agregados Monetarios ===");

  const resultados = [];

  for (const serie of AGREGADOS_MONETARIOS) {
    try {
      const out = await procesarSerie(serie);
      resultados.push({ ok: true, ...out });
      console.log(`✓ ${out.slug}: ${out.filas} filas | último ${out.ultimoDato?.fecha} = ${out.ultimoDato?.valor}`);
    } catch (error) {
      resultados.push({ ok: false, slug: serie.slug, error: error.message });
      console.warn(`✗ ${serie.slug}: ${error.message}`);
    }
  }

  const errores = resultados.filter((r) => !r.ok);
  if (errores.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Error fatal en update_monetaria:", error.message);
  process.exit(1);
});
