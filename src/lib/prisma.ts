import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

let databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/sitetrack?schema=public';

if (databaseUrl.includes('127.0.0.1') || databaseUrl.includes('localhost')) {
  try {
    const wslIp = execSync('wsl.exe hostname -I').toString().trim().split(' ')[0];
    if (wslIp) {
      databaseUrl = databaseUrl.replace('127.0.0.1', wslIp).replace('localhost', wslIp);
      console.log(`[Prisma] Dynamically resolved database URL: postgresql://postgres:***@${wslIp}:5432/sitetrack`);
    }
  } catch (e) {
    console.warn('[Prisma] Failed to resolve WSL IP, falling back to default loopback:', e);
  }
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
