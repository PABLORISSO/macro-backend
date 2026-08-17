const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const FILE_PATH = path.join(
  __dirname,
  "../data/actividad/emae_sectores.csv"
);

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = null;
let cacheTimestamp = 0;

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function obtenerEmaeSectores() {
  const now = Date.now();
  if (cache && now - cacheTimestamp < CACHE_TTL_MS) {
    return Promise.resolve(cache);
  }

  return new Promise((resolve, reject) => {
    const resultados = [];

    fs.createReadStream(FILE_PATH)
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.replace(/^\uFEFF/, "").trim(),
        })
      )
      .on("data", (row) => {
        const fecha = row.fecha ? row.fecha.trim() : null;
        const sector = row.sector ? row.sector.trim() : null;
        const indice = toNumber(row.indice);
        const var_interanual = toNumber(row.var_interanual);

        if (!fecha || !sector || indice === null) return;

        resultados.push({ fecha, sector, indice, var_interanual });
      })
      .on("end", () => {
        cache = resultados;
        cacheTimestamp = Date.now();
        resolve(cache);
      })
      .on("error", reject);
  });
}

module.exports = { obtenerEmaeSectores };
