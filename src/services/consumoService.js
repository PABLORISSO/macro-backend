const fs = require("fs");
const path = require("path");

const CONSUMO_JSON_PATH = path.join(__dirname, "..", "data", "consumo.json");
const SUPERMERCADOS_CSV_PATH = path.join(__dirname, "..", "data", "consumo", "supermercados.csv");
const SUPERMERCADOS_CANALES_CSV_PATH = path.join(__dirname, "..", "data", "consumo", "supermercados_canales.csv");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readSupermercadosCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const rows = lines.slice(1).map((line) => {
    const [fecha, indice_orig, var_yoy, var_acum, indice_desest, var_mom_desest, indice_tend, var_mom_tend] = line.split(",");
    return {
      fecha,
      indice_orig: toNumber(indice_orig),
      var_yoy: toNumber(var_yoy),
      var_acum: toNumber(var_acum),
      indice_desest: toNumber(indice_desest),
      var_mom_desest: toNumber(var_mom_desest),
      indice_tend: toNumber(indice_tend),
      var_mom_tend: toNumber(var_mom_tend),
    };
  });

  return rows.filter((r) => r.fecha);
}

function readSupermercadosCanalesCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const header = lines[0].split(",").map((h) => h.trim());
  const idxFecha = header.indexOf("fecha");
  const idxCredito = header.indexOf("credito_mill");
  const idxCreditoYoY = header.indexOf("credito_mill_yoy");

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      fecha: cols[idxFecha],
      credito_mill: toNumber(cols[idxCredito]),
      credito_mill_yoy: toNumber(cols[idxCreditoYoY]),
      // keep full row if needed later
      _raw: cols,
    };
  });

  return rows.filter((r) => r.fecha);
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((acc, n) => acc + n, 0) / values.length;
}

function classifyYoY(varYoY) {
  if (varYoY === null) return "sin señal";
  if (varYoY >= 3) return "expansión";
  if (varYoY >= 0) return "recuperación leve";
  if (varYoY <= -5) return "contracción marcada";
  return "contracción moderada";
}

const obtenerConsumo = () => {
  const base = readJson(CONSUMO_JSON_PATH);
  const serie = readSupermercadosCsv(SUPERMERCADOS_CSV_PATH);
  const canalesSerie = readSupermercadosCanalesCsv(SUPERMERCADOS_CANALES_CSV_PATH);

  if (!serie.length) {
    return {
      ...base,
      analysis: {
        diagnostico: "sin datos procesados de supermercados",
      },
      serieSupermercados: [],
      mediosDePagoSerie: canalesSerie,
    };
  }

  const latest = serie[serie.length - 1];
  const prev = serie.length > 1 ? serie[serie.length - 2] : null;

  const last3Mom = serie
    .slice(-3)
    .map((r) => r.var_mom_desest)
    .filter((v) => v !== null);

  const avg3Mom = mean(last3Mom);
  const momDelta = prev && latest.var_mom_desest !== null && prev.var_mom_desest !== null
    ? latest.var_mom_desest - prev.var_mom_desest
    : null;

  const summary = Array.isArray(base.summary) ? [...base.summary] : [];
  const idxVentas = summary.findIndex((item) => item.id === "ventas_minoristas");

  if (idxVentas >= 0) {
    summary[idxVentas] = {
      ...summary[idxVentas],
      value: latest.var_yoy,
      unit: "%",
      foot: `Variación interanual — ${latest.fecha}`,
    };
  }

  return {
    ...base,
    summary,
    ultimoDato: {
      fecha: latest.fecha,
      indice_orig_base2017: latest.indice_orig,
      var_yoy: latest.var_yoy,
      var_mom_desest: latest.var_mom_desest,
    },
    analysis: {
      diagnostico: classifyYoY(latest.var_yoy),
      promedio_3m_mom_desest: avg3Mom,
      aceleracion_mensual: momDelta,
      fecha: latest.fecha,
    },
    serieSupermercados: serie,
    mediosDePagoSerie: canalesSerie,
  };
};

module.exports = { obtenerConsumo };
