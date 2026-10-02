const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Looking for worker 'John Doe'...");
  const workers = await prisma.worker.findMany({
    where: { name: 'John Doe' }
  });

  if (workers.length === 0) {
    console.log("No worker named 'John Doe' found.");
    return;
  }

  for (const worker of workers) {
    console.log(`Deleting data for worker ID: ${worker.id}`);
    
    // Delete related records that don't have onDelete: Cascade
    await prisma.attendance.deleteMany({ where: { workerId: worker.id } });
    await prisma.fraudAlert.deleteMany({ where: { workerId: worker.id } });
    await prisma.payroll.deleteMany({ where: { workerId: worker.id } });
    
    // If there is an associated User (from Phase 1/PM), optionally delete the User if they were just a worker
    if (worker.userId) {
       // Just un-link or delete user? We'll just delete the worker for now.
    }

    // Finally delete the worker (Cascades will handle Payments and FaceEmbeddings)
    await prisma.worker.delete({ where: { id: worker.id } });
    
    // Delete the user record if John Doe was a registered User account too
    if (worker.userId) {
        await prisma.user.delete({ where: { id: worker.userId } }).catch(() => console.log('User already deleted or blocked'));
    }

    console.log("Successfully deleted John Doe and all related records.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
