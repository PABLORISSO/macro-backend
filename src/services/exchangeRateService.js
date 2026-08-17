const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data", "tipo_cambio");

const ARCHIVOS = {
  mayorista: path.join(DATA_DIR, "tc_mayorista.csv"),
  mayorista_compra: path.join(DATA_DIR, "tc_mayorista_arg_datos_compra.csv"),
  mayorista_venta: path.join(DATA_DIR, "tc_mayorista_arg_datos_venta.csv"),
  minorista_compra: path.join(DATA_DIR, "tc_minorista_compra.csv"),
  minorista_venta: path.join(DATA_DIR, "tc_minorista_venta.csv"),
  blue_compra: path.join(DATA_DIR, "tc_blue_compra.csv"),
  blue_venta: path.join(DATA_DIR, "tc_blue_venta.csv"),
  mep_compra: path.join(DATA_DIR, "tc_mep_compra.csv"),
  mep_venta: path.join(DATA_DIR, "tc_mep_venta.csv"),
  ccl_compra: path.join(DATA_DIR, "tc_ccl_compra.csv"),
  ccl_venta: path.join(DATA_DIR, "tc_ccl_venta.csv"),
  oficial_compra: path.join(DATA_DIR, "tc_oficial_minorista_compra.csv"),
  oficial_venta: path.join(DATA_DIR, "tc_oficial_minorista_venta.csv"),
};

const SERIES_CONFIG = {
  mayorista: {
    codigo: "mayorista",
    nombre: "Dólar mayorista",
    tipo: "referencia",
    mercado: "mayorista",
    archivo: "mayorista",
    aliases: ["mayorista", "a3500", "oficial_mayorista"],
  },
  mayorista_compra: {
    codigo: "mayorista_compra",
    nombre: "Dólar mayorista compra",
    tipo: "compra",
    mercado: "mayorista",
    archivo: "mayorista_compra",
    aliases: ["mayorista_compra", "mayorista-compra"],
  },
  mayorista_venta: {
    codigo: "mayorista_venta",
    nombre: "Dólar mayorista venta",
    tipo: "venta",
    mercado: "mayorista",
    archivo: "mayorista_venta",
    aliases: ["mayorista_venta", "mayorista-venta"],
  },
  oficial_compra: {
    codigo: "oficial_compra",
    nombre: "Dólar oficial compra",
    tipo: "compra",
    mercado: "oficial",
    archivo: "oficial_compra",
    aliases: ["oficial_compra", "oficial-compra", "oficial compra"],
  },
  oficial_venta: {
    codigo: "oficial_venta",
    nombre: "Dólar oficial venta",
    tipo: "venta",
    mercado: "oficial",
    archivo: "oficial_venta",
    aliases: ["oficial_venta", "oficial-venta", "oficial", "oficial venta"],
  },
  minorista_compra: {
    codigo: "minorista_compra",
    nombre: "Dólar minorista compra",
    tipo: "compra",
    mercado: "minorista",
    archivo: "minorista_compra",
    aliases: ["minorista_compra", "minorista-compra", "minorista compra"],
  },
  minorista_venta: {
    codigo: "minorista_venta",
    nombre: "Dólar minorista venta",
    tipo: "venta",
    mercado: "minorista",
    archivo: "minorista_venta",
    aliases: ["minorista_venta", "minorista-venta", "minorista", "minorista venta"],
  },
  blue_compra: {
    codigo: "blue_compra",
    nombre: "Dólar blue compra",
    tipo: "compra",
    mercado: "blue",
    archivo: "blue_compra",
    aliases: ["blue_compra", "blue-compra", "blue compra"],
  },
  blue_venta: {
    codigo: "blue_venta",
    nombre: "Dólar blue venta",
    tipo: "venta",
    mercado: "blue",
    archivo: "blue_venta",
    aliases: ["blue_venta", "blue-venta", "blue", "blue venta"],
  },
  mep_compra: {
    codigo: "mep_compra",
    nombre: "Dólar MEP compra",
    tipo: "compra",
    mercado: "mep",
    archivo: "mep_compra",
    aliases: ["mep_compra", "mep-compra", "mep compra"],
  },
  mep_venta: {
    codigo: "mep_venta",
    nombre: "Dólar MEP venta",
    tipo: "venta",
    mercado: "mep",
    archivo: "mep_venta",
    aliases: ["mep_venta", "mep-venta", "mep", "bolsa"],
  },
  ccl_compra: {
    codigo: "ccl_compra",
    nombre: "Dólar CCL compra",
    tipo: "compra",
    mercado: "ccl",
    archivo: "ccl_compra",
    aliases: ["ccl_compra", "ccl-compra", "ccl compra"],
  },
  ccl_venta: {
    codigo: "ccl_venta",
    nombre: "Dólar CCL venta",
    tipo: "venta",
    mercado: "ccl",
    archivo: "ccl_venta",
    aliases: ["ccl_venta", "ccl-venta", "ccl", "contadoconliqui"],
  },
};

const FAMILIES_CONFIG = {
  mayorista: {
    codigo: "mayorista",
    nombre: "Dólar mayorista",
    referencia: "mayorista",
    compra: "mayorista_compra",
    venta: "mayorista_venta",
  },
  oficial: {
    codigo: "oficial",
    nombre: "Dólar oficial",
    compra: "oficial_compra",
    venta: "oficial_venta",
  },
  minorista: {
    codigo: "minorista",
    nombre: "Dólar minorista",
    compra: "minorista_compra",
    venta: "minorista_venta",
  },
  blue: {
    codigo: "blue",
    nombre: "Dólar blue",
    compra: "blue_compra",
    venta: "blue_venta",
  },
  mep: {
    codigo: "mep",
    nombre: "Dólar MEP",
    compra: "mep_compra",
    venta: "mep_venta",
  },
  ccl: {
    codigo: "ccl",
    nombre: "Dólar CCL",
    compra: "ccl_compra",
    venta: "ccl_venta",
  },
};

const DEFAULT_TABLE_SERIES = ["mayorista", "oficial_venta", "blue_venta", "mep_venta", "ccl_venta"];
const DEFAULT_QUOTE_FAMILIES = ["mayorista", "oficial", "blue", "mep", "ccl"];

function leerCsvLocal(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return null;
  return lines.slice(1)
    .map((line) => {
      const [fecha, valor] = line.split(",");
      return { fecha: (fecha || "").trim(), valor: Number(valor) };
    })
    .filter((d) => d.fecha && Number.isFinite(d.valor))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function normalizarClave(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function crearError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseListadoEntrada(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolverClaveSerie(nombre) {
  const normalizada = normalizarClave(nombre);
  if (!normalizada) return null;

  for (const [key, config] of Object.entries(SERIES_CONFIG)) {
    if (normalizada === key) return key;
    if (config.aliases?.some((alias) => normalizarClave(alias) === normalizada)) {
      return key;
    }
  }

  return null;
}

function resolverFamilia(nombre) {
  const normalizada = normalizarClave(nombre);
  if (!normalizada) return null;

  if (FAMILIES_CONFIG[normalizada]) return normalizada;

  const aliasToFamily = {
    bolsa: "mep",
    contadoconliqui: "ccl",
  };

  return aliasToFamily[normalizada] || null;
}

function obtenerSerieLocal(clave) {
  const config = SERIES_CONFIG[clave];
  if (!config) {
    throw crearError(`Serie '${clave}' no encontrada`, 404);
  }

  const filePath = ARCHIVOS[config.archivo];
  const datos = leerCsvLocal(filePath);
  if (!datos || !datos.length) {
    throw crearError(`No hay datos para la serie '${config.codigo}'`, 404);
  }

  return {
    ...config,
    fuente: "CSV local tipo de cambio",
    archivoPath: filePath,
    datos,
    ultimoDato: datos[datos.length - 1] ?? null,
    fechaInicio: datos[0]?.fecha ?? null,
    fechaFin: datos[datos.length - 1]?.fecha ?? null,
  };
}

function filtrarDesde(datos, desde) {
  if (!desde) return datos;
  return datos.filter((d) => d.fecha >= desde);
}

function filtrarHasta(datos, hasta) {
  if (!hasta) return datos;
  return datos.filter((d) => d.fecha <= hasta);
}

function agruparMensual(datos) {
  const porMes = new Map();
  for (const item of datos) {
    const mes = item.fecha.slice(0, 7);
    porMes.set(mes, item); // último del mes
  }
  return [...porMes.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function aplicarTransformaciones(datos, options = {}) {
  const frecuencia = options.frecuencia === "mensual" ? "mensual" : "diaria";
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? options.limit : null;

  let resultado = filtrarDesde(datos, options.desde || null);
  resultado = filtrarHasta(resultado, options.hasta || null);

  if (frecuencia === "mensual") {
    resultado = agruparMensual(resultado);
  }

  if (limit) {
    resultado = resultado.slice(-limit);
  }

  return { datos: resultado, frecuencia };
}

async function fetchExchangeRateLocal(options = {}) {
  const serieClave = resolverClaveSerie(options.serie || "mayorista") || "mayorista";

  let serie;
  try {
    serie = obtenerSerieLocal(serieClave);
  } catch (error) {
    if (serieClave !== "mayorista") throw error;
    return null;
  }

  const { datos, frecuencia } = aplicarTransformaciones(serie.datos, options);

  return {
    serie: serie.codigo,
    nombreSerie: serie.nombre,
    mercado: serie.mercado,
    tipo: serie.tipo,
    fuente: serie.fuente,
    desde: options.desde || null,
    hasta: options.hasta || null,
    frecuencia,
    datos,
    ultimoDato: datos[datos.length - 1] ?? null,
  };
}

async function fetchExchangeRateAPI(options = {}) {
  const desde = options.desde || "2025-01-01";
  const frecuencia = options.frecuencia === "mensual" ? "mensual" : "diaria";
  const limit = Number.isFinite(options.limit) ? options.limit : 400;

  const response = await fetch(
    `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/5?Desde=${desde}`
  );

  if (!response.ok) {
    throw new Error(`Error BCRA: ${response.status}`);
  }

  const json = await response.json();
  const detalle = json?.results?.[0]?.detalle || [];

  const datosOrdenados = detalle
    .map((item) => ({
      fecha: item.fecha,
      valor: Number(item.valor),
    }))
    .filter((item) => item.fecha && Number.isFinite(item.valor))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const datosProcesados = frecuencia === "mensual" ? agruparMensual(datosOrdenados) : datosOrdenados;
  const datos = Number.isFinite(limit) && limit > 0 ? datosProcesados.slice(-limit) : datosProcesados;

  return {
    fuente: "BCRA API",
    desde,
    frecuencia,
    ultimoDato: datos[datos.length - 1] || null,
    datos,
  };
}

async function fetchExchangeRate(options = {}) {
  const local = await fetchExchangeRateLocal(options).catch(() => null);
  if (local && local.datos.length > 0) return local;

  return fetchExchangeRateAPI(options);
}

function leerSeriesLocales(nombres) {
  const resultado = {};
  for (const [key, filePath] of Object.entries(ARCHIVOS)) {
    if (!nombres || nombres.includes(key)) {
      const datos = leerCsvLocal(filePath);
      if (datos) {
        resultado[key] = {
          datos,
          ultimoDato: datos[datos.length - 1] ?? null,
        };
      }
    }
  }
  return resultado;
}

function getExchangeRateSeriesCatalog() {
  return Object.keys(SERIES_CONFIG)
    .map((key) => {
      try {
        const serie = obtenerSerieLocal(key);
        return {
          codigo: serie.codigo,
          nombre: serie.nombre,
          mercado: serie.mercado,
          tipo: serie.tipo,
          fuente: serie.fuente,
          fechaInicio: serie.fechaInicio,
          fechaFin: serie.fechaFin,
          ultimoDato: serie.ultimoDato,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getHistoricalExchangeRateSeries(nombre, options = {}) {
  const clave = resolverClaveSerie(nombre);
  if (!clave) {
    throw crearError(`Serie '${nombre}' no encontrada`, 404);
  }

  const serie = obtenerSerieLocal(clave);
  const { datos, frecuencia } = aplicarTransformaciones(serie.datos, options);

  return {
    serie: serie.codigo,
    nombreSerie: serie.nombre,
    mercado: serie.mercado,
    tipo: serie.tipo,
    fuente: serie.fuente,
    desde: options.desde || null,
    hasta: options.hasta || null,
    frecuencia,
    datos,
    ultimoDato: datos[datos.length - 1] ?? null,
  };
}

function resolverSeriesTabla(series) {
  const requested = parseListadoEntrada(series);
  const base = requested.length ? requested : DEFAULT_TABLE_SERIES;

  return base.map((nombre) => {
    const clave = resolverClaveSerie(nombre);
    if (!clave) {
      throw crearError(`Serie '${nombre}' no encontrada`, 400);
    }
    return clave;
  });
}

function getExchangeRateTable(options = {}) {
  const order = String(options.orden || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  const seriesKeys = [...new Set(resolverSeriesTabla(options.series))];

  const series = seriesKeys.map((key) => getHistoricalExchangeRateSeries(key, options));
  const rowsMap = new Map();

  for (const serie of series) {
    for (const item of serie.datos) {
      const current = rowsMap.get(item.fecha) || { fecha: item.fecha };
      current[serie.serie] = item.valor;
      rowsMap.set(item.fecha, current);
    }
  }

  let filas = [...rowsMap.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimaFila = filas[filas.length - 1] ?? null;
  if (order === "desc") {
    filas = filas.reverse();
  }

  return {
    fuente: "CSV local tipo de cambio",
    frecuencia: series[0]?.frecuencia || "diaria",
    desde: options.desde || null,
    hasta: options.hasta || null,
    orden: order,
    series: series.map((serie) => ({
      codigo: serie.serie,
      nombre: serie.nombreSerie,
      mercado: serie.mercado,
      tipo: serie.tipo,
      ultimoDato: serie.ultimoDato,
    })),
    columnas: [
      { key: "fecha", label: "Fecha", type: "date" },
      ...series.map((serie) => ({
        key: serie.serie,
        label: serie.nombreSerie,
        mercado: serie.mercado,
        tipo: serie.tipo,
        type: "number",
      })),
    ],
    filas,
    ultimaFila,
  };
}

function resolverFamiliasCotizacion(familias) {
  const requested = parseListadoEntrada(familias);
  const base = requested.length ? requested : DEFAULT_QUOTE_FAMILIES;

  return base.map((nombre) => {
    const clave = resolverFamilia(nombre);
    if (!clave || !FAMILIES_CONFIG[clave]) {
      throw crearError(`Familia '${nombre}' no encontrada`, 400);
    }
    return clave;
  });
}

function getCurrentExchangeRatesTable(options = {}) {
  const families = [...new Set(resolverFamiliasCotizacion(options.familias || options.series))];
  const filas = families.map((familyKey) => {
    const family = FAMILIES_CONFIG[familyKey];
    const compra = family.compra ? obtenerSerieLocal(family.compra).ultimoDato : null;
    const venta = family.venta ? obtenerSerieLocal(family.venta).ultimoDato : null;
    const referencia = family.referencia ? obtenerSerieLocal(family.referencia).ultimoDato : null;
    const fecha = [compra?.fecha, venta?.fecha, referencia?.fecha].filter(Boolean).sort().at(-1) || null;
    const compraValor = compra?.valor ?? null;
    const ventaValor = venta?.valor ?? null;
    const referenciaValor = referencia?.valor ?? null;

    return {
      codigo: family.codigo,
      nombre: family.nombre,
      fecha,
      compra: compraValor,
      venta: ventaValor,
      referencia: referenciaValor,
      spread: Number.isFinite(compraValor) && Number.isFinite(ventaValor)
        ? Number((ventaValor - compraValor).toFixed(4))
        : null,
    };
  });

  return {
    fuente: "CSV local tipo de cambio",
    fechaActualizacion: filas.map((fila) => fila.fecha).filter(Boolean).sort().at(-1) || null,
    columnas: [
      { key: "codigo", label: "Código", type: "string" },
      { key: "nombre", label: "Nombre", type: "string" },
      { key: "fecha", label: "Fecha", type: "date" },
      { key: "compra", label: "Compra", type: "number" },
      { key: "venta", label: "Venta", type: "number" },
      { key: "referencia", label: "Referencia", type: "number" },
      { key: "spread", label: "Spread", type: "number" },
    ],
    filas,
  };
}

function getLegacyDollarQuotes() {
  const table = getCurrentExchangeRatesTable();
  return table.filas.reduce((acc, fila) => {
    acc[fila.codigo] = {
      nombre: fila.nombre,
      fecha: fila.fecha,
      compra: fila.compra,
      venta: fila.venta,
      valor: fila.referencia ?? fila.venta ?? fila.compra,
    };
    return acc;
  }, {});
}

module.exports = {
  fetchExchangeRate,
  leerSeriesLocales,
  getExchangeRateSeriesCatalog,
  getHistoricalExchangeRateSeries,
  getExchangeRateTable,
  getCurrentExchangeRatesTable,
  getLegacyDollarQuotes,
  resolverClaveSerie,
  ARCHIVOS,
};