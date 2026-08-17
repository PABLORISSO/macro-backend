const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const DATA_PATH = path.join(
  __dirname,
  "..",
  "data",
  "international",
  "worldbank_panel_anual.csv"
);

console.log("CSV usado por Node:", DATA_PATH);

function convertirNumero(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const texto = String(valor).trim();

  if (texto === "" || texto === "NA" || texto === "null" || texto === "..") {
    return null;
  }

  const numero = Number(texto.replace(",", "."));

  if (Number.isNaN(numero)) {
    return null;
  }

  return numero;
}

function leerObservaciones() {
  return new Promise((resolve, reject) => {
    const resultados = [];
    let primeraFila = true;

    fs.createReadStream(DATA_PATH)
      .pipe(csv())
      .on("data", (row) => {

        if (primeraFila) {
          console.log("COLUMNAS CSV:");
          console.log(Object.keys(row));
          primeraFila = false;
        }

        resultados.push({
          ...row,
          year: Number(row.year),
          value: Number(row.value),
        });
      })
      .on("end", () => resolve(resultados))
      .on("error", reject);
  });
}

async function obtenerDashboardLatam() {
  const datos = await leerObservaciones();

  const datosLatam = datos.filter((d) => {
    const region = String(d.region).trim();
    return region === "LATAM";
  });

  const paises = {};

  datosLatam.forEach((d) => {
    const countryCode = String(
  d.country_code || d["﻿country_code"]
).trim();
    const country = String(d.country).trim();
    const variable = String(d.variable_code).trim();

    if (!paises[countryCode]) {
      paises[countryCode] = {
        country_code: countryCode,
        country: country,
      };
    }

    if (!variable || d.year === null) {
      return;
    }

    const yearKey = `${variable}_year`;
    const yearActual = paises[countryCode][yearKey];

    if (!yearActual || d.year > yearActual) {
      paises[countryCode][variable] = d.value;
      paises[countryCode][yearKey] = d.year;
    }
  });

  const resultado = Object.values(paises);

  console.log("Cantidad países finales:", resultado.length);
  console.log("Países finales:", resultado.map((p) => p.country));

  return resultado;
}

module.exports = {
  leerObservaciones,
  obtenerDashboardLatam,
};