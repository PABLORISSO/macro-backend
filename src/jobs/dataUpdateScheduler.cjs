const path = require("path");
const { spawn } = require("child_process");

const BACKEND_ROOT = path.resolve(__dirname, "../..");

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const text = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(text);
}

function toInt(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

function runProcess(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: BACKEND_ROOT,
      stdio: "pipe",
      shell: false,
    });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(`[scheduler:${label}] ${chunk}`);
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(`[scheduler:${label}] ${chunk}`);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} finalizó con código ${code}`));
      }
    });
  });
}

async function runTipoCambioUpdate() {
  const runtime = String(process.env.AUTO_UPDATE_TIPOCAMBIO_RUNTIME || "python")
    .trim()
    .toLowerCase();

  if (runtime === "node" || runtime === "js") {
    await runProcess("node", ["scripts/bcra/tipo_cambio/update_tipo_cambio.js"], "tipocambio");
    return;
  }

  const pythonBin = process.env.PYTHON_BIN || "python";
  try {
    await runProcess(pythonBin, ["scripts/bcra/tipo_cambio/update_tipo_cambio.py"], "tipocambio");
  } catch (error) {
    console.warn(
      `[scheduler:tipocambio] fallo en python (${error.message}), intentando con node...`
    );
    await runProcess("node", ["scripts/bcra/tipo_cambio/update_tipo_cambio.js"], "tipocambio");
  }
}

async function runActividadUpdate() {
  const pythonBin = process.env.PYTHON_BIN || "python";
  await runProcess(pythonBin, ["scripts/indec/update_emae.py"], "emae");
  await runProcess(pythonBin, ["scripts/indec/update_emae_sectores.py"], "emae-sectores");
}

async function runConsumoUpdate() {
  const pythonBin = process.env.PYTHON_BIN || "python";
  await runProcess(pythonBin, ["scripts/indec/update_supermercados.py"], "consumo");
}

function scheduleEveryMinutes(minutes, task, label) {
  const ms = Math.max(1, minutes) * 60 * 1000;
  return setInterval(async () => {
    try {
      await task();
      console.log(`[scheduler:${label}] actualización completada`);
    } catch (error) {
      console.error(`[scheduler:${label}] error: ${error.message}`);
    }
  }, ms);
}

function scheduleDailyAt(hour, minute, task, label) {
  let running = false;

  return setInterval(async () => {
    const now = new Date();
    const isTargetTime = now.getHours() === hour && now.getMinutes() === minute;

    if (!isTargetTime || running) return;

    running = true;
    try {
      await task();
      console.log(`[scheduler:${label}] actualización diaria completada`);
    } catch (error) {
      console.error(`[scheduler:${label}] error: ${error.message}`);
    } finally {
      running = false;
    }
  }, 60 * 1000);
}

function startDataUpdateScheduler() {
  const enabled = toBool(process.env.AUTO_UPDATE_ENABLED, false);
  if (!enabled) {
    console.log("[scheduler] auto-actualización deshabilitada (AUTO_UPDATE_ENABLED=false)");
    return;
  }

  const tipoCambioMinutes = toInt(process.env.AUTO_UPDATE_TIPOCAMBIO_MINUTES, 30);
  const actividadHour = toInt(process.env.AUTO_UPDATE_ACTIVIDAD_HOUR, 7);
  const actividadMinute = toInt(process.env.AUTO_UPDATE_ACTIVIDAD_MINUTE, 10);
  const consumoHour = toInt(process.env.AUTO_UPDATE_CONSUMO_HOUR, 6);
  const consumoMinute = toInt(process.env.AUTO_UPDATE_CONSUMO_MINUTE, 0);
  const runOnStartTipoCambio = toBool(process.env.AUTO_UPDATE_RUN_ON_START_TIPOCAMBIO, false);
  const runOnStartActividad = toBool(process.env.AUTO_UPDATE_RUN_ON_START_ACTIVIDAD, false);
  const runOnStartConsumo = toBool(process.env.AUTO_UPDATE_RUN_ON_START_CONSUMO, false);

  console.log(
    `[scheduler] activo | tipo de cambio cada ${tipoCambioMinutes} min | actividad diaria ${String(
      actividadHour
    ).padStart(2, "0")}:${String(actividadMinute).padStart(2, "0")} | consumo diario ${String(
      consumoHour
    ).padStart(2, "0")}:${String(consumoMinute).padStart(2, "0")}`
  );

  scheduleEveryMinutes(tipoCambioMinutes, runTipoCambioUpdate, "tipocambio");
  scheduleDailyAt(actividadHour, actividadMinute, runActividadUpdate, "actividad");
  scheduleDailyAt(consumoHour, consumoMinute, runConsumoUpdate, "consumo");

  if (runOnStartTipoCambio) {
    runTipoCambioUpdate()
      .then(() => console.log("[scheduler:tipocambio] actualización inicial completada"))
      .catch((error) => console.error(`[scheduler:tipocambio] error inicial: ${error.message}`));
  }

  if (runOnStartActividad) {
    runActividadUpdate()
      .then(() => console.log("[scheduler:actividad] actualización inicial completada"))
      .catch((error) => console.error(`[scheduler:actividad] error inicial: ${error.message}`));
  }

  if (runOnStartConsumo) {
    runConsumoUpdate()
      .then(() => console.log("[scheduler:consumo] actualización inicial completada"))
      .catch((error) => console.error(`[scheduler:consumo] error inicial: ${error.message}`));
  }
}

module.exports = {
  startDataUpdateScheduler,
};
