require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAllWorkers() {
  console.log('--- Wiping all workers and related data for a 100% fresh start ---');
  
  // 1. Delete dependent face embeddings & fraud alerts
  const fe = await prisma.faceEmbedding.deleteMany({});
  const fa = await prisma.fraudAlert.deleteMany({});
  
  // 2. Delete attendance, payroll, payments
  const att = await prisma.attendance.deleteMany({});
  const pay = await prisma.payment.deleteMany({});
  const pr = await prisma.payroll.deleteMany({});

  // 3. Clear worker task and tool assignments
  const dt = await prisma.dailyTask.deleteMany({});
  const tools = await prisma.tool.deleteMany({});

  // 4. Delete all workers
  const w = await prisma.worker.deleteMany({});

  // 5. Delete worker user accounts (leaving admin & supervisor)
  const u = await prisma.user.deleteMany({
    where: {
      role: 'WORKER',
    },
  });

  console.log(`Successfully deleted:
- Workers: ${w.count}
- Worker User logins: ${u.count}
- Face Embeddings: ${fe.count}
- Fraud Alerts: ${fa.count}
- Attendance: ${att.count}
- Payments: ${pay.count}
- Payrolls: ${pr.count}
- Tasks: ${dt.count}
- Tools: ${tools.count}
`);
}

cleanAllWorkers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
