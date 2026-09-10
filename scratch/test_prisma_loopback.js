const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@127.0.0.1:5432/sitetrack?schema=public',
    },
  },
});

console.log('Testing Prisma connection over loopback (127.0.0.1)...');
prisma.user
  .findFirst()
  .then((user) => {
    console.log('SUCCESS: Connected and queried user email:', user ? user.email : 'No users in database');
    prisma.$disconnect();
  })
  .catch((err) => {
    console.error('FAILED to connect over loopback:');
    console.error(err);
    prisma.$disconnect();
  });
