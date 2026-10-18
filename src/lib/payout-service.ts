import { prisma } from '@/lib/prisma';
import { processPayout } from '@/lib/razorpay';

export interface PayoutResult {
  success: boolean;
  message: string;
  payment?: any;
  error?: string;
  payoutId?: string;
  transferMode?: string;
}

export interface PayrollPayoutParams {
  workerId: string;
  amount: number;
  paymentMethod?: 'UPI' | 'IMPS' | 'GATEWAY';
  razorpayPaymentId?: string;
  narration?: string;
  deductionNotes?: string;
}

/**
 * Executes a daily payout for an active worker based on attendance and safety compliance.
 */
export async function processDailyPayoutForWorker(workerId: string, customAmount?: number): Promise<PayoutResult> {
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

    let amount = customAmount !== undefined ? customAmount : worker.wageRate; // Base daily wage

    // Calculate Phi_compliance deduction based on today's safety violations if customAmount is not provided
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let deductionNotes = '';
    if (customAmount === undefined) {
      const violations = await prisma.fraudAlert.count({
        where: {
          workerId,
          alertType: 'PPE_VIOLATION',
          timestamp: { gte: today },
        },
      });

      if (violations > 0) {
        // 10% deduction per violation, maximum 50%
        const penaltyPercent = Math.min(violations * 10, 50);
        const phiCompliance = 1 - penaltyPercent / 100;
        amount = Math.round(amount * phiCompliance);
        deductionNotes = ` | Phi_compliance penalty: -${penaltyPercent}% due to ${violations} PPE violation(s).`;
      }
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
        payoutId: existingPayment.razorpayPayoutId || undefined,
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
        ? `₹${amount} daily wage disbursed successfully via ${worker.upiId ? 'UPI' : 'Bank IMPS'} (Ref: ${result.payoutId}).`
        : `Payment failed: ${result.failureReason || 'Provider error'}`,
      payment: updatedPayment,
      payoutId: result.payoutId,
      transferMode: result.transferMode,
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

/**
 * Executes a deterministic payroll payout for a worker based on Subsystem C formula:
 * W_net = Delta t_shift * R_hourly * Phi_compliance - D_statutory
 */
export async function processPayrollPayout(params: PayrollPayoutParams): Promise<PayoutResult> {
  const { workerId, amount, paymentMethod = 'UPI', razorpayPaymentId, narration, deductionNotes } = params;

  try {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: { project: true },
    });

    if (!worker) {
      return { success: false, message: 'Worker not found.' };
    }

    if (amount <= 0) {
      return { success: false, message: 'Disbursement amount must be greater than 0.' };
    }

    // If payment was made via Razorpay Checkout modal
    if (paymentMethod === 'GATEWAY' && razorpayPaymentId) {
      const payment = await prisma.payment.create({
        data: {
          workerId,
          projectId: worker.projectId,
          amount,
          type: 'PAYROLL',
          status: 'SUCCESS',
          razorpayPayoutId: razorpayPaymentId,
          paymentDate: new Date(),
        },
        include: {
          worker: true,
        },
      });

      // Also record payroll approval log
      await prisma.payroll.create({
        data: {
          workerId,
          periodStart: new Date(Date.now() - 7 * 86400000),
          periodEnd: new Date(),
          totalHours: 24,
          totalEarnings: amount,
          status: 'APPROVED',
        },
      });

      return {
        success: true,
        message: `₹${amount} disbursed to ${worker.name} via Razorpay Gateway (Txn: ${razorpayPaymentId}).`,
        payment,
        payoutId: razorpayPaymentId,
        transferMode: 'GATEWAY',
      };
    }

    // Direct Instant RazorpayX Transfer (UPI / Bank Account)
    const payment = await prisma.payment.create({
      data: {
        workerId,
        projectId: worker.projectId,
        amount,
        type: 'PAYROLL',
        status: 'PROCESSING',
        paymentDate: new Date(),
      },
    });

    const destination = worker.upiId ? `UPI: ${worker.upiId}` : `A/C ••••${worker.bankAccountNumber?.slice(-4) || 'Bank'}`;
    const desc = narration || `Payroll wage - ${worker.name} - ${destination} - ₹${amount}${deductionNotes ? ` (${deductionNotes})` : ''}`;

    const payoutRes = await processPayout({
      workerName: worker.bankAccountName || worker.name,
      bankAccountNumber: worker.bankAccountNumber,
      ifscCode: worker.ifscCode,
      upiId: worker.upiId,
      amount,
      purpose: 'salary',
      narration: desc,
    });

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: payoutRes.success ? 'SUCCESS' : 'FAILED',
        razorpayPayoutId: payoutRes.payoutId || null,
        failureReason: payoutRes.failureReason || null,
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

    // Update payroll record status
    if (payoutRes.success) {
      await prisma.payroll.create({
        data: {
          workerId,
          periodStart: new Date(Date.now() - 7 * 86400000),
          periodEnd: new Date(),
          totalHours: 24,
          totalEarnings: amount,
          status: 'APPROVED',
        },
      });
    }

    return {
      success: payoutRes.success,
      message: payoutRes.success
        ? `₹${amount} disbursed to ${worker.name} via Razorpay ${payoutRes.transferMode || (worker.upiId ? 'UPI' : 'Bank IMPS')} (Ref: ${payoutRes.payoutId}).`
        : `Payout failed: ${payoutRes.failureReason || 'Gateway rejection'}`,
      payment: updatedPayment,
      payoutId: payoutRes.payoutId,
      transferMode: payoutRes.transferMode,
    };
  } catch (error: any) {
    console.error('Error in processPayrollPayout:', error);
    return {
      success: false,
      message: error.message || 'Unexpected payroll disbursement error.',
      error: error.message,
    };
  }
}
