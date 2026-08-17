/**
 * update_tipo_cambio.js
 * Descarga datos históricos de tipo de cambio desde BCRA y argentinadatos.com
 * y genera CSVs locales en src/data/tipo_cambio/
 *
 * Uso: node scripts/bcra/tipo_cambio/update_tipo_cambio.js
 */

const fs = require("fs");
const path = require("path");

const BACKEND_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR = path.join(BACKEND_ROOT, "src", "data", "tipo_cambio");

// IDs de variables BCRA:
// 5 = Tipo de cambio mayorista ($ por USD) - Comunicación A 3500
// Variables adicionales para otras series
const BCRA_VARIABLES = [
  { id: 5, nombre: "mayorista" },       // Tipo de cambio mayorista
  { id: 4,  nombre: "minorista_compra" }, // Minorista compra BNA
  { id: 272, nombre: "minorista_venta" }, // Minorista venta BNA
];

const ARG_DATOS_BASE = "https://api.argentinadatos.com/v1/cotizaciones/dolares";
const ARG_DATOS_TIPOS = [
  { tipo: "blue",           nombre: "blue" },
  { tipo: "bolsa",          nombre: "mep" },
  { tipo: "contadoconliqui", nombre: "ccl" },
  { tipo: "oficial",        nombre: "oficial_minorista" },
  { tipo: "mayorista",      nombre: "mayorista_arg_datos" },
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
  console.log(`  → ${outFile} (${rows.length} filas)`);
}

function leerCsvExistente(filePath, keyCol = "fecha") {
  if (!fs.existsSync(filePath)) return new Map();
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return new Map();
  const headers = lines[0].split(",");
  const map = new Map();
  lines.slice(1).forEach((line) => {
    const parts = line.split(",");
    const row = {};
    headers.forEach((h, i) => { row[h] = parts[i] ?? ""; });
    if (row[keyCol]) map.set(row[keyCol], row);
  });
  return map;
}

async function fetchBcraVariable(idVariable, desde = "1992-01-01") {
  const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${desde}`;
  console.log(`  Consultando BCRA variable ${idVariable} desde ${desde}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`BCRA API error ${response.status} para variable ${idVariable}`);
  const json = await response.json();
  const detalle = json?.results?.[0]?.detalle || [];
  return detalle
    .map((item) => ({
      fecha: String(item.fecha).slice(0, 10),
      valor: Number(item.valor),
    }))
    .filter((d) => d.fecha && Number.isFinite(d.valor))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

async function fetchArgDatos(tipo) {
  const url = `${ARG_DATOS_BASE}/${tipo}`;
  console.log(`  Consultando argentinadatos.com/${tipo}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`argentinadatos.com error ${response.status} para ${tipo}`);
  const json = await response.json();
  const datos = Array.isArray(json) ? json : (json?.data || []);
  return datos
    .map((item) => ({
      fecha: String(item.fecha || item.date || "").slice(0, 10),
      compra: Number(item.compra ?? item.buy ?? NaN),
      venta: Number(item.venta ?? item.sell ?? NaN),
    }))
    .filter((d) => d.fecha && (Number.isFinite(d.compra) || Number.isFinite(d.venta)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function mergearConExistente(existente, nuevos, keyCol = "fecha") {
  const merged = new Map(existente);
  for (const row of nuevos) {
    merged.set(row[keyCol], row);
  }
  return [...merged.values()].sort((a, b) => String(a[keyCol]).localeCompare(String(b[keyCol])));
}

async function procesarBcraVariable({ id, nombre }) {
  const outputFile = path.join(OUTPUT_DIR, `tc_${nombre}.csv`);
  const existente = leerCsvExistente(outputFile, "fecha");

  // Si ya hay datos, solo pedir desde la última fecha
  let desde = "1992-01-01";
  if (existente.size > 0) {
    const fechas = [...existente.keys()].sort();
    const ultima = fechas[fechas.length - 1];
    // Pedir desde 30 días antes del último para asegurar completitud
    const dt = new Date(ultima);
    dt.setDate(dt.getDate() - 30);
    desde = dt.toISOString().slice(0, 10);
  }

  try {
    const nuevos = await fetchBcraVariable(id, desde);
    const merged = mergearConExistente(existente, nuevos.map((d) => ({ fecha: d.fecha, valor: d.valor })));
    guardarCsv(merged, outputFile, ["fecha", "valor"]);
    return { nombre, ok: true, filas: merged.length, ultimoDato: merged[merged.length - 1] };
  } catch (err) {
    console.warn(`  ⚠ No se pudo actualizar ${nombre}: ${err.message}`);
    return { nombre, ok: false, error: err.message };
  }
}

async function procesarArgDatos({ tipo, nombre }) {
  const outputCompra = path.join(OUTPUT_DIR, `tc_${nombre}_compra.csv`);
  const outputVenta = path.join(OUTPUT_DIR, `tc_${nombre}_venta.csv`);

  try {
    const datos = await fetchArgDatos(tipo);

    const rowsCompra = datos
      .filter((d) => Number.isFinite(d.compra))
      .map((d) => ({ fecha: d.fecha, valor: d.compra }));
    const rowsVenta = datos
      .filter((d) => Number.isFinite(d.venta))
      .map((d) => ({ fecha: d.fecha, valor: d.venta }));

    guardarCsv(rowsCompra, outputCompra, ["fecha", "valor"]);
    guardarCsv(rowsVenta, outputVenta, ["fecha", "valor"]);

    return {
      nombre,
      ok: true,
      filas: datos.length,
      ultimoDato: datos[datos.length - 1],
    };
  } catch (err) {
    console.warn(`  ⚠ No se pudo actualizar ${nombre}: ${err.message}`);
    return { nombre, ok: false, error: err.message };
  }
}

async function main() {
  asegurarCarpeta();
  console.log("=== Actualización de Tipo de Cambio ===");
  console.log(`Destino: ${OUTPUT_DIR}\n`);

  const resultados = [];

  // --- BCRA ---
  console.log("📡 Fuente: BCRA API");
  for (const variable of BCRA_VARIABLES) {
    const resultado = await procesarBcraVariable(variable);
    resultados.push({ fuente: "BCRA", ...resultado });
  }

  // --- argentinadatos.com ---
  console.log("\n📡 Fuente: argentinadatos.com");
  for (const tipo of ARG_DATOS_TIPOS) {
    const resultado = await procesarArgDatos(tipo);
    resultados.push({ fuente: "argentinadatos", ...resultado });
  }

  // Resumen
  console.log("\n=== Resumen ===");
  for (const r of resultados) {
    if (r.ok) {
      console.log(`✓ ${r.fuente}/${r.nombre}: ${r.filas} filas | último: ${r.ultimoDato?.fecha} = ${r.ultimoDato?.venta ?? r.ultimoDato?.valor}`);
    } else {
      console.log(`✗ ${r.fuente}/${r.nombre}: ${r.error}`);
    }
  }
}

main().catch((err) => {
  console.error("Error fatal:", err.message);
  process.exit(1);
});
