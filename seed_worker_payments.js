require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding John Doe Shift & Payment History ---');

  const worker = await prisma.worker.findFirst({
    where: { user: { email: 'worker@sitetrack.com' } },
    include: { project: true }
  });

  if (!worker) {
    console.error('Worker profile not found for worker@sitetrack.com!');
    return;
  }

  console.log(`Found worker: ${worker.name} (ID: ${worker.id}) on project ${worker.project.name}`);

  // Create 7 days of past completed shifts and payments
  const now = new Date();
  
  for (let i = 6; i >= 1; i--) {
    const shiftDate = new Date();
    shiftDate.setDate(now.getDate() - i);
    shiftDate.setHours(9, 0, 0, 0); // 9:00 AM

    const checkOut = new Date(shiftDate);
    checkOut.setHours(17, 30, 0, 0); // 5:30 PM (8.5 hrs)

    // Check if attendance already exists for this date
    const dayStart = new Date(shiftDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(shiftDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingAtt = await prisma.attendance.findFirst({
      where: {
        workerId: worker.id,
        date: { gte: dayStart, lte: dayEnd }
      }
    });

    if (!existingAtt) {
      await prisma.attendance.create({
        data: {
          workerId: worker.id,
          projectId: worker.projectId,
          checkInTime: shiftDate,
          checkOutTime: checkOut,
          date: shiftDate,
          hoursWorked: 8.5,
          status: 'PRESENT',
          manualBackup: false
        }
      });
      console.log(`✅ Created attendance shift for ${shiftDate.toLocaleDateString('en-IN')}`);
    }

    // Check if payment already exists for this date
    const existingPayment = await prisma.payment.findFirst({
      where: {
        workerId: worker.id,
        paymentDate: { gte: dayStart, lte: dayEnd }
      }
    });

    if (!existingPayment) {
      const payoutId = `sim_payout_${Date.now() - i * 86400000}_${Math.random().toString(36).substring(2, 7)}`;
      await prisma.payment.create({
        data: {
          workerId: worker.id,
          projectId: worker.projectId,
          amount: worker.wageRate,
          type: 'DAILY',
          status: 'SUCCESS',
          razorpayPayoutId: payoutId,
          paymentDate: checkOut,
        }
      });
      console.log(`✅ Created payout of ₹${worker.wageRate} for ${shiftDate.toLocaleDateString('en-IN')} (${payoutId})`);
    }
  }

  // Ensure worker has UPI ID and Bank Details configured
  await prisma.worker.update({
    where: { id: worker.id },
    data: {
      upiId: 'john.doe@upi',
      bankAccountName: 'John Doe',
      bankAccountNumber: '918237465012',
      ifscCode: 'SBIN0001234',
      paymentType: 'DAILY',
      wageRate: 850
    }
  });

  console.log('\n--- Seed Complete ---');
  const countP = await prisma.payment.count({ where: { workerId: worker.id } });
  const countA = await prisma.attendance.count({ where: { workerId: worker.id } });
  console.log(`Total Payments for John Doe: ${countP}`);
  console.log(`Total Attendance for John Doe: ${countA}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
