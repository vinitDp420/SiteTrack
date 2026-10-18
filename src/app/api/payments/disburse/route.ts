import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processPayout } from '@/lib/razorpay';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workerId, amount, type = 'DAILY', narration, batch, workerIds, projectId } = body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Batch Instant Disbursement
    if (batch) {
      let targetWorkerIds: string[] = [];

      if (Array.isArray(workerIds) && workerIds.length > 0) {
        targetWorkerIds = workerIds;
      } else {
        const whereClause: any = { status: 'ACTIVE' };
        if (projectId) whereClause.projectId = projectId;
        const activeWorkers = await prisma.worker.findMany({
          where: whereClause,
          select: { id: true },
        });
        targetWorkerIds = activeWorkers.map((w) => w.id);
      }

      if (targetWorkerIds.length === 0) {
        return NextResponse.json({ error: 'No active workers found for disbursement.' }, { status: 400 });
      }

      const results = [];
      let totalDisbursed = 0;

      for (const id of targetWorkerIds) {
        const worker = await prisma.worker.findUnique({
          where: { id },
        });
        if (!worker) continue;

        // DUPLICATE PAYMENT CHECK TODAY
        const existingTodayPayment = await prisma.payment.findFirst({
          where: {
            workerId: worker.id,
            paymentDate: { gte: today },
            status: { in: ['SUCCESS', 'PROCESSING'] },
          },
        });

        if (existingTodayPayment) {
          results.push({
            workerId: worker.id,
            workerName: worker.name,
            amount: existingTodayPayment.amount,
            status: 'SKIPPED',
            message: `Already paid ₹${existingTodayPayment.amount} today (Txn: ${existingTodayPayment.razorpayPayoutId || existingTodayPayment.id}). Skipped duplicate payout.`,
            payoutId: existingTodayPayment.razorpayPayoutId,
          });
          continue;
        }

        const payoutAmount = (body.workerAmounts && body.workerAmounts[id]) || (body.amountPerWorker ? Number(body.amountPerWorker) : worker.wageRate);
        const paymentType = body.type || worker.paymentType || 'DAILY';
        
        const payment = await prisma.payment.create({
          data: {
            workerId: worker.id,
            projectId: worker.projectId,
            amount: payoutAmount,
            type: paymentType,
            status: 'PROCESSING',
            paymentDate: new Date(),
          },
        });

        const payoutRes = await processPayout({
          workerName: worker.bankAccountName || worker.name,
          bankAccountNumber: worker.bankAccountNumber,
          ifscCode: worker.ifscCode,
          upiId: worker.upiId,
          amount: payoutAmount,
          purpose: 'salary',
          narration: `Batch wage - ${worker.name} - ${new Date().toLocaleDateString('en-IN')}`,
        });

        const updated = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: payoutRes.success ? 'SUCCESS' : 'FAILED',
            razorpayPayoutId: payoutRes.payoutId || null,
            failureReason: payoutRes.failureReason || null,
          },
        });

        if (payoutRes.success) totalDisbursed += payoutAmount;

        results.push({
          workerId: worker.id,
          workerName: worker.name,
          amount: payoutAmount,
          status: payoutRes.success ? 'SUCCESS' : 'FAILED',
          payoutId: payoutRes.payoutId,
          transferMode: payoutRes.transferMode,
        });
      }

      const successCount = results.filter((r) => r.status === 'SUCCESS').length;
      const failedCount = results.filter((r) => r.status === 'FAILED').length;
      const skippedCount = results.filter((r) => r.status === 'SKIPPED').length;

      if (successCount === 0 && skippedCount > 0) {
        return NextResponse.json({
          success: false,
          error: `All ${skippedCount} workers have already received payments today. Duplicate payouts are strictly disallowed.`,
          totalDisbursed: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount,
          results,
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: `Batch payout processed via Razorpay: ${successCount} successful (₹${totalDisbursed}), ${skippedCount} skipped (already paid today), ${failedCount} failed.`,
        totalDisbursed,
        successCount,
        failedCount,
        skippedCount,
        results,
      });
    }

    // 2. Single Worker Instant Disbursement
    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: { project: true },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // DUPLICATE PAYMENT CHECK TODAY FOR SINGLE WORKER
    const existingTodayPayment = await prisma.payment.findFirst({
      where: {
        workerId: worker.id,
        paymentDate: { gte: today },
        status: { in: ['SUCCESS', 'PROCESSING'] },
      },
    });

    if (existingTodayPayment) {
      return NextResponse.json({
        error: `${worker.name} has already received payment of ₹${existingTodayPayment.amount} today (Ref: ${existingTodayPayment.razorpayPayoutId || existingTodayPayment.id}). Duplicate payments are blocked.`,
        alreadyPaid: true,
        existingPayment: existingTodayPayment,
      }, { status: 400 });
    }

    const payoutAmount = amount ? Number(amount) : worker.wageRate;
    if (payoutAmount <= 0) {
      return NextResponse.json({ error: 'Disbursement amount must be greater than 0' }, { status: 400 });
    }

    // Create payment as PROCESSING
    const payment = await prisma.payment.create({
      data: {
        workerId: worker.id,
        projectId: worker.projectId,
        amount: payoutAmount,
        type,
        status: 'PROCESSING',
        paymentDate: new Date(),
      },
    });

    const destination = worker.upiId ? `UPI: ${worker.upiId}` : `A/C ••••${worker.bankAccountNumber?.slice(-4) || 'Bank'}`;
    const desc = narration || `Wage payment - ${worker.name} - ${destination}`;

    const payoutRes = await processPayout({
      workerName: worker.bankAccountName || worker.name,
      bankAccountNumber: worker.bankAccountNumber,
      ifscCode: worker.ifscCode,
      upiId: worker.upiId,
      amount: payoutAmount,
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

    return {
      success: payoutRes.success,
      message: payoutRes.success
        ? `₹${payoutAmount} disbursed to ${worker.name} via Razorpay ${payoutRes.transferMode || (worker.upiId ? 'UPI' : 'Bank IMPS')} (Ref: ${payoutRes.payoutId}).`
        : `Payment failed: ${payoutRes.failureReason || 'Provider error'}`,
      payment: updatedPayment,
      payoutId: payoutRes.payoutId,
      transferMode: payoutRes.transferMode,
    };
  } catch (error: any) {
    console.error('Error in /api/payments/disburse:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
