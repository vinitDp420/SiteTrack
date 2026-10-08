const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting bulk seeding...');
  
  // Get all projects and an admin user
  const projects = await prisma.project.findMany();
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  
  if (projects.length === 0 || !admin) {
    console.log('Ensure you run the normal seed script first.');
    return;
  }

  let totalWorkers = 0;
  let totalTasks = 0;

  for (const project of projects) {
    console.log(`Seeding data for project: ${project.name}`);
    
    // Add 100 workers per project
    const workerData = [];
    for (let i = 0; i < 100; i++) {
      workerData.push({
        name: `Test Worker ${project.id.slice(0,4)} ${i}`,
        phone: `+91 90000 ${String(i).padStart(5, '0')}`,
        wageRate: Math.floor(Math.random() * 500) + 500, // 500-1000
        status: 'ACTIVE',
        projectId: project.id,
        paymentType: i % 2 === 0 ? 'DAILY' : 'MONTHLY',
      });
    }
    await prisma.worker.createMany({ data: workerData });
    totalWorkers += 100;
    
    // Get inserted workers for this project to assign tasks
    const projectWorkers = await prisma.worker.findMany({ where: { projectId: project.id } });
    
    // Add 100 Daily Tasks per project
    const taskData = [];
    for (let i = 0; i < 100; i++) {
      const assignedWorker = projectWorkers[Math.floor(Math.random() * projectWorkers.length)];
      taskData.push({
        projectId: project.id,
        title: `Bulk Task ${i}`,
        description: `This is an auto-generated task for testing performance. Task ID: ${i}`,
        date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)), // Random date in past
        assignedWorkerId: assignedWorker.id,
        status: Math.random() > 0.5 ? 'PENDING' : 'DONE',
      });
    }
    await prisma.dailyTask.createMany({ data: taskData });
    totalTasks += 100;
    
    // Add 50 Daily Reports
    const reportData = [];
    for (let i = 0; i < 50; i++) {
      reportData.push({
        projectId: project.id,
        note: `Auto-generated daily report note ${i}. Everything looks good on site.`,
        date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
        submittedById: admin.id,
      });
    }
    await prisma.dailyReport.createMany({ data: reportData });
    
    // Add 20 Stock Items
    const stockData = [];
    for (let i = 0; i < 20; i++) {
      stockData.push({
        projectId: project.id,
        itemName: `Test Material ${i}`,
        quantityOnHand: Math.floor(Math.random() * 1000),
        unit: 'Kg',
      });
    }
    await prisma.stockItem.createMany({ data: stockData });
  }

  console.log(`Bulk seeding completed!`);
  console.log(`Inserted ${totalWorkers} workers, ${totalTasks} tasks, and other associated records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
