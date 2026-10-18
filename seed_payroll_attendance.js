const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedPayrollAttendance() {
  console.log('Seeding attendance shifts & PPE safety logs for realistic payroll testing...');

  const workers = await prisma.worker.findMany({
    where: { status: 'ACTIVE' },
    include: { project: true }
  });

  console.log(`Found ${workers.length} active workers.`);

  const now = new Date();

  for (const worker of workers) {
    // Check if worker already has recent attendance
    const existing = await prisma.attendance.count({ where: { workerId: worker.id } });
    if (existing > 0) {
      console.log(`Worker ${worker.name} already has ${existing} attendance records. Skipping.`);
      continue;
    }

    // Seed 3 to 5 shifts
    const numShifts = worker.paymentType === 'MONTHLY' ? 5 : 3;
    let totalHours = 0;

    for (let i = numShifts; i >= 1; i--) {
      const shiftDate = new Date();
      shiftDate.setDate(now.getDate() - i);
      shiftDate.setHours(9, 0, 0, 0);

      const hours = 8.0 + (i % 2 === 0 ? 0.5 : 0.0);
      const checkOut = new Date(shiftDate.getTime() + hours * 3600 * 1000);
      totalHours += hours;

      await prisma.attendance.create({
        data: {
          workerId: worker.id,
          projectId: worker.projectId,
          checkInTime: shiftDate,
          checkOutTime: checkOut,
          date: shiftDate,
          hoursWorked: hours,
          status: 'PRESENT',
          manualBackup: false,
          latitude: worker.project.latitude || 18.5204,
          longitude: worker.project.longitude || 73.8567,
        }
      });
    }

    // Add 1 PPE violation for selected workers to test Subsystem C Phi_compliance formula
    if (worker.name === 'Amit Patel' || worker.name === 'Ramesh Yadav') {
      await prisma.fraudAlert.create({
        data: {
          workerId: worker.id,
          alertType: 'PPE_VIOLATION',
          severity: 'LOW',
          details: 'YOLO CCTV Camera #1: Hardhat unclipped during materials transport.',
          timestamp: new Date(now.getTime() - 86400000),
          status: 'CONFIRMED',
        }
      });
      console.log(`  -> Added 1 PPE violation for ${worker.name} (testing Phi_comp penalty)`);
    }

    console.log(`✅ Seeded ${numShifts} shifts (${totalHours} hrs) for ${worker.name} (${worker.project.name})`);
  }

  console.log('Seeding complete!');
}

seedPayrollAttendance()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
