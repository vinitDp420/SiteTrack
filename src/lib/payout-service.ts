import { prisma } from '@/lib/prisma';
import { processPayout } from '@/lib/razorpay';

export interface PayoutResult {
  success: boolean;
  message: string;
  payment?: any;
  error?: string;
}

/**
 * Executes a daily payout for an active worker based on attendance and safety compliance.
 */
export async function processDailyPayoutForWorker(workerId: string): Promise<PayoutResult> {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: { project: true },
    });

    if (!worker) {
      return { success: false, message: 'Worker not found.' };
    }

    if (worker.status !== 'ACTIVE') {
      return { success: false, message: 'Worker is not active.' };
    }

    let amount = worker.wageRate; // Base daily wage

    // Calculate Phi_compliance deduction based on today's safety violations
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
      // 10% deduction per violation, maximum 50%
      const penaltyPercent = Math.min(violations * 10, 50);
      phiCompliance = 1 - penaltyPercent / 100;
      amount = Math.round(amount * phiCompliance);
      deductionNotes = ` | Phi_compliance penalty: -${penaltyPercent}% due to ${violations} PPE violation(s).`;
    }

    // Check if daily payment has already been successfully processed today
    const existingPayment = await prisma.payment.findFirst({
      where: {
        workerId,
        type: 'DAILY',
        paymentDate: { gte: today },
        status: { in: ['SUCCESS', 'PROCESSING'] },
      },
    });

    if (existingPayment) {
      return {
        success: true,
        message: 'Daily wage payment has already been processed for today.',
        payment: existingPayment,
      };
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

    // Process disbursement via Razorpay (Simulation or Live)
    const result = await processPayout({
      workerName: worker.bankAccountName || worker.name,
      bankAccountNumber: worker.bankAccountNumber,
      ifscCode: worker.ifscCode,
      upiId: worker.upiId,
      amount,
      purpose: 'salary',
      narration: `Daily wage - ${worker.name} - ${new Date().toLocaleDateString('en-IN')}${deductionNotes}`,
    });

    // Update payment status with transaction ID
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: result.success ? 'SUCCESS' : 'FAILED',
        razorpayPayoutId: result.payoutId || null,
        failureReason: result.failureReason || null,
      },
      include: {
        worker: {
          select: {
            name: true,
            upiId: true,
            bankAccountNumber: true,
            bankAccountName: true,
          },
        },
      },
    });

    return {
      success: result.success,
      message: result.success
        ? `₹${amount} daily wage disbursed successfully via ${worker.upiId ? 'UPI' : 'Bank IMPS'}.`
        : `Payment failed: ${result.failureReason || 'Provider error'}`,
      payment: updatedPayment,
    };
  } catch (error: any) {
    console.error('Error in processDailyPayoutForWorker:', error);
    return {
      success: false,
      message: error.message || 'Unexpected payment execution error.',
      error: error.message,
    };
  }
}
