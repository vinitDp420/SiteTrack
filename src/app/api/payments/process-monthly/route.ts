import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processPayout } from '@/lib/razorpay';

/**
 * Process monthly salary payouts for all workers (or a specific project).
 * Called by admin on the last day of the month.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId } = body;

    // Find all active workers for the project (or all projects)
    const where: any = { status: 'ACTIVE', paymentType: 'MONTHLY' };
    if (projectId) where.projectId = projectId;

    const workers = await prisma.worker.findMany({
      where,
      include: { project: true },
    });

    if (workers.length === 0) {
      return NextResponse.json({ message: 'No monthly-salaried workers found.', results: [] });
    }

    const results = [];
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    for (const worker of workers) {
      // Check if monthly payment already processed this month
      const existingPayment = await prisma.payment.findFirst({
        where: {
          workerId: worker.id,
          type: 'MONTHLY',
          paymentDate: { gte: monthStart },
          status: { in: ['SUCCESS', 'PROCESSING', 'PENDING'] },
        },
      });

      if (existingPayment) {
        results.push({
          worker: worker.name,
          status: 'SKIPPED',
          message: 'Already paid this month.',
        });
        continue;
      }

      // Monthly salary = daily wage × 26 working days (standard in construction)
      const monthlySalary = worker.wageRate * 26;

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          workerId: worker.id,
          projectId: worker.projectId,
          amount: monthlySalary,
          type: 'MONTHLY',
          status: 'PROCESSING',
          paymentDate: new Date(),
        },
      });

      // Process payout
      const result = await processPayout({
        workerName: worker.bankAccountName || worker.name,
        bankAccountNumber: worker.bankAccountNumber,
        ifscCode: worker.ifscCode,
        upiId: worker.upiId,
        amount: monthlySalary,
        purpose: 'salary',
        narration: `Monthly salary - ${worker.name} - ${today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`,
      });

      // Update record
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: result.success ? 'SUCCESS' : 'FAILED',
          razorpayPayoutId: result.payoutId,
          failureReason: result.failureReason || null,
        },
      });

      results.push({
        worker: worker.name,
        amount: monthlySalary,
        status: result.success ? 'SUCCESS' : 'FAILED',
        payoutId: result.payoutId,
        failureReason: result.failureReason,
      });
    }

    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const failedCount = results.filter((r) => r.status === 'FAILED').length;
    const skippedCount = results.filter((r) => r.status === 'SKIPPED').length;

    return NextResponse.json({
      message: `Monthly payroll processed: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped.`,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
