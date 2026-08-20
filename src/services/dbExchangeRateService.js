const { getPrismaClient, isDbAvailable } = require("../db/db");

const CODE_MAP = {
  mayorista: "TC_MAYORISTA",
  blue_compra: "TC_BLUE_COMPRA",
  blue_venta: "TC_BLUE_VENTA",
  ccl_compra: "TC_CCL_COMPRA",
  ccl_venta: "TC_CCL_VENTA",
  mep_compra: "TC_MEP_COMPRA",
  mep_venta: "TC_MEP_VENTA",
};

async function getHistoricalSeriesFromDb(serieKey, { desde, hasta, limit } = {}) {
  if (!isDbAvailable()) return null;

  const prisma = getPrismaClient();
  if (!prisma) return null;

  const seriesCode = CODE_MAP[serieKey] || serieKey;

  const where = {
    seriesCode: seriesCode,
  };

  if (desde || hasta) {
    where.date = {};
    if (desde) where.date.gte = new Date(desde);
    if (hasta) where.date.lte = new Date(hasta);
  }

  const queryOptions = {
    where,
    orderBy: { date: "asc" },
  };

  if (limit && Number.isInteger(limit) && limit > 0) {
    queryOptions.take = limit;
  }

  const records = await prisma.dataPoint.findMany(queryOptions);

  return records.map((r) => ({
    fecha: r.date.toISOString().slice(0, 10),
    valor: r.value,
  }));
}

module.exports = {
  getHistoricalSeriesFromDb,
};
