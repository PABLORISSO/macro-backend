require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const indicadoresRoutes = require("./routes/indicadoresRoutes");
const inflacionRoutes = require("./routes/inflationRoute");
const exchangeRateRoute = require("./routes/exchangeRateRoute");
const reserveRoute = require("./routes/reserveRoute");
const dolaresRoute = require("./routes/dolaresRoute");
const monetaryAggregatesRoute = require("./routes/monetaryAggregatesRoute");
const aiAnalysisRoute = require("./routes/aiAnalysisRoute");
const comercioExteriorRoute = require("./routes/comercioExteriorRoute");
const emaeRoute = require("./routes/emaeRoute");
const emaeSectoresRoute = require("./routes/emaeSectoresRoute");
const itcrmRoute = require("./routes/itcrmRoute");
const ipimRoute = require("./routes/ipimRoute");
const worldBankRoute = require("./routes/worldBankRoute");
const consumoRoute = require("./routes/consumoRoute");
const { getBienes } = require('./controllers/sectorExternoController');
const sectorExternoRoute = require("./routes/sectorExternoRoute");
const { startDataUpdateScheduler } = require("./jobs/dataUpdateScheduler.cjs");


const internationalRoute = require("./routes/internationalRoute");
const ipconlineRoute = require("./routes/ipconlineRoute");
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend funcionando");
});

// quick direct endpoint to serve categorias if router mounting has issues
app.get('/api/inflacion/categorias2', (req, res) => {
  try {
    const controller = require('./controllers/inflationController');
    if (typeof controller.getInflacionCategorias === 'function') {
      return controller.getInflacionCategorias(req, res);
    }
    return res.status(500).json({ error: 'handler not available' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// direct endpoint for interanual nivel general por concepto (debug / fallback)
app.get('/api/inflacion/interanual/conceptos', (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "ipc", "ipc_interanual_largo.csv");
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'No existe ipc_interanual_largo.csv' });

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const rows = lines.slice(1).map(line => {
      const parts = line.split(',');
      return { fecha: parts[0], region: parts[1], tipo_variacion: parts[2], bloque: parts[3], concepto: parts[4], valor: Number(parts[5]) };
    });

    const norm = s => (String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
    const nivel = rows.filter(r => norm(r.bloque) === 'nivel general' && norm(r.tipo_variacion).includes('interanual'));
    if (!nivel.length) return res.status(404).json({ error: "No hay datos interanuales de Nivel general" });

    const fechas = Array.from(new Set(nivel.map(r => r.fecha))).sort();
    const latest = fechas[fechas.length - 1];

    let latestRows = nivel.filter(r => r.fecha === latest && r.region && Number.isFinite(r.valor) && /total/i.test(r.region));
    if (!latestRows.length) latestRows = nivel.filter(r => r.fecha === latest && r.region && Number.isFinite(r.valor));

    const byConcepto = new Map();
    latestRows.forEach(r => { const key = String(r.concepto).trim(); if (!byConcepto.has(key)) byConcepto.set(key, r.valor); });
    const conceptos = Array.from(byConcepto.entries()).map(([concepto, valor]) => ({ concepto, valor }));

    return res.json({ fuente: 'IPC CSV interanual', fecha: latest, items: conceptos });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});







app.use("/api/international", internationalRoute);
app.use("/api/ipconline", ipconlineRoute);
app.use("/api/indicadores", indicadoresRoutes);
app.use("/api/inflacion", inflacionRoutes);
app.use("/api", exchangeRateRoute);
app.use("/api", reserveRoute);
app.use("/api", dolaresRoute);
app.use("/api", monetaryAggregatesRoute);
app.use("/api", aiAnalysisRoute);
app.use("/api/comercio-exterior", comercioExteriorRoute);
app.use("/api/emae", emaeRoute);
app.use("/api/emae-sectores", emaeSectoresRoute);
app.use("/api/ipim", ipimRoute);
app.use("/api", itcrmRoute);
app.use("/api/worldbank", worldBankRoute);
app.use("/api", consumoRoute);
app.get('/api/sector-externo/bienes', getBienes);
app.use("/api/sector-externo", sectorExternoRoute);
// direct binding to ensure exact path is available


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  startDataUpdateScheduler();
});
