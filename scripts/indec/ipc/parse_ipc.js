import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const RAW_FILE = path.resolve("backend/raw/indec/ipc/sh_ipc_04_26.xls");
const OUTPUT_DIR = path.resolve("backend/src/data/ipc");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "ipc_aperturas_largo.csv");

const ARCHIVO_ORIGEN = path.basename(RAW_FILE);
const FECHA_DESCARGA = new Date().toISOString().slice(0, 10);

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
  const texto = normalizarTexto(valor);
  if (!REGEX_FECHA.test(texto)) return null;

  const [mes, anioCorto] = texto.split("/");
  return `20${anioCorto}-${mes}`;
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
    t.startsWith("Región ") ||
    t === "GBA" ||
    t === "Pampeana" ||
    t === "Noreste" ||
    t === "Noroeste" ||
    t === "Cuyo" ||
    t === "Patagonia"
  );
}

function detectarBloque(texto) {
  const t = normalizarTexto(texto);

  if (t.startsWith("Nivel general y divisiones")) {
    return "Nivel general";
  }

  if (t === "Categorías") {
    return "Categorías";
  }

  if (t === "Bienes y servicios") {
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

function parsearIpc() {
  if (!fs.existsSync(RAW_FILE)) {
    console.error("No existe el archivo:");
    console.error(RAW_FILE);
    process.exit(1);
  }

  const workbook = XLSX.readFile(RAW_FILE);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const sheetData = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

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
        archivo_origen: ARCHIVO_ORIGEN,
        fecha_descarga: FECHA_DESCARGA,
      });
    }
  }

  guardarCsv(resultados);

  console.log("Parse IPC terminado.");
  console.log(`Hoja leída: ${sheetName}`);
  console.log(`Tipo de variación detectada: ${tipoVariacion}`);
  console.log(`Filas generadas: ${resultados.length}`);
  console.log(`Archivo generado: ${OUTPUT_FILE}`);
}

parsearIpc();