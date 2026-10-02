import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processPayout } from '@/lib/razorpay';

/**
 * Process daily payout for a specific worker.
 * Called automatically on attendance check-out, or manually by admin.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workerId } = body;

    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required.' }, { status: 400 });
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: { project: true },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
    }

    if (worker.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Worker is not active.' }, { status: 400 });
    }

    let amount = worker.wageRate; // base wage

    // Calculate Phi_compliance based on safety violations today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const violations = await prisma.fraudAlert.count({
      where: {
        workerId,
        alertType: 'PPE_VIOLATION',
        timestamp: { gte: today },
      },
    });

    let deductionNotes = '';
    let phiCompliance = 1.0;

    if (violations > 0) {
      // 10% deduction per violation, max 50%
      const penaltyPercent = Math.min(violations * 10, 50);
      phiCompliance = 1 - (penaltyPercent / 100);
      amount = amount * phiCompliance;
      deductionNotes = ` | Phi_compliance penalty: -${penaltyPercent}% due to ${violations} PPE violation(s).`;
    }

    // Check if already paid today
    const existingPayment = await prisma.payment.findFirst({
      where: {
        workerId,
        type: 'DAILY',
        paymentDate: { gte: today },
        status: { in: ['SUCCESS', 'PROCESSING', 'PENDING'] },
      },
    });

    if (existingPayment) {
      return NextResponse.json({
        message: 'Daily payment already processed for today.',
        payment: existingPayment,
      });
    }

    // Create payment record as PROCESSING
    const payment = await prisma.payment.create({
      data: {
        workerId,
        projectId: worker.projectId,
        amount,
        type: 'DAILY',
        status: 'PROCESSING',
        paymentDate: new Date(),
      },
    });

    // Process via Razorpay (or simulation)
    const result = await processPayout({
      workerName: worker.bankAccountName || worker.name,
      bankAccountNumber: worker.bankAccountNumber,
      ifscCode: worker.ifscCode,
      upiId: worker.upiId,
      amount,
      purpose: 'salary',
      narration: `Daily wage - ${worker.name} - ${new Date().toLocaleDateString('en-IN')}${deductionNotes}`,
    });

    // Update payment with result
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: result.success ? 'SUCCESS' : 'FAILED',
        razorpayPayoutId: result.payoutId,
        failureReason: result.failureReason || null,
      },
    });

    return NextResponse.json({
      message: result.success ? 'Payment processed successfully.' : 'Payment failed.',
      payment: updatedPayment,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
