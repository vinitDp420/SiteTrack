import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRazorpayPayment } from '@/lib/razorpay';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      workerId,
      amount,
      type = 'DAILY',
      projectId,
      isBulk,
      workerIds,
      workerAmounts,
    } = body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return NextResponse.json({ error: 'Missing Razorpay payment identifiers' }, { status: 400 });
    }

    // Cryptographic HMAC-SHA256 signature verification
    const isValid = verifyRazorpayPayment({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature || '',
    });

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Razorpay payment signature.' }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Bulk / Pay All Verification
    if (isBulk && Array.isArray(workerIds) && workerIds.length > 0) {
      const createdPayments = [];
      const skippedWorkers = [];

      for (const wId of workerIds) {
        const worker = await prisma.worker.findUnique({ where: { id: wId } });
        if (!worker) continue;

        // Duplicate check today
        const existingToday = await prisma.payment.findFirst({
          where: {
            workerId: wId,
            paymentDate: { gte: today },
            status: { in: ['SUCCESS', 'PROCESSING'] },
          },
        });

        if (existingToday) {
          skippedWorkers.push(worker.name);
          continue;
        }

        const wAmount = workerAmounts?.[wId] || worker.wageRate;
        const p = await prisma.payment.create({
          data: {
            workerId: wId,
            projectId: projectId || worker.projectId,
            amount: Number(wAmount),
            type,
            status: 'SUCCESS',
            razorpayPayoutId: `${razorpayPaymentId}_${wId.slice(0, 4)}`,
            paymentDate: new Date(),
          },
          include: { worker: true },
        });
        createdPayments.push(p);
      }

      if (createdPayments.length === 0 && skippedWorkers.length > 0) {
        return NextResponse.json({
          error: `All ${skippedWorkers.length} workers have already received payments today. Duplicate payouts are strictly disallowed.`,
          alreadyPaid: true,
          skippedCount: skippedWorkers.length,
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: `Batch Razorpay payment ${razorpayPaymentId} verified: ${createdPayments.length} paid, ${skippedWorkers.length} skipped (already paid today).`,
        payments: createdPayments,
        skippedCount: skippedWorkers.length,
      });
    }

    // 2. Single Worker Verification
    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // Check duplicate payment today
    const existingToday = await prisma.payment.findFirst({
      where: {
        workerId,
        paymentDate: { gte: today },
        status: { in: ['SUCCESS', 'PROCESSING'] },
      },
      include: { worker: true },
    });

    if (existingToday) {
      return NextResponse.json({
        error: `Duplicate payment rejected: ${worker.name} has already received payment of ₹${existingToday.amount} today (Txn: ${existingToday.razorpayPayoutId || existingToday.id}). Duplicate payouts are disallowed.`,
        payment: existingToday,
        alreadyPaid: true,
      }, { status: 400 });
    }

    // Create payment in database with status SUCCESS
    const payment = await prisma.payment.create({
      data: {
        workerId,
        projectId: projectId || worker.projectId,
        amount: Number(amount),
        type,
        status: 'SUCCESS',
        razorpayPayoutId: razorpayPaymentId,
        paymentDate: new Date(),
      },
      include: {
        worker: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Razorpay payment ${razorpayPaymentId} verified successfully and recorded.`,
      payment,
    });
  } catch (error: any) {
    console.error('Error in /api/payments/verify:', error);
    return NextResponse.json({ error: error.message || 'Signature verification error' }, { status: 500 });
  }
}
