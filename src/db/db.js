const { PrismaClient } = require("@prisma/client");

let prisma = null;

function getPrismaClient() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return prisma;
}

function isDbAvailable() {
  return Boolean(process.env.DATABASE_URL);
}

module.exports = {
  getPrismaClient,
  isDbAvailable,
};
