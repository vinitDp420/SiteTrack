require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedMissingEntities() {
  console.log('--- Checking & Populating Missing Data Entities for Demo ---');
  
  const projects = await prisma.project.findMany();
  const workers = await prisma.worker.findMany();
  const supervisor = await prisma.user.findFirst({ where: { role: 'SUPERVISOR' } }) || await prisma.user.findFirst();

  if (!projects.length || !workers.length) {
    console.error('Projects or workers missing! Cannot seed.');
    return;
  }

  const pMain = projects[0];
  const pSecond = projects.length > 1 ? projects[1] : pMain;
  const now = new Date();

  // 1. Tool / Equipment
  const toolCount = await prisma.tool.count();
  if (toolCount === 0) {
    console.log('Seeding Tools...');
    await prisma.tool.createMany({
      data: [
        { name: 'Bosch Professional GBH 2-26 Rotary Hammer Drill', quantity: 4, projectId: pMain.id, assignedWorkerId: workers[0].id, status: 'IN_USE' },
        { name: 'Leica TS16 Robotic Total Station & Carbon Tripod', quantity: 1, projectId: pMain.id, assignedWorkerId: workers[1]?.id || workers[0].id, status: 'IN_USE' },
        { name: 'Makita 355mm Heavy Cut-Off Saw (Portable)', quantity: 2, projectId: pSecond.id, status: 'AVAILABLE' },
        { name: 'Heavy-Duty 32mm Automatic Rebar Bending Machine', quantity: 2, projectId: pMain.id, status: 'AVAILABLE' },
        { name: 'Hilti DD 250 Diamond Core Drilling System', quantity: 1, projectId: pSecond.id, status: 'AVAILABLE' },
        { name: 'Digital Laser Level & Distance Meter Kit (50m)', quantity: 3, projectId: pMain.id, assignedWorkerId: workers[2]?.id || workers[0].id, status: 'IN_USE' },
      ]
    });
    console.log('Tools seeded successfully.');
  } else {
    console.log(`Tools already present (${toolCount}).`);
  }

  // 2. Daily Tasks
  const taskCount = await prisma.dailyTask.count();
  if (taskCount === 0) {
    console.log('Seeding Daily Tasks...');
    await prisma.dailyTask.createMany({
      data: [
        { projectId: pMain.id, title: 'RCC Column Shuttering Level 3', description: 'Erect column formwork as per structural drawing DRG-S-302.', date: now, assignedWorkerId: workers[0].id, status: 'DONE' },
        { projectId: pMain.id, title: 'Water Curing of Foundation Slab', description: 'Ensure ponding water curing for minimum 10 days.', date: now, assignedWorkerId: workers[1]?.id || workers[0].id, status: 'DONE' },
        { projectId: pMain.id, title: 'Portal Frame Rebar Tying & Inspection', description: 'Tie Fe500 20mm rebars at 150mm c/c spacing before QC inspection.', date: now, assignedWorkerId: workers[2]?.id || workers[0].id, status: 'PENDING' },
        { projectId: pSecond.id, title: 'Plumbing & Drainage Pipe Sleeving', description: 'Embed PVC sleeves through raft slab prior to concrete pour.', date: now, assignedWorkerId: workers[3]?.id || workers[0].id, status: 'PENDING' },
      ]
    });
    console.log('Daily Tasks seeded successfully.');
  } else {
    console.log(`Daily Tasks already present (${taskCount}).`);
  }

  // 3. Daily Reports
  const reportCount = await prisma.dailyReport.count();
  if (reportCount === 0) {
    console.log('Seeding Daily Reports...');
    await prisma.dailyReport.createMany({
      data: [
        { projectId: pMain.id, note: 'Foundation slab pour completed. 65m3 concrete placed. Core compressive test cubes casted. Curing started.', date: new Date(now.getTime() - 24 * 60 * 60 * 1000), submittedById: supervisor.id },
        { projectId: pMain.id, note: 'Raft rebar binding 92% done. Dewatering pumps running continuously. Concrete slump test measured at 115mm.', date: new Date(now.getTime() - 48 * 60 * 60 * 1000), submittedById: supervisor.id },
        { projectId: pSecond.id, note: 'Excavation completed for Block B basement. Soil bearing capacity verified by geotechnical engineer (220 kN/m2).', date: new Date(now.getTime() - 72 * 60 * 60 * 1000), submittedById: supervisor.id },
      ]
    });
    console.log('Daily Reports seeded successfully.');
  } else {
    console.log(`Daily Reports already present (${reportCount}).`);
  }

  // 4. Payroll Records
  const payrollCount = await prisma.payroll.count();
  if (payrollCount === 0) {
    console.log('Seeding Payroll records...');
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    for (const w of workers) {
      const hours = 176;
      const earnings = (w.wageRate / 8) * hours;
      await prisma.payroll.create({
        data: {
          workerId: w.id,
          periodStart,
          periodEnd,
          totalHours: hours,
          totalEarnings: earnings,
          status: 'PROCESSED'
        }
      });
    }
    console.log('Payroll records seeded successfully.');
  } else {
    console.log(`Payroll records already present (${payrollCount}).`);
  }

  console.log('--- Seeding check completed ---');
  await prisma.$disconnect();
}

seedMissingEntities().catch(err => {
  console.error('Error seeding missing entities:', err);
  process.exit(1);
});

