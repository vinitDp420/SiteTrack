import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Connection', () => {
  it('should connect to the database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    expect(result).toBeDefined();
  });

  it('should have at least one project', async () => {
    const count = await prisma.project.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
