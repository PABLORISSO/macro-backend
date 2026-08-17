import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const BASE_URL = "https://www.indec.gob.ar/ftp/cuadros/economia";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data', 'ipc');

function armarNombreArchivo(anio, mes) {
  const mm = String(mes).padStart(2, "0");
  const aa = String(anio).slice(-2);

  return `sh_ipc_${mm}_${aa}.xls`;
}

function armarUrl(anio, mes) {
  return `${BASE_URL}/${armarNombreArchivo(anio, mes)}`;
}

async function descargarArchivo(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo descargar. Estado HTTP: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function actualizarIpc(anio, mes) {
  const archivo = armarNombreArchivo(anio, mes);
  const url = armarUrl(anio, mes);

  console.log("Descargando IPC desde INDEC...");
  console.log(`URL: ${url}`);

  const buffer = await descargarArchivo(url);

  console.log("");
  console.log("Archivo descargado correctamente y parseado en memoria:");
  console.log(archivo);

  // Parsear el archivo descargado y exportar CSV largo
  try {
    await parsearIpcDesdeBuffer(buffer, archivo);
  } catch (err) {
    console.error('Error en parseo posterior a la descarga:', err.message);
  }
}

const [, , anioArg, mesArg] = process.argv;

if (!anioArg || !mesArg) {
  console.log("Uso:");
  console.log("node scripts/indec/ipc/update_ipc.js 2026 4");
  process.exit(1);
}

const anio = Number(anioArg);
const mes = Number(mesArg);

if (!anio || !mes || mes < 1 || mes > 12) {
  console.error("Año o mes inválido.");
  process.exit(1);
}

actualizarIpc(anio, mes).catch((error) => {
  console.error("");
  console.error("Error actualizando IPC:");
  console.error(error.message);
  process.exit(1);
});

// -------------------- parser (adaptado de parse_ipc.js) --------------------

const OUTPUT_DIR = path.join(BACKEND_ROOT, 'src', 'data', 'ipc');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ipc_aperturas_largo.csv');
const OUTPUT_FILE_INTERANUAL = path.join(OUTPUT_DIR, 'ipc_interanual_largo.csv');

const CONCEPTOS_VALIDOS = [
  "Nivel general",
  "Alimentos y bebidas no alcohólicas",
  "Bebidas alcohólicas y tabaco",
  "Prendas de vestir y calzado",
  "Vivienda, agua, electricidad, gas y otros combustibles",
  "Equipamiento y mantenimiento del hogar",
  "Salud",
  "Transporte",
  "Comunicación",
  "Recreación y cultura",
  "Educación",
  "Restaurantes y hoteles",
  "Bienes y servicios varios",
  "Estacional",
  "Núcleo",
  "Regulados",
  "Bienes",
  "Servicios",
];

const REGEX_FECHA = /^\d{2}\/\d{2}$/;

function normalizarTexto(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

function limpiarConcepto(valor) {
  return normalizarTexto(valor).replace(/\*+$/g, "").trim();
}

function convertirFecha(valor) {
  if (valor instanceof Date) {
    const mm = String(valor.getMonth() + 1).padStart(2, "0");
    const aa = String(valor.getFullYear());
    return `${aa}-${mm}`;
  }

  if (typeof valor === "number") {
    // Excel serial date to JS Date
    // ignore small serials (0, empty) that map to 1899/1900
    if (valor < 30000) return null;
    const d = new Date(Math.round((valor - 25569) * 86400 * 1000));
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const aa = String(d.getFullYear());
    return `${aa}-${mm}`;
  }
  if (typeof valor === 'string') {
    const texto = normalizarTexto(valor);

    // Try parse as mm/yy or m/yy
    const m = texto.match(/^(\d{1,2})\/(\d{2})$/);
    if (m) {
      const mes = String(m[1]).padStart(2, "0");
      const anio = `20${m[2]}`;
      return `${anio}-${mes}`;
    }

    // Try JS Date parse on strings like 'Sun Jan 01 2017 ...'
    const parsed = Date.parse(texto);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const aa = String(d.getFullYear());
      return `${aa}-${mm}`;
    }

    return null;
  }

  return null;
}

function convertirNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return valor;

  const texto = String(valor).replace(/\./g, "").replace(",", ".").trim();
  const numero = Number(texto);

  return Number.isNaN(numero) ? null : numero;
}

function detectarTipoVariacion(sheetData) {
  const texto = sheetData.slice(0, 10).flat().map(normalizarTexto).join(" ").toLowerCase();

  if (texto.includes("interanual")) return "interanual";
  if (texto.includes("mensual")) return "mensual";
  if (texto.includes("acumulad")) return "acumulada";

  return "sin_identificar";
}

function esRegion(texto) {
  const t = normalizarTexto(texto);

  return (
    t === "Total nacional" ||
    t.startsWith("Región") ||
    ["GBA","Pampeana","Noreste","Noroeste","Cuyo","Patagonia"].includes(t)
  );
}

function detectarBloque(texto) {
  const t = normalizarTexto(texto).toLowerCase();

  if (t.includes("nivel general") || t.includes("divisiones")) {
    return "Nivel general";
  }

  if (t.includes("categor")) {
    return "Categorías";
  }

  if (t.includes("bienes y servicios")) {
    return "Bienes y servicios";
  }

  return null;
}

function encontrarColumnasFecha(fila) {
  const columnas = [];

  fila.forEach((celda, index) => {
    const fecha = convertirFecha(celda);

    if (fecha) {
      columnas.push({ index, fecha });
    }
  });

  return columnas;
}

function encontrarConceptoEnFila(fila) {
  for (const celda of fila) {
    const texto = limpiarConcepto(celda);

    if (CONCEPTOS_VALIDOS.includes(texto)) {
      return texto;
    }
  }

  return null;
}

function csvEscape(valor) {
  const texto = String(valor ?? "");

  if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }

  return texto;
}

function guardarCsv(rows) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const header = [
    "fecha",
    "region",
    "tipo_variacion",
    "bloque",
    "concepto",
    "valor",
    "archivo_origen",
    "fecha_descarga",
  ];

  const lines = rows.map((row) =>
    [
      row.fecha,
      row.region,
      row.tipo_variacion,
      row.bloque,
      row.concepto,
      row.valor,
      row.archivo_origen,
      row.fecha_descarga,
    ]
      .map(csvEscape)
      .join(",")
  );

  fs.writeFileSync(OUTPUT_FILE, [header.join(","), ...lines].join("\n"), "utf8");
}

async function parsearIpcDesdeBuffer(buffer, archivoOrigen) {
  if (!buffer || !buffer.length) {
    console.error("No existe contenido descargado para parsear.");
    return;
  }

  const FECHA_DESCARGA = new Date().toISOString().slice(0, 10);

  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // helper to parse one sheet and write to given output file
  function parseSheetToCsv(sheetName, outFile) {
    const sheet = workbook.Sheets[sheetName];
    const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    const tipoVariacion = detectarTipoVariacion(sheetData);

    let regionActual = "";
    let bloqueActual = "";
    let columnasFechaActuales = [];

    const resultados = [];

    for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
      const fila = sheetData[rowIndex];

      const columnasFecha = encontrarColumnasFecha(fila);

      if (columnasFecha.length >= 3) {
        columnasFechaActuales = columnasFecha;
      }

      const textosFila = fila.map(normalizarTexto).filter(Boolean);

      for (const texto of textosFila) {
        if (esRegion(texto)) {
          regionActual = texto;
          bloqueActual = "";
        }

        const bloqueDetectado = detectarBloque(texto);

        if (bloqueDetectado) {
          bloqueActual = bloqueDetectado;
        }
      }

      const concepto = encontrarConceptoEnFila(fila);

      if (!concepto) continue;
      if (!regionActual) continue;
      if (!bloqueActual) continue;
      if (columnasFechaActuales.length === 0) continue;

      for (const col of columnasFechaActuales) {
        const valor = convertirNumero(fila[col.index]);

        if (valor === null) continue;

        resultados.push({
          fecha: col.fecha,
          region: regionActual,
          tipo_variacion: tipoVariacion,
          bloque: bloqueActual,
          concepto,
          valor,
          archivo_origen: archivoOrigen,
          fecha_descarga: FECHA_DESCARGA,
        });
      }
    }

    // write to outFile
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    const header = [
      "fecha",
      "region",
      "tipo_variacion",
      "bloque",
      "concepto",
      "valor",
      "archivo_origen",
      "fecha_descarga",
    ];

    const lines = resultados.map((row) =>
      [
        row.fecha,
        row.region,
        row.tipo_variacion,
        row.bloque,
        row.concepto,
        row.valor,
        row.archivo_origen,
        row.fecha_descarga,
      ]
        .map(csvEscape)
        .join(",")
    );

    fs.writeFileSync(outFile, [header.join(","), ...lines].join("\n"), "utf8");

    console.log("Parse IPC terminado.");
    console.log(`Hoja leída: ${sheetName}`);
    console.log(`Tipo de variación detectada: ${tipoVariacion}`);
    console.log(`Filas generadas: ${resultados.length}`);
    console.log(`Archivo generado: ${outFile}`);
  }

  // parse first sheet -> aperturas
  if (workbook.SheetNames.length > 0) {
    parseSheetToCsv(workbook.SheetNames[0], OUTPUT_FILE);
  }

  // if second sheet exists, parse it as interanual
  if (workbook.SheetNames.length > 1) {
    const name1 = workbook.SheetNames[1];
    // prefer sheet with 'interanual' in name, otherwise still parse second sheet
    if (name1.toLowerCase().includes('interanual') || true) {
      parseSheetToCsv(name1, OUTPUT_FILE_INTERANUAL);
    }
  }
}