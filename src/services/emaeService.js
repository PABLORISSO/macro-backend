const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const FILE_PATH = path.join(
  __dirname,
  "../data/actividad/emae.csv"
);

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = null;
let cacheTimestamp = 0;

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function obtenerEmae(options = {}) {
  const { startDate } = options;
  const now = Date.now();

  if (cache && now - cacheTimestamp < CACHE_TTL_MS) {
    const datos = startDate
      ? cache.filter((item) => item.fecha >= startDate)
      : cache;

    return Promise.resolve({
      fuente: "INDEC (procesado propio)",
      indicador: "EMAE - Estimador Mensual de Actividad Económica",
      datos,
      ultimoDato: datos[datos.length - 1] || null,
    });
  }

  return new Promise((resolve, reject) => {
    const resultados = [];

    fs.createReadStream(FILE_PATH)
      .pipe(
        csv({
          mapHeaders: ({ header }) =>
            (header || "").replace(/^\uFEFF/, "").trim(),
        })
      )
      .on("data", (row) => {
        const fecha = String(row.fecha || "").trim();
        const emae = toNumber(row.emae);
        const varInteranual = toNumber(row.var_interanual);
        const desestacionalizado = toNumber(row.desestacionalizado);
        const varMensual =
          String(row.var_mensual || "").trim() === ""
            ? null
            : toNumber(row.var_mensual);
        const tendencia = toNumber(row.tendencia);
        const varTendencia =
          String(row.var_tendencia || "").trim() === ""
            ? null
            : toNumber(row.var_tendencia);

        if (!fecha || emae === null || desestacionalizado === null || tendencia === null) {
          return;
        }

        resultados.push({
          fecha,
          emae,
          varInteranual,
          desestacionalizado,
          varMensual,
          tendencia,
          varTendencia,
        });
      })
      .on("end", () => {
        cache = resultados;
        cacheTimestamp = now;

        const datos = startDate
          ? resultados.filter((item) => item.fecha >= startDate)
          : resultados;

        const payload = {
          fuente: "INDEC (procesado propio)",
          indicador: "EMAE - Estimador Mensual de Actividad Económica",
          datos,
          ultimoDato: datos[datos.length - 1] || null,
        };

        resolve(payload);
      })
      .on("error", reject);
  });
}

module.exports = { obtenerEmae };