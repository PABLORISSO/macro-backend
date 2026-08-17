// World Bank API Service para Argentina
// Documentación: https://datahelpdesk.worldbank.org/knowledgebase/articles/889386-developer-information

const BASE_URL = "https://api.worldbank.org/v2";
const COUNTRY_CODE = "ar"; // Argentina

// Indicadores disponibles para dashboard
const INDICADORES = {
  // GDP & Ingreso
  gdp: "NY.GDP.MKTP.CD", // GDP (current US$)
  gdpGrowth: "NY.GDP.MKTP.KD.ZG", // GDP growth (annual %)
  gdpPerCapita: "NY.GDP.PCAP.CD", // GDP per capita (current US$)

  // Inflación
  inflationCPI: "FP.CPI.TOTL.ZG", // Inflation, consumer prices (annual %)
  inflationDeflator: "NY.GDP.DEFL.KD.ZG", // Inflation, GDP deflator (annual %)

  // Empleo
  unemployment: "SL.UEM.TOTL.ZS", // Unemployment, total (% of labor force)
  youthUnemployment: "SL.UEM.1524.ZS", // Unemployment, youth (% of ages 15-24)

  // Pobreza
  povertyNational: "SI.POV.NAHC", // Poverty headcount at national lines
  giniIndex: "SI.POV.GINI", // Gini index

  // Comercio
  exports: "NE.EXP.GNFS.ZS", // Exports of goods and services (% of GDP)
  imports: "NE.IMP.GNFS.ZS", // Imports of goods and services (% of GDP)
  tradeBalance: "NE.RSB.GNFS.CD", // Trade balance (exports - imports)

  // Deuda
  externalDebt: "DT.DOD.DECT.CD", // External debt stocks, total (current US$)
  governmentDebt: "GC.DOD.TOTL.GD.ZS", // Central government debt (% of GDP)

  // Finanzas
  foreignInvestment: "BX.KLT.DINV.CD.WD", // FDI, net inflows (current US$)
  reserves: "FI.RES.TOTL.CD", // Total reserves (includes gold)

  // Demografía
  population: "SP.POP.TOTL", // Population, total
  lifeExpectancy: "SP.DYN.LE00.IN", // Life expectancy at birth
};

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días
let cacheWorldBank = {};

async function fetchWorldBankIndicator(indicatorCode, options = {}) {
  const cacheKey = `${indicatorCode}`;
  const now = Date.now();

  // Validar caché
  if (cacheWorldBank[cacheKey] && now - cacheWorldBank[cacheKey].timestamp < CACHE_TTL) {
    return cacheWorldBank[cacheKey].data;
  }

  try {
    // Parámetros
    const params = new URLSearchParams({
      format: "json",
      date: options.dateRange || "2015:2023",
      per_page: "500",
      mrnev: options.mrnev || "1", // Más reciente valor no vacío
    });

    if (options.mrv) {
      params.set("mrv", String(options.mrv)); // Últimos N años
    }

    const url = `${BASE_URL}/country/${COUNTRY_CODE}/indicator/${indicatorCode}?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`World Bank API error: ${response.status}`);
    }

    const json = await response.json();
    const metadata = json[0];
    const data = json[1] || [];

    // Procesar datos
    const series = data
      .filter((d) => d.value !== null)
      .sort((a, b) => Number(a.date) - Number(b.date))
      .map((d) => ({
        fecha: d.date,
        valor: Number(d.value),
        indicador: d.indicator.value,
        pais: d.country.value,
      }));

    const resultado = {
      indicador: indicatorCode,
      descripcion: data[0]?.indicator?.value || indicatorCode,
      pais: "Argentina",
      datos: series,
      ultimoDato: series.length ? series[series.length - 1] : null,
      fuente: "World Bank",
    };

    // Guardar en caché
    cacheWorldBank[cacheKey] = {
      data: resultado,
      timestamp: now,
    };

    return resultado;
  } catch (error) {
    console.error(`Error fetching World Bank indicator ${indicatorCode}:`, error.message);
    throw error;
  }
}

async function fetchMultipleIndicators(indicatorCodes, options = {}) {
  const promises = indicatorCodes.map((code) => fetchWorldBankIndicator(code, options));
  const resultados = await Promise.allSettled(promises);

  return resultados.map((r) => ({
    status: r.status,
    data: r.status === "fulfilled" ? r.value : null,
    error: r.status === "rejected" ? r.reason.message : null,
  }));
}

// Obtener indicadores clave para dashboard
async function fetchDashboardIndicators() {
  const indicadores = [
    INDICADORES.gdpGrowth,
    INDICADORES.inflationCPI,
    INDICADORES.unemployment,
    INDICADORES.exports,
    INDICADORES.imports,
    INDICADORES.externalDebt,
    INDICADORES.population,
  ];

  const resultados = await fetchMultipleIndicators(indicadores, { mrv: 10 });

  return {
    fuente: "World Bank API",
    pais: "Argentina",
    indicadores: resultados.map((r) => r.data).filter(Boolean),
    timestamp: new Date().toISOString(),
  };
}

// Comparativa regional (Argentina vs socios comerciales)
async function fetchRegionalComparison(indicatorCode, countries = ["ar", "br", "chl", "col"]) {
  const cacheKey = `regional-${indicatorCode}`;
  const now = Date.now();

  if (cacheWorldBank[cacheKey] && now - cacheWorldBank[cacheKey].timestamp < CACHE_TTL) {
    return cacheWorldBank[cacheKey].data;
  }

  try {
    const countryList = countries.join(";");
    const params = new URLSearchParams({
      format: "json",
      date: "2015:2023",
      per_page: "500",
    });

    const url = `${BASE_URL}/country/${countryList}/indicator/${indicatorCode}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`World Bank API error: ${response.status}`);
    }

    const json = await response.json();
    const data = json[1] || [];

    // Agrupar por país
    const porPais = {};
    data.forEach((d) => {
      if (d.value === null) return;
      const pais = d.country.value;
      if (!porPais[pais]) {
        porPais[pais] = [];
      }
      porPais[pais].push({
        fecha: d.date,
        valor: Number(d.value),
      });
    });

    // Ordenar por fecha
    Object.keys(porPais).forEach((pais) => {
      porPais[pais].sort((a, b) => Number(a.fecha) - Number(b.fecha));
    });

    const resultado = {
      indicador: indicatorCode,
      paises: Object.keys(porPais),
      datos: porPais,
      fuente: "World Bank",
    };

    cacheWorldBank[cacheKey] = {
      data: resultado,
      timestamp: now,
    };

    return resultado;
  } catch (error) {
    console.error(`Error fetching regional comparison:`, error.message);
    throw error;
  }
}

module.exports = {
  fetchWorldBankIndicator,
  fetchMultipleIndicators,
  fetchDashboardIndicators,
  fetchRegionalComparison,
  INDICADORES,
};
