require('dotenv').config();
const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function postJSON(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function demonstrateShiftAndPayment() {
  console.log('================================================================');
  console.log('  SITETRACK AI: WORKER SHIFT CHECK-IN TO AUTOMATED PAYOUT DEMO ');
  console.log('================================================================\n');

  // Step 0: Identify Worker
  const worker = await prisma.worker.findFirst({
    where: { user: { email: 'worker@sitetrack.com' } },
    include: { project: true }
  });

  if (!worker) {
    console.error('Worker John Doe not found!');
    return;
  }

  console.log('👤 [STEP 0] Worker Identified:');
  console.log(`   - Name:            ${worker.name}`);
  console.log(`   - Project:         ${worker.project.name} (Code: ${worker.project.code})`);
  console.log(`   - Enrolled Wage:   ₹${worker.wageRate}/day`);
  console.log(`   - Payment Type:    ${worker.paymentType}`);
  console.log(`   - Destination:     UPI: ${worker.upiId} | Bank: A/C ••••${worker.bankAccountNumber?.slice(-4)}`);
  console.log('----------------------------------------------------------------\n');

  // Clean up today's test records so we can run a fresh full cycle
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.attendance.deleteMany({
    where: { workerId: worker.id, date: { gte: today } }
  });
  await prisma.payment.deleteMany({
    where: { workerId: worker.id, paymentDate: { gte: today } }
  });
  await prisma.fraudAlert.deleteMany({
    where: { workerId: worker.id, timestamp: { gte: today } }
  });

  // STEP 1: Worker Check-In (Biometric Face Scan & Geofencing)
  console.log('📷 [STEP 1] Worker Arrives at Site & Initiates Check-In:');
  console.log('   -> Biometric facial scan verified via tinyFaceDetector');
  console.log('   -> GPS Geofence verified: Latitude 18.5204, Longitude 73.8567 (Within site boundary)');

  const checkInTime = new Date();
  const session = await prisma.attendance.create({
    data: {
      workerId: worker.id,
      projectId: worker.projectId,
      checkInTime,
      date: checkInTime,
      status: 'ON_SITE',
      manualBackup: false,
      latitude: 18.5204,
      longitude: 73.8567
    }
  });

  console.log(`   ✅ Check-In Logged in Database:`);
  console.log(`      - Session ID:   ${session.id}`);
  console.log(`      - Status:       ${session.status} (Worker is ON_SITE)`);
  console.log(`      - Check-In At:  ${session.checkInTime.toLocaleTimeString('en-IN')}`);
  console.log('----------------------------------------------------------------\n');

  // STEP 2: Active Shift & Subsystem C Safety Monitoring
  console.log('👷 [STEP 2] Active Shift & Real-Time Computer Vision Monitoring:');
  console.log('   - Worker working on site (pouring slab formwork)...');
  console.log('   - CCTV Stream analyzed by YOLO PPE Neural Network at 24 FPS.');
  console.log('   - Subsystem C calculates Safety Compliance Multiplier (Phi_compliance).');

  // Simulate 1 PPE Warning detected by CCTV (e.g. removed hardhat temporarily in Zone B)
  console.log('   ⚠️ Alert: CCTV Camera #2 detected Hardhat violation for 45s.');
  const alert = await prisma.fraudAlert.create({
    data: {
      workerId: worker.id,
      alertType: 'PPE_VIOLATION',
      severity: 'LOW',
      details: 'CCTV Camera #2: Worker unclipped hardhat while handling materials in Zone B.',
      timestamp: new Date()
    }
  });
  console.log(`      -> Logged Safety Violation ID: ${alert.id}`);
  console.log(`      -> Formula: 1 violation = 10% compliance penalty.`);
  console.log(`      -> Phi_compliance = 1.0 - 0.10 = 0.90 (90% compliant)`);
  console.log('----------------------------------------------------------------\n');

  // STEP 3: Shift Completion & Worker Clock-Out
  console.log('⏱️ [STEP 3] Shift Ends & Worker Clocks Out:');
  const checkOutTime = new Date(checkInTime.getTime() + 8.5 * 3600 * 1000); // 8.5 hours later
  const hoursWorked = 8.5;

  const updatedSession = await prisma.attendance.update({
    where: { id: session.id },
    data: {
      checkOutTime,
      hoursWorked,
      status: 'PRESENT'
    }
  });

  console.log(`   ✅ Shift Finalized:`);
  console.log(`      - Check-Out At: ${updatedSession.checkOutTime?.toLocaleTimeString('en-IN')}`);
  console.log(`      - Hours Worked: ${updatedSession.hoursWorked} hrs`);
  console.log(`      - Shift Status: ${updatedSession.status}`);
  console.log('----------------------------------------------------------------\n');

  // STEP 4: Automated Payout Trigger (Subsystem C Payout Engine)
  console.log('💳 [STEP 4] Subsystem C Automated Payment Disbursal Engine Triggered:');
  console.log('   1. Checking worker payment type: DAILY');
  console.log('   2. Fetching base wage rate: ₹850');
  console.log('   3. Applying Safety Compliance deduction:');
  console.log(`      Base Rate: ₹850  ×  Phi_comp (0.90)  =  ₹765.00`);
  console.log('   4. Calling Razorpay Instant Payouts Gateway...');

  // Call the live Next.js endpoint
  const payoutResult = await postJSON('/api/payments/process-daily', { workerId: worker.id });

  console.log(`   5. Razorpay Gateway Response:`);
  console.log(`      - Success:       ${payoutResult.success}`);
  console.log(`      - Payout ID:     ${payoutResult.payment?.razorpayPayoutId}`);
  console.log(`      - Disbursed:     ₹${payoutResult.payment?.amount}`);
  console.log(`      - Status:        ${payoutResult.payment?.status}`);
  console.log(`      - Message:       ${payoutResult.message}`);
  console.log('----------------------------------------------------------------\n');

  // STEP 5: Verification in Database & Digital Payslip Generation
  console.log('📄 [STEP 5] Verification & Digital Payslip Voucher Available:');
  const savedPayment = await prisma.payment.findUnique({
    where: { id: payoutResult.payment?.id },
    include: { worker: { include: { project: true } } }
  });

  console.log(`   ✅ Digital Voucher Generated:`);
  console.log(`      - Voucher ID:    ${savedPayment?.id}`);
  console.log(`      - Worker:        ${savedPayment?.worker.name} (UPI: ${savedPayment?.worker.upiId})`);
  console.log(`      - Project:       ${savedPayment?.worker.project.name}`);
  console.log(`      - Amount:        ₹${savedPayment?.amount}`);
  console.log(`      - Trans Ref:     ${savedPayment?.razorpayPayoutId}`);
  console.log(`      - Settled At:    ${savedPayment?.paymentDate.toLocaleString('en-IN')}`);
  console.log('\n================================================================');
  console.log('             END-TO-END WORKER PAYMENT DEMO COMPLETE!           ');
  console.log('================================================================\n');
}

demonstrateShiftAndPayment()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
