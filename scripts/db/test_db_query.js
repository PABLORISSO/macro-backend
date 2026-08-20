const { getPrismaClient } = require("../../src/db/db");

async function verify() {
  const prisma = getPrismaClient();
  const startTime = Date.now();

  try {
    const totalSeries = await prisma.series.count();
    const totalDataPoints = await prisma.dataPoint.count();

    const latestBlueVenta = await prisma.dataPoint.findFirst({
      where: { seriesCode: "TC_BLUE_VENTA" },
      orderBy: { date: "desc" },
    });

    const duration = Date.now() - startTime;

    console.log("=== VERIFICACIÓN BASE DE DATOS SUPABASE ===");
    console.log(`- Series registradas: ${totalSeries}`);
    console.log(`- Puntos de datos (observaciones): ${totalDataPoints}`);
    console.log(`- Última cotización Blue Venta: ${latestBlueVenta?.date.toISOString().slice(0, 10)} -> $${latestBlueVenta?.value}`);
    console.log(`- Tiempo de consulta SQL: ${duration} ms`);
    console.log("==========================================");
  } catch (err) {
    console.error("Error al consultar la DB:", err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
