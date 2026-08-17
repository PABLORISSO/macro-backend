const fs = require("fs");
const path = require("path");

function parseCsvLine(line) {
  return line.split(",").map((x) => x.replace(/^\uFEFF/, "").trim());
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function leerCsvSectorExterno(nombreArchivo) {
  const csvPath = path.join(
    __dirname,
    "..",
    "data",
    "sector_externo",
    nombreArchivo
  );

  if (!fs.existsSync(csvPath)) {
    const error = new Error(`No existe ${nombreArchivo}. Ejecutá primero el update correspondiente.`);
    error.statusCode = 404;
    throw error;
  }

  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);

  const data = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((h, i) => {
      row[h] = values[i];
    });

    const parsed = {};

    Object.keys(row).forEach((key) => {
      if (["periodo", "fuente", "fecha_carga"].includes(key)) {
        parsed[key] = row[key];
      } else {
        parsed[key] = toNumber(row[key]);
      }
    });

    return parsed;
  });

  data.sort((a, b) => {
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.trimestre - b.trimestre;
  });

  return data;
}

function responderCsv(req, res, nombreArchivo, nombreDescarga) {
  try {
    const csvPath = path.join(
      __dirname,
      "..",
      "data",
      "sector_externo",
      nombreArchivo
    );

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({
        error: `No existe ${nombreArchivo}. Ejecutá primero el update correspondiente.`,
      });
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nombreDescarga}"`
    );

    return res.send(fs.readFileSync(csvPath, "utf8"));
  } catch (err) {
    console.error(`sectorExterno:csv error`, err.message);
    return res.status(500).json({ error: err.message });
  }
}

function responderJson(req, res, nombreArchivo) {
  try {
    const data = leerCsvSectorExterno(nombreArchivo);
    return res.json(data);
  } catch (err) {
    console.error(`sectorExterno:${nombreArchivo} error`, err.message);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}

function getBienes(req, res) {
  return responderJson(req, res, "bienes.csv");
}

function getBienesCsv(req, res) {
  return responderCsv(req, res, "bienes.csv", "sector_externo_bienes.csv");
}

function getServicios(req, res) {
  return responderJson(req, res, "servicios.csv");
}

function getServiciosCsv(req, res) {
  return responderCsv(req, res, "servicios.csv", "sector_externo_servicios.csv");
}

function getIngresoPrimario(req, res) {
  return responderJson(req, res, "ingreso_primario.csv");
}

function getIngresoPrimarioCsv(req, res) {
  return responderCsv(
    req,
    res,
    "ingreso_primario.csv",
    "sector_externo_ingreso_primario.csv"
  );
}

function getIngresoSecundario(req, res) {
  return responderJson(req, res, "ingreso_secundario.csv");
}

function getIngresoSecundarioCsv(req, res) {
  return responderCsv(
    req,
    res,
    "ingreso_secundario.csv",
    "sector_externo_ingreso_secundario.csv"
  );
}

function getCuentaFinanciera(req, res) {
  return responderJson(req, res, "cuenta_financiera.csv");
}

function getCuentaFinancieraCsv(req, res) {
  return responderCsv(
    req,
    res,
    "cuenta_financiera.csv",
    "sector_externo_cuenta_financiera.csv"
  );
}

function getCuentaCorriente(req, res) {
  return responderJson(req, res, "cuenta_corriente.csv");
}

function getCuentaCorrienteCsv(req, res) {
  return responderCsv(
    req,
    res,
    "cuenta_corriente.csv",
    "sector_externo_cuenta_corriente.csv"
  );
}

function getCuentaCapital(req, res) {
  return responderJson(req, res, "cuenta_capital.csv");
}

function getCuentaCapitalCsv(req, res) {
  return responderCsv(
    req,
    res,
    "cuenta_capital.csv",
    "sector_externo_cuenta_capital.csv"
  );
}

function getResumenBalanzaPagos(req, res) {
  return responderJson(req, res, "resumen_balanza_pagos.csv");
}

function getResumenBalanzaPagosCsv(req, res) {
  return responderCsv(
    req,
    res,
    "resumen_balanza_pagos.csv",
    "sector_externo_resumen_balanza_pagos.csv"
  );
}

module.exports = {
  getBienes,
  getBienesCsv,
  getServicios,
  getServiciosCsv,
  getIngresoPrimario,
  getIngresoPrimarioCsv,
  getIngresoSecundario,
  getIngresoSecundarioCsv,
  getCuentaCorriente,
  getCuentaCorrienteCsv,
  getCuentaFinanciera,
  getCuentaFinancieraCsv,
  getCuentaCapital,
  getCuentaCapitalCsv,
  getResumenBalanzaPagos,
  getResumenBalanzaPagosCsv,
};