const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const BASE_URL = "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/ITCRMSerie.xlsx";

const BACKEND_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR = path.join(BACKEND_ROOT, "src", "data", "itcrm");
const OUTPUT_DAILY = path.join(OUTPUT_DIR, "itcrm_diario.csv");
const OUTPUT_MONTHLY = path.join(OUTPUT_DIR, "itcrm_mensual.csv");

function asegurarCarpeta() {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function descargarXlsx(url) {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`No se pudo descargar el Excel. Estado HTTP: ${response.status}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
}

function excelSerialToDate(valor) {
	if (valor === null || valor === undefined || valor === "") return null;

	if (valor instanceof Date) {
		return valor;
	}

	if (typeof valor === "number") {
		if (valor < 30000) return null;
		return new Date(Math.round((valor - 25569) * 86400 * 1000));
	}

	const parsed = Date.parse(String(valor));
	if (!Number.isNaN(parsed)) return new Date(parsed);

	return null;
}

function formatDateYYYYMMDD(date) {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function csvEscape(valor) {
	const texto = String(valor ?? "");

	if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) {
		return `"${texto.replace(/"/g, '""')}"`;
	}

	return texto;
}

function guardarCsv(rows, outFile, header) {
	const lines = rows.map((row) => header.map((key) => csvEscape(row[key])).join(","));
	fs.writeFileSync(outFile, [header.join(","), ...lines].join("\n"), "utf8");
}

function parseSheet(workbook, sheetName) {
	const sheet = workbook.Sheets[sheetName];
	const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

	const rows = [];

	for (let i = 2; i < sheetData.length; i += 1) {
		const fila = sheetData[i] || [];
		const fecha = formatDateYYYYMMDD(excelSerialToDate(fila[0]));
		const valor = Number(fila[1]);

		if (!fecha || !Number.isFinite(valor)) continue;

		rows.push({ fecha, valor: Number(valor.toFixed(12)) });
	}

	return rows;
}

async function main() {
	asegurarCarpeta();

	console.log("Descargando ITCRM desde BCRA...");
	console.log(`URL: ${BASE_URL}`);

	const buffer = await descargarXlsx(BASE_URL);
	console.log("Archivo descargado correctamente y parseado en memoria.");

	const workbook = XLSX.read(buffer, { type: "buffer" });

	const sheetDaily = workbook.SheetNames.find((name) => /itcrm y bilaterales$/i.test(name)) || workbook.SheetNames[0];
	const sheetMonthly = workbook.SheetNames.find((name) => /prom\. mens\./i.test(name)) || workbook.SheetNames[1] || workbook.SheetNames[0];

	const daily = parseSheet(workbook, sheetDaily);
	const monthly = parseSheet(workbook, sheetMonthly);

	// Completar meses faltantes en mensual usando promedios del diario
	const mesActual = new Date().toISOString().slice(0, 7);
	const mesesExistentes = new Set(monthly.map((r) => r.fecha.slice(0, 7)));

	const porMes = new Map();
	for (const d of daily) {
		const mes = d.fecha.slice(0, 7);
		if (!porMes.has(mes)) porMes.set(mes, { suma: 0, count: 0, ultimaFecha: d.fecha });
		const entry = porMes.get(mes);
		entry.suma += d.valor;
		entry.count += 1;
		entry.ultimaFecha = d.fecha;
	}

	const monthlyCompleto = [...monthly];
	for (const [mes, entry] of porMes) {
		if (mes >= mesActual) continue; // solo meses cerrados
		if (mesesExistentes.has(mes)) continue;
		const promedio = entry.suma / entry.count;
		monthlyCompleto.push({ fecha: entry.ultimaFecha, valor: Number(promedio.toFixed(12)) });
	}
	monthlyCompleto.sort((a, b) => a.fecha.localeCompare(b.fecha));

	guardarCsv(daily, OUTPUT_DAILY, ["fecha", "valor"]);
	guardarCsv(monthlyCompleto, OUTPUT_MONTHLY, ["fecha", "valor"]);

	const lastDaily = daily[daily.length - 1] || null;
	const lastMonthly = monthlyCompleto[monthlyCompleto.length - 1] || null;

	console.log(`Hoja diaria: ${sheetDaily}`);
	console.log(`Filas diarias generadas: ${daily.length}`);
	console.log(`Archivo generado: ${OUTPUT_DAILY}`);
	if (lastDaily) console.log(`Último dato diario: ${lastDaily.fecha} = ${lastDaily.valor}`);

	console.log(`Hoja mensual: ${sheetMonthly}`);
	console.log(`Filas mensuales base: ${monthly.length} | con completado diario: ${monthlyCompleto.length}`);
	console.log(`Archivo generado: ${OUTPUT_MONTHLY}`);
	if (lastMonthly) console.log(`Último dato mensual: ${lastMonthly.fecha} = ${lastMonthly.valor}`);
}

main().catch((error) => {
	console.error("Error actualizando ITCRM:");
	console.error(error.message);
	process.exit(1);
});
