const http = require('http');

async function testRoute(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      resolve({ path, statusCode: res.statusCode });
    }).on('error', (e) => {
      resolve({ path, error: e.message });
    });
  });
}

async function runTests() {
  console.log('Testing Next.js Server Endpoints...\n');
  
  const routes = [
    '/',
    '/login',
    '/admin',
    '/admin/projects',
    '/admin/workers',
    '/api/auth/providers',
    '/api/payments/process-daily',
    '/api/payments/process-monthly'
  ];

  for (const route of routes) {
    const result = await testRoute(route);
    if (result.error) {
      console.log(`❌ [ERROR] ${route} -> Failed to connect: ${result.error}`);
    } else if (result.statusCode >= 200 && result.statusCode < 400) {
      console.log(`✅ [OK] ${route} -> Status ${result.statusCode}`);
    } else {
      console.log(`⚠️  [WARN] ${route} -> Status ${result.statusCode} (This might be expected for protected routes)`);
    }
  }
  
  console.log('\nBackend Test Complete!');
}

runTests();
