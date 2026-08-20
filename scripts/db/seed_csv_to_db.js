/**
 * Script de Seeding Optimizado por Lotes (Batch Insert):
 * Importa datos desde los CSVs locales a PostgreSQL mediante Prisma.
 */

const fs = require("fs");
const path = require("path");
const { getPrismaClient, isDbAvailable } = require("../../src/db/db");

const DATA_DIR = path.resolve(__dirname, "../../src/data");

const SERIES_CATALOG = [
  { code: "TC_MAYORISTA", name: "Tipo de Cambio Mayorista", category: "Tipo de Cambio", unit: "ARS/USD", frequency: "diaria" },
  { code: "TC_BLUE_COMPRA", name: "Dólar Blue Compra", category: "Tipo de Cambio", unit: "ARS/USD", frequency: "diaria" },
  { code: "TC_BLUE_VENTA", name: "Dólar Blue Venta", category: "Tipo de Cambio", unit: "ARS/USD", frequency: "diaria" },
  { code: "TC_CCL_COMPRA", name: "Dólar CCL Compra", category: "Tipo de Cambio", unit: "ARS/USD", frequency: "diaria" },
  { code: "TC_CCL_VENTA", name: "Dólar CCL Venta", category: "Tipo de Cambio", unit: "ARS/USD", frequency: "diaria" },
  { code: "TC_MEP_COMPRA", name: "Dólar MEP Compra", category: "Tipo de Cambio", unit: "ARS/USD", frequency: "diaria" },
  { code: "TC_MEP_VENTA", name: "Dólar MEP Venta", category: "Tipo de Cambio", unit: "ARS/USD", frequency: "diaria" },
  { code: "TC_MINORISTA_COMPRA", name: "Dólar Minorista Compra", category: "Tipo de Cambio", unit: "ARS/USD", frequency: "diaria" },
  { code: "TC_MINORISTA_VENTA", name: "Dólar Minorista Venta", category: "Tipo de Cambio", unit: "ARS/USD", frequency: "diaria" },
  { code: "IPC_NIVEL_GENERAL", name: "IPC Nivel General", category: "Inflación", unit: "%", frequency: "mensual" },
];

function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.length === 7 && s.includes("-")) {
    return new Date(`${s}-01T00:00:00.000Z`);
  }
  if (s.length === 10) {
    return new Date(`${s}T00:00:00.000Z`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function seedSeriesCatalog(prisma) {
  console.log("--> Registrando catálogo de series...");
  for (const s of SERIES_CATALOG) {
    await prisma.series.upsert({
      where: { code: s.code },
      update: { name: s.name, category: s.category, unit: s.unit, frequency: s.frequency },
      create: s,
    });
  }
  console.log(`[OK] Catálogo cargado (${SERIES_CATALOG.length} series)`);
}

async function seedTipoCambioCsv(prisma, fileName, seriesCode) {
  const filePath = path.join(DATA_DIR, "tipo_cambio", fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] No existe archivo ${fileName}`);
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);

  const points = [];
  const seenDates = new Set();

  for (let i = 1; i < lines.length; i++) {
    const [fechaStr, valorStr] = lines[i].split(",");
    const date = parseDate(fechaStr);
    const value = parseFloat(valorStr);

    if (date && !isNaN(value)) {
      const dateKey = date.toISOString().slice(0, 10);
      if (!seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        points.push({ seriesCode, date, value });
      }
    }
  }

  console.log(`--> Importando ${points.length} puntos para ${seriesCode} desde ${fileName}...`);
  
  // Insertar en lotes de 500 usando createMany para ultra velocidad
  const BATCH_SIZE = 500;
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await prisma.dataPoint.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }
  
  console.log(`[OK] ${seriesCode} importado con éxito.`);
}

async function main() {
  if (!isDbAvailable()) {
    console.error("[ERROR] DATABASE_URL no configurada en .env.");
    process.exit(1);
  }

  const prisma = getPrismaClient();

  try {
    await seedSeriesCatalog(prisma);

    await seedTipoCambioCsv(prisma, "tc_mayorista.csv", "TC_MAYORISTA");
    await seedTipoCambioCsv(prisma, "tc_blue_compra.csv", "TC_BLUE_COMPRA");
    await seedTipoCambioCsv(prisma, "tc_blue_venta.csv", "TC_BLUE_VENTA");
    await seedTipoCambioCsv(prisma, "tc_ccl_compra.csv", "TC_CCL_COMPRA");
    await seedTipoCambioCsv(prisma, "tc_ccl_venta.csv", "TC_CCL_VENTA");
    await seedTipoCambioCsv(prisma, "tc_mep_compra.csv", "TC_MEP_COMPRA");
    await seedTipoCambioCsv(prisma, "tc_mep_venta.csv", "TC_MEP_VENTA");

    console.log("¡Seeding por lotes completado con éxito!");
  } catch (error) {
    console.error("[ERROR en Seeding]", error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
