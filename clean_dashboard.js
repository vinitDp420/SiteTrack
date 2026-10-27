require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDashboard() {
  console.log('Clearing all transactional activity for a fresh dashboard...');
  const a = await prisma.attendance.deleteMany({});
  const p = await prisma.payment.deleteMany({});
  const pr = await prisma.payroll.deleteMany({});
  const f = await prisma.fraudAlert.deleteMany({});
  const t = await prisma.dailyTask.deleteMany({});
  const r = await prisma.dailyReport.deleteMany({});
  console.log(`Cleared:
- Attendance: ${a.count}
- Payments: ${p.count}
- Payroll: ${pr.count}
- Fraud Alerts: ${f.count}
- Tasks: ${t.count}
- Daily Reports: ${r.count}
`);
}

cleanDashboard()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
