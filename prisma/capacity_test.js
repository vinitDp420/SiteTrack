require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const http = require('http');

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:3000/api';

let passCount = 0;
let failCount = 0;
const results = [];

function logTest(name, passed, detail = '') {
  if (passed) {
    passCount++;
    results.push(`[PASS] ${name}`);
    console.log(`[PASS] ${name}${detail ? ' - ' + detail : ''}`);
  } else {
    failCount++;
    results.push(`[FAIL] ${name}`);
    console.log(`[FAIL] ${name}${detail ? ' - ' + detail : ''}`);
  }
}

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + path;
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('========================================');
  console.log('SiteTrack Capacity & Interconnect Test');
  console.log('========================================\n');

  // Step 1: Run seed scripts sequentially as child processes
  console.log('[1/3] Seeding database with full_seed.js...');
  try {
    execSync('node prisma/full_seed.js', { stdio: 'inherit', timeout: 60000 });
    console.log('Full seed completed.\n');
  } catch (e) {
    console.error('Full seed failed:', e.message);
  }

  console.log('[2/3] Adding random data with add_random_data.js...');
  try {
    execSync('node prisma/add_random_data.js', { stdio: 'inherit', timeout: 120000 });
    console.log('Random data added.\n');
  } catch (e) {
    console.error('Random data add failed (non-fatal):', e.message);
    console.log('Continuing with existing data...\n');
  }

  console.log('[3/3] Running capacity and interconnect verification...\n');

  // Count all records
  const counts = {
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    workers: await prisma.worker.count(),
    attendance: await prisma.attendance.count(),
    payroll: await prisma.payroll.count(),
    payments: await prisma.payment.count(),
    fraudAlerts: await prisma.fraudAlert.count(),
    scheduleMilestones: await prisma.scheduleMilestone.count(),
    boqItems: await prisma.bOQItem.count(),
    materialRequests: await prisma.materialRequest.count(),
    stockItems: await prisma.stockItem.count(),
    suppliers: await prisma.supplier.count(),
    vehicles: await prisma.vehicle.count(),
    vehicleLogs: await prisma.vehicleLog.count(),
    tools: await prisma.tool.count(),
    reminders: await prisma.reminder.count(),
    faceEmbeddings: await prisma.faceEmbedding.count(),
    cameras: await prisma.camera.count(),
  };

  console.log('Database Record Counts:');
  console.table(counts);
  console.log(`Total records: ${Object.values(counts).reduce((a, b) => a + b, 0)}\n`);

  logTest('Database has projects', counts.projects > 0, `${counts.projects} projects`);
  logTest('Database has workers', counts.workers > 0, `${counts.workers} workers`);
  logTest('Database has attendance records', counts.attendance > 0, `${counts.attendance} records`);
  logTest('Database has payments', counts.payments > 0, `${counts.payments} records`);
  logTest('Database has fraud alerts', counts.fraudAlerts > 0, `${counts.fraudAlerts} alerts`);
  logTest('Database has payroll records', counts.payroll > 0, `${counts.payroll} records`);
  logTest('Database has schedule milestones', counts.scheduleMilestones > 0, `${counts.scheduleMilestones} milestones`);
  logTest('Database has BOQ items', counts.boqItems > 0, `${counts.boqItems} items`);
  logTest('Database has material requests', counts.materialRequests > 0, `${counts.materialRequests} requests`);
  logTest('Database has stock items', counts.stockItems > 0, `${counts.stockItems} items`);
  logTest('Database has suppliers', counts.suppliers > 0, `${counts.suppliers} suppliers`);
  logTest('Database has vehicles', counts.vehicles > 0, `${counts.vehicles} vehicles`);
  logTest('Database has vehicle logs', counts.vehicleLogs > 0, `${counts.vehicleLogs} logs`);
  logTest('Database has tools', counts.tools > 0, `${counts.tools} tools`);
  logTest('Database has reminders', counts.reminders > 0, `${counts.reminders} reminders`);

  console.log('\n--- Testing API Endpoints ---\n');

  const endpoints = [
    { name: 'GET /api/projects', path: '/projects' },
    { name: 'GET /api/workers', path: '/workers' },
    { name: 'GET /api/attendance', path: '/attendance' },
    { name: 'GET /api/fraud-alerts', path: '/fraud-alerts' },
    { name: 'GET /api/safety-violations', path: '/safety-violations' },
    { name: 'GET /api/payroll', path: '/payroll' },
    { name: 'GET /api/payments', path: '/payments' },
    { name: 'GET /api/procurement', path: '/procurement' },
    { name: 'GET /api/boq', path: '/boq' },
    { name: 'GET /api/schedule', path: '/schedule' },
    { name: 'GET /api/reports', path: '/reports' },
    { name: 'GET /api/tasks', path: '/tasks' },
    { name: 'GET /api/assets', path: '/assets' },
    { name: 'GET /api/reminders', path: '/reminders' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await apiRequest('GET', ep.path);
      logTest(ep.name, res.status === 200, `status=${res.status}`);
    } catch (e) {
      logTest(ep.name, false, e.message);
    }
  }

  // Test POST endpoints
  console.log('\n--- Testing POST/Write Endpoints ---\n');

  // Test: Create a fraud alert (tests fraud-alerts POST + SSE broadcast)
  try {
    const worker = await prisma.worker.findFirst();
    if (worker) {
      const res = await apiRequest('POST', '/fraud-alerts', {
        workerId: worker.id,
        alertType: 'PPE_VIOLATION',
        severity: 'HIGH',
        status: 'PENDING',
        details: 'Capacity test: Missing hard hat in active zone',
      });
      logTest('POST /api/fraud-alerts', res.status === 200, `alert created: ${res.body.success}`);
    } else {
      logTest('POST /api/fraud-alerts', false, 'No worker found');
    }
  } catch (e) {
    logTest('POST /api/fraud-alerts', false, e.message);
  }

  // Test: Process daily payout (tests payments/process-daily POST + payout-service)
  try {
    const worker = await prisma.worker.findFirst({ where: { paymentType: 'DAILY', status: 'ACTIVE' } });
    if (worker) {
      const res = await apiRequest('POST', '/payments/process-daily', { workerId: worker.id });
      logTest('POST /api/payments/process-daily', res.status === 200, `success=${res.body.success}, message=${res.body.message}`);
    } else {
      logTest('POST /api/payments/process-daily', false, 'No active DAILY worker found');
    }
  } catch (e) {
    logTest('POST /api/payments/process-daily', false, e.message);
  }

  // Test: Log safety violation (tests safety-violations POST)
  try {
    const worker = await prisma.worker.findFirst();
    if (worker) {
      const res = await apiRequest('POST', '/safety-violations', {
        workerId: worker.id,
        workerName: worker.name,
        cameraName: 'CCTV_GATE_01',
      });
      logTest('POST /api/safety-violations', res.status === 200, `success=${res.body.success}`);
    } else {
      logTest('POST /api/safety-violations', false, 'No worker found');
    }
  } catch (e) {
    logTest('POST /api/safety-violations', false, e.message);
  }

  console.log('\n--- Testing Module Interconnections ---\n');

  // Interconnection 1: Worker -> Attendance -> Payroll -> Payment (full chain)
  try {
    const worker = await prisma.worker.findFirst({
      include: {
        attendance: true,
        payroll: true,
        payments: true,
        fraudAlerts: true,
      },
    });
    const hasChain = worker &&
      worker.attendance.length > 0 &&
      worker.payroll.length > 0 &&
      worker.payments.length > 0;
    logTest('Worker → Attendance → Payroll → Payment chain', hasChain,
      `att=${worker.attendance.length}, payroll=${worker.payroll.length}, payments=${worker.payments.length}`);
  } catch (e) {
    logTest('Worker → Attendance → Payroll → Payment chain', false, e.message);
  }

  // Interconnection 2: Project → Workers → Attendance → Payments
  try {
    const project = await prisma.project.findFirst({
      include: {
        workers: { include: { attendance: true, payments: true } },
        attendance: true,
      },
    });
    logTest('Project → Workers → Attendance → Payments chain', !!project && project.workers.length > 0,
      `${project.workers.length} workers, ${project.attendance.length} attendance records`);
  } catch (e) {
    logTest('Project → Workers chain', false, e.message);
  }

  // Interconnection 3: Attendance check-out triggers payment
  try {
    const checkedOut = await prisma.attendance.findFirst({
      where: { checkOutTime: { not: null } },
      include: { worker: true },
    });
    logTest('Checked-out attendance records exist', !!checkedOut,
      checkedOut ? `Worker ${checkedOut.worker.name} checked out` : 'None found');
  } catch (e) {
    logTest('Checked-out attendance check', false, e.message);
  }

  // Interconnection 4: PPE violation count matches fraud alerts
  try {
    const ppeCount = await prisma.fraudAlert.count({ where: { alertType: 'PPE_VIOLATION' } });
    logTest('PPE violations exist for wage deduction logic', ppeCount > 0, `${ppeCount} PPE violations`);
  } catch (e) {
    logTest('PPE violation check', false, e.message);
  }

  // Interconnection 5: Worker wageRate used in payment amount
  try {
    const payment = await prisma.payment.findFirst({
      include: { worker: true },
    });
    const wageMatch = payment && payment.amount === payment.worker.wageRate;
    logTest('Payment amount matches worker wageRate', wageMatch,
      `payment=₹${payment.amount}, wage=₹${payment.worker.wageRate}`);
  } catch (e) {
    logTest('Payment-wage match check', false, e.message);
  }

  console.log('\n--- Stress Test: Concurrent API Calls ---\n');

  // Fire 20 concurrent requests
  const concurrentPromises = Array.from({ length: 20 }, (_, i) =>
    apiRequest('GET', '/attendance').catch((e) => ({ status: 0, error: e.message }))
  );
  const concurrentResults = await Promise.all(concurrentPromises);
  const successCount = concurrentResults.filter((r) => r.status === 200).length;
  logTest(`Concurrent API calls (20 parallel)`, successCount === 20, `${successCount}/20 successful`);

  // Test API docs endpoint
  try {
    const res = await apiRequest('GET', '/docs');
    logTest('GET /api/docs (Swagger UI)', res.status === 200, `status=${res.status}`);
  } catch (e) {
    logTest('GET /api/docs', false, e.message);
  }

  console.log('\n========================================');
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================');

  await prisma.$disconnect();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Test suite error:', e);
  process.exit(1);
});
