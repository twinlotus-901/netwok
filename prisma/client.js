// Load env vars first so DATABASE_URL is available
require('dotenv/config');

const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { PrismaClient } = require('@prisma/client');

const factory = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter: factory });

async function connectPrisma() {
  try {
    await prisma.$connect();
    console.log('Prisma connected to database.');
  } catch (error) {
    console.error('Prisma connection failed:', error.message || error);
    process.exit(1);
  }
}

connectPrisma();

const shutdown = async () => {
  try {
    await prisma.$disconnect();
  } catch (err) {
    // ignore disconnect errors on shutdown
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);

module.exports = { prisma };

