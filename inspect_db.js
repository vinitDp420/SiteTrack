const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const workers = await prisma.worker.findMany({
    include: { attendance: true, payments: true }
  });
  console.log(JSON.stringify(workers, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
