import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Ensure database is available
  try {
    await prisma.$connect();
  } catch (e) {
    console.warn('Database not available for tests:', e);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
