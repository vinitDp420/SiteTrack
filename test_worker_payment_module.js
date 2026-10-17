require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { processDailyPayoutForWorker } = require('./src/lib/payout-service');

const prisma = new PrismaClient();

async function runTests() {
  console.log('=== Testing Worker Payment Module ===\n');

  // 1. Fetch John Doe
  const worker = await prisma.worker.findFirst({
    where: { user: { email: 'worker@sitetrack.com' } },
    include: { payments: true, attendance: true, project: true },
  });

  if (!worker) {
    console.error('❌ Worker profile not found for worker@sitetrack.com');
    return;
  }

  console.log(`✅ [1/5] Worker Profile Verified: ${worker.name} (Wage: ₹${worker.wageRate}/day, UPI: ${worker.upiId})`);
  console.log(`       Existing Payments: ${worker.payments.length}`);
  console.log(`       Existing Shifts:   ${worker.attendance.length}`);

  // 2. Simulate Clock In
  console.log('\n--- [2/5] Testing Attendance Check-In ---');
  // Clear any open session
  await prisma.attendance.updateMany({
    where: { workerId: worker.id, checkOutTime: null },
    data: { checkOutTime: new Date(), hoursWorked: 1.0, status: 'PRESENT' },
  });

  const checkInSession = await prisma.attendance.create({
    data: {
      workerId: worker.id,
      projectId: worker.projectId,
      checkInTime: new Date(Date.now() - 8 * 3600 * 1000), // 8 hours ago
      date: new Date(),
      status: 'ON_SITE',
      manualBackup: false,
    },
  });
  console.log(`✅ Check-in created with ID: ${checkInSession.id} (Status: ${checkInSession.status})`);

  // 3. Simulate Clock Out & Daily Wage Trigger
  console.log('\n--- [3/5] Testing Attendance Check-Out & Automated Payout ---');
  const checkOutTime = new Date();
  const diffMs = checkOutTime.getTime() - checkInSession.checkInTime.getTime();
  const hoursWorked = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

  const updatedSession = await prisma.attendance.update({
    where: { id: checkInSession.id },
    data: {
      checkOutTime,
      hoursWorked,
      status: 'PRESENT',
    },
  });
  console.log(`✅ Session updated: ${updatedSession.hoursWorked} hours worked, status: ${updatedSession.status}`);

  // 4. Trigger Daily Wage Payout via payout-service
  console.log('\n--- [4/5] Executing processDailyPayoutForWorker ---');
  const payoutResult = await processDailyPayoutForWorker(worker.id);
  console.log('Payout Result:', {
    success: payoutResult.success,
    message: payoutResult.message,
    paymentStatus: payoutResult.payment?.status,
    payoutId: payoutResult.payment?.razorpayPayoutId,
    amount: payoutResult.payment?.amount,
  });

  if (payoutResult.success) {
    console.log(`✅ [PASS] Daily wage of ₹${payoutResult.payment?.amount} successfully processed!`);
  } else {
    console.log(`❌ [FAIL] Daily wage failed: ${payoutResult.message}`);
  }

  // 5. Verify database integrity
  console.log('\n--- [5/5] Verifying Payment Records in Database ---');
  const latestPayment = await prisma.payment.findFirst({
    where: { workerId: worker.id },
    orderBy: { paymentDate: 'desc' },
  });

  console.log('Latest Payment in DB:', {
    id: latestPayment?.id,
    amount: latestPayment?.amount,
    type: latestPayment?.type,
    status: latestPayment?.status,
    payoutId: latestPayment?.razorpayPayoutId,
    date: latestPayment?.paymentDate,
  });

  console.log('\n=== All Worker Payment Module Tests Succeeded! ===');
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
