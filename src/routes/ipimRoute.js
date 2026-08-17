const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const router = express.Router();
const IPIM_DIR = path.resolve(__dirname, "..", "data", "ipim");
const IPIM_SERIES_FILE = path.join(IPIM_DIR, "ipim.csv");
const IPIM_FULL_FILE = path.join(IPIM_DIR, "ipim_full_limpio.csv");

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().replace(",", ".");
  if (!text || text === "///" || text === "-" || text.toLowerCase() === "s") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`No existe archivo: ${filePath}`));
      return;
    }

    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => rows.push(data))
      .on("end", () => resolve(rows))
      .on("error", (error) => reject(error));
  });
}

router.get("/", (req, res) => {
  readCsv(IPIM_SERIES_FILE)
    .then((rows) => {
      const datos = rows
        .map((row) => ({
          fecha: row.fecha,
          ipim: parseNumber(row.serie_original ?? row.ipim),
        }))
        .filter((item) => item.fecha && item.ipim !== null);

      return res.json({
        fuente: "INDEC / serie IPIM",
        datos,
        ultimoDato: datos[datos.length - 1] || null,
      });
    })
    .catch((error) => {
      return res.status(500).json({
        error: "No se pudo leer el archivo de IPIM",
        detalle: error.message,
      });
    });
});

router.get("/series", (req, res) => {
  readCsv(IPIM_SERIES_FILE)
    .then((rows) => {
      const datos = rows
        .map((row) => ({
          fecha: row.fecha,
          serie_original: parseNumber(row.serie_original ?? row.ipim),
          serie_desestacionalizada: parseNumber(row.serie_desestacionalizada),
          serie_tendencia_ciclo: parseNumber(row.serie_tendencia_ciclo),
        }))
        .filter((item) => item.fecha && item.serie_original !== null);

      return res.json({
        fuente: "INDEC / IPI manufacturero",
        datos,
        ultimoDato: datos[datos.length - 1] || null,
      });
    })
    .catch((error) => {
      return res.status(500).json({
        error: "No se pudo leer la serie de IPIM",
        detalle: error.message,
      });
    });
});

router.get("/variaciones", (req, res) => {
  readCsv(IPIM_SERIES_FILE)
    .then((rows) => {
      const datos = rows
        .map((row) => ({
          fecha: row.fecha,
          serie_original: parseNumber(row.serie_original ?? row.ipim),
          serie_original_mom: parseNumber(row.serie_original_mom),
          serie_original_yoy: parseNumber(row.serie_original_yoy),
          serie_original_ytd_yoy: parseNumber(row.serie_original_ytd_yoy),
          serie_desestacionalizada: parseNumber(row.serie_desestacionalizada),
          serie_desestacionalizada_mom: parseNumber(row.serie_desestacionalizada_mom),
          serie_desestacionalizada_yoy: parseNumber(row.serie_desestacionalizada_yoy),
          serie_desestacionalizada_ytd_yoy: parseNumber(row.serie_desestacionalizada_ytd_yoy),
          serie_tendencia_ciclo: parseNumber(row.serie_tendencia_ciclo),
          serie_tendencia_ciclo_mom: parseNumber(row.serie_tendencia_ciclo_mom),
          serie_tendencia_ciclo_yoy: parseNumber(row.serie_tendencia_ciclo_yoy),
          serie_tendencia_ciclo_ytd_yoy: parseNumber(row.serie_tendencia_ciclo_ytd_yoy),
        }))
        .filter((item) => item.fecha && item.serie_original !== null);

      return res.json({
        fuente: "INDEC / IPI manufacturero con variaciones MoM, YoY y YTD",
        datos,
        ultimoDato: datos[datos.length - 1] || null,
      });
    })
    .catch((error) => {
      return res.status(500).json({
        error: "No se pudo leer las variaciones de IPIM",
        detalle: error.message,
      });
    });
});

router.get("/full", (req, res) => {
  readCsv(IPIM_FULL_FILE)
    .then((rows) => {
      const datos = rows.filter((row) => row.fecha);
      return res.json({
        fuente: "INDEC / IPI manufacturero por rubro",
        datos,
        ultimoDato: datos[datos.length - 1] || null,
      });
    })
    .catch((error) => {
      return res.status(500).json({
        error: "No se pudo leer IPIM por rubro",
        detalle: error.message,
      });
    });
});

module.exports = router;