require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Syncing SiteTrack Auth Credentials ---');

  const adminHash = bcrypt.hashSync('Admin@123', 10);
  const supervisorHash = bcrypt.hashSync('Supervisor@123', 10);
  const workerHash = bcrypt.hashSync('Worker@123', 10);

  // 1. Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sitetrack.com' },
    update: {
      passwordHash: adminHash,
      role: 'ADMIN',
      name: 'System Admin'
    },
    create: {
      email: 'admin@sitetrack.com',
      name: 'System Admin',
      passwordHash: adminHash,
      role: 'ADMIN'
    }
  });
  console.log('✅ Admin user synced:', admin.email, 'Role:', admin.role);

  // 2. Supervisor User
  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@sitetrack.com' },
    update: {
      passwordHash: supervisorHash,
      role: 'SUPERVISOR',
      name: 'Site Supervisor'
    },
    create: {
      email: 'supervisor@sitetrack.com',
      name: 'Site Supervisor',
      passwordHash: supervisorHash,
      role: 'SUPERVISOR'
    }
  });
  console.log('✅ Supervisor user synced:', supervisor.email, 'Role:', supervisor.role);

  // 3. Worker User
  const workerUser = await prisma.user.upsert({
    where: { email: 'worker@sitetrack.com' },
    update: {
      passwordHash: workerHash,
      role: 'WORKER',
      name: 'John Doe'
    },
    create: {
      email: 'worker@sitetrack.com',
      name: 'John Doe',
      passwordHash: workerHash,
      role: 'WORKER'
    }
  });
  console.log('✅ Worker user synced:', workerUser.email, 'Role:', workerUser.role);

  // 4. Ensure at least one active project exists
  let project = await prisma.project.findFirst({ where: { status: 'ACTIVE' } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Skyline Heights Residential',
        code: '4092-B',
        location: 'Sector 12, Pune, Maharashtra',
        latitude: 18.5204,
        longitude: 73.8567,
        status: 'ACTIVE'
      }
    });
    console.log('✅ Created default project:', project.name);
  } else {
    console.log('ℹ️ Using existing project:', project.name, `(${project.id})`);
  }

  // 5. Ensure Worker profile is linked to workerUser
  let workerProfile = await prisma.worker.findUnique({
    where: { userId: workerUser.id }
  });

  if (!workerProfile) {
    // Check if an unlinked worker with name 'John Doe' exists
    const existingNamed = await prisma.worker.findFirst({
      where: { name: 'John Doe', userId: null }
    });

    if (existingNamed) {
      workerProfile = await prisma.worker.update({
        where: { id: existingNamed.id },
        data: { userId: workerUser.id }
      });
      console.log('✅ Linked existing John Doe worker to worker@sitetrack.com');
    } else {
      workerProfile = await prisma.worker.create({
        data: {
          userId: workerUser.id,
          name: 'John Doe',
          phone: '+91 98201 11111',
          wageRate: 850,
          status: 'ACTIVE',
          projectId: project.id,
          bankAccountName: 'John Doe',
          bankAccountNumber: '20345678901',
          ifscCode: 'SBIN0001234',
          upiId: 'john.doe@upi',
          paymentType: 'DAILY'
        }
      });
      console.log('✅ Created new Worker profile for John Doe linked to worker@sitetrack.com');
    }
  } else {
    console.log('ℹ️ Worker profile already linked:', workerProfile.name);
  }

  // 6. Ensure some daily tasks exist for this project / worker
  const taskCount = await prisma.dailyTask.count({ where: { projectId: project.id } });
  if (taskCount === 0) {
    await prisma.dailyTask.createMany({
      data: [
        {
          projectId: project.id,
          title: 'Foundation Slab Curing',
          description: 'Ensure curing of all exposed concrete for minimum 7 days.',
          date: new Date(),
          assignedWorkerId: workerProfile.id,
          status: 'PENDING'
        },
        {
          projectId: project.id,
          title: 'Site Safety Equipment Inspection',
          description: 'Inspect hardhats, harnesses, and safety netting at Grid B.',
          date: new Date(),
          assignedWorkerId: workerProfile.id,
          status: 'DONE'
        }
      ]
    });
    console.log('✅ Created sample daily tasks for worker.');
  }

  console.log('\n--- Credentials Summary ---');
  console.log('1. Admin:      admin@sitetrack.com      / Admin@123      (Role: ADMIN)');
  console.log('2. Supervisor: supervisor@sitetrack.com / Supervisor@123 (Role: SUPERVISOR)');
  console.log('3. Worker:     worker@sitetrack.com     / Worker@123     (Role: WORKER)');
}

main()
  .catch((e) => {
    console.error('Error syncing credentials:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
