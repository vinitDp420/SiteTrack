const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.count();
  const projects = await prisma.project.count();
  const workers = await prisma.worker.count();
  const attendance = await prisma.attendance.count();
  const payroll = await prisma.payroll.count();
  const payments = await prisma.payment.count();
  const fraudAlerts = await prisma.fraudAlert.count();
  const scheduleMilestones = await prisma.scheduleMilestone.count();
  const boqItems = await prisma.bOQItem.count();
  const materialRequests = await prisma.materialRequest.count();
  const stockItems = await prisma.stockItem.count();
  const suppliers = await prisma.supplier.count();
  const vehicles = await prisma.vehicle.count();
  const vehicleLogs = await prisma.vehicleLog.count();
  const tools = await prisma.tool.count();
  const reminders = await prisma.reminder.count();

  console.log(JSON.stringify({
    users,
    projects,
    workers,
    attendance,
    payroll,
    payments,
    fraudAlerts,
    scheduleMilestones,
    boqItems,
    materialRequests,
    stockItems,
    suppliers,
    vehicles,
    vehicleLogs,
    tools,
    reminders,
  }, null, 2));

  await prisma.$disconnect();
}

check().catch(console.error);
