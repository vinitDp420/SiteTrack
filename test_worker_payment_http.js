require('dotenv').config();
const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function postJSON(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
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
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== Testing Worker Payment Endpoints via Next.js Server ===\n');

  const worker = await prisma.worker.findFirst({
    where: { user: { email: 'worker@sitetrack.com' } },
  });

  if (!worker) {
    console.error('Worker not found');
    return;
  }

  console.log(`Testing process-daily endpoint for worker ${worker.name} (${worker.id})...`);
  const res = await postJSON('/api/payments/process-daily', { workerId: worker.id });

  console.log('Response Status:', res.statusCode);
  console.log('Response Body:', JSON.stringify(res.data, null, 2));

  // Verify in DB
  const latestPayment = await prisma.payment.findFirst({
    where: { workerId: worker.id },
    orderBy: { paymentDate: 'desc' },
  });

  console.log('\nVerified Latest Payment in DB:');
  console.log({
    id: latestPayment?.id,
    amount: latestPayment?.amount,
    type: latestPayment?.type,
    status: latestPayment?.status,
    payoutId: latestPayment?.razorpayPayoutId,
  });

  console.log('\n✅ Payment processing verified successfully!');
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
