const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data", "monetaria");

const AGREGADOS_MONETARIOS = [
  {
    idVariable: 15,
    slug: "base-monetaria",
    nombre: "Base monetaria",
    descripcion:
      "Billetes y monedas en circulación más cuentas corrientes de entidades financieras en el BCRA.",
  },
  {
    idVariable: 17,
    slug: "circulante-publico",
    nombre: "Circulante en poder del público",
    descripcion:
      "Circulación monetaria excluyendo el efectivo en pesos en entidades financieras.",
  },
  {
    idVariable: 91,
    slug: "depositos-totales",
    nombre: "Depósitos totales",
    descripcion:
      "Depósitos totales informados por el BCRA, netos del uso del Fondo Unificado de Cuentas Oficiales.",
  },
  {
    idVariable: 109,
    slug: "m2-total",
    nombre: "M2 total",
    descripcion:
      "Circulación monetaria sin efectivo en bancos más cuentas corrientes y cajas de ahorro en pesos de los sectores público y privado.",
  },
  {
    idVariable: 197,
    slug: "m2-privado",
    nombre: "M2 privado",
    descripcion:
      "Circulación monetaria sin efectivo en bancos más depósitos transaccionales y cajas de ahorro en pesos del sector privado.",
  },
  // id 96 = plazos fijos sector privado (componente para calcular M3 privado)
  {
    idVariable: 96,
    slug: "_plazo-fijo-privado",
    nombre: "Plazos fijos privados",
    descripcion: "Plazos fijos en pesos del sector privado no financiero (componente de M3 privado).",
    _interno: true,
  },
];

const CATALOGO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cacheCatalogo = null;
let cacheCatalogoTimestamp = 0;

function normalizarDatos(detalle = []) {
  return detalle
    .map((item) => ({
      fecha: item.fecha,
      valor: Number(item.valor),
    }))
    .filter((item) => item.fecha && Number.isFinite(item.valor))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

function agruparPorMes(datos) {
  const porMes = new Map();

  for (const item of datos) {
    const mes = item.fecha.slice(0, 7);
    porMes.set(mes, item);
  }

  return Array.from(porMes.values());
}

function getSerieFilePath(slug) {
  return path.join(DATA_DIR, `agregado_${slug}.csv`);
}

function leerCsvLocal(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  return lines
    .slice(1)
    .map((line) => {
      const [fecha, valor] = line.split(",");
      return {
        fecha: (fecha || "").trim(),
        valor: Number(valor),
      };
    })
    .filter((item) => item.fecha && Number.isFinite(item.valor))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

function fetchSerieAgregado(config, { desde, frecuencia, limit }) {
  const filePath = getSerieFilePath(config.slug);
  const datosDiarios = leerCsvLocal(filePath);

  if (!datosDiarios.length) {
    throw new Error(
      `No hay datos locales para ${config.slug}. Ejecutá: npm run update:monetaria`
    );
  }

  const filtrados = desde ? datosDiarios.filter((d) => d.fecha >= desde) : datosDiarios;
  const datosProcesados = frecuencia === "diaria" ? filtrados : agruparPorMes(filtrados);
  const datos = Number.isFinite(limit) && limit > 0 ? datosProcesados.slice(-limit) : datosProcesados;
  const ultimoDato = datos[datos.length - 1] || null;

  return {
    ...config,
    frecuencia,
    archivoPath: filePath,
    ultimoDato,
    datos,
  };
}

async function fetchMonetaryAggregates(options = {}) {
  const desde = options.desde || "2024-01-01";
  const frecuencia = options.frecuencia === "diaria" ? "diaria" : "mensual";
  const limit = Number.isFinite(options.limit) ? options.limit : 24;

  const allSeries = AGREGADOS_MONETARIOS.map((config) =>
    fetchSerieAgregado(config, { desde, frecuencia, limit: 0 })
  );

  // Calcular M3 privado = M2 privado + plazos fijos privados
  const m2Priv = allSeries.find((s) => s.slug === "m2-privado");
  const plazos = allSeries.find((s) => s.slug === "_plazo-fijo-privado");

  let m3PrivadoSerie = null;
  if (m2Priv && plazos) {
    const plazosMap = new Map(plazos.datos.map((d) => [d.fecha, d.valor]));
    const m3Datos = m2Priv.datos
      .map((d) => {
        const pf = plazosMap.get(d.fecha);
        if (pf == null) return null;
        return { fecha: d.fecha, valor: d.valor + pf };
      })
      .filter(Boolean);

    const m3Limit = limit > 0 ? m3Datos.slice(-limit) : m3Datos;
    m3PrivadoSerie = {
      slug: "m3-privado",
      nombre: "M3 privado",
      descripcion:
        "M2 privado más depósitos a plazo fijo del sector privado en pesos. Calculado como idVariable 197 + idVariable 96.",
      frecuencia,
      ultimoDato: m3Limit[m3Limit.length - 1] || null,
      datos: m3Limit,
    };
  }

  // Filtrar series internas y aplicar limit
  const series = allSeries
    .filter((s) => !s._interno)
    .map((s) => ({
      ...s,
      datos: limit > 0 ? s.datos.slice(-limit) : s.datos,
      ultimoDato: (limit > 0 ? s.datos.slice(-limit) : s.datos).at(-1) || null,
    }));

  if (m3PrivadoSerie) series.push(m3PrivadoSerie);

  return {
    fuente: "BCRA",
    desde,
    frecuencia,
    series,
  };
}

async function fetchMonetaryCatalog() {
  const now = Date.now();
  if (cacheCatalogo && now - cacheCatalogoTimestamp < CATALOGO_CACHE_TTL_MS) {
    return cacheCatalogo;
  }

  const url = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias";
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error BCRA catálogo monetarias: ${response.status}`);
  }

  const json = await response.json();
  const results = Array.isArray(json?.results) ? json.results : [];

  const catalogo = results
    .map((item) => ({
      idVariable: Number(item.idVariable),
      descripcion: item.descripcion || "",
      categoria: item.categoria || "",
      tipoSerie: item.tipoSerie || "",
      frecuencia: item.frecuencia || "",
      fecha: item.fecha || null,
    }))
    .filter((item) => Number.isFinite(item.idVariable) && item.descripcion)
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));

  const payload = {
    fuente: "BCRA",
    endpoint: url,
    total: catalogo.length,
    variables: catalogo,
  };

  cacheCatalogo = payload;
  cacheCatalogoTimestamp = now;
  return payload;
}

module.exports = {
  AGREGADOS_MONETARIOS,
  fetchMonetaryAggregates,
  fetchMonetaryCatalog,
};
