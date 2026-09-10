import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processPayout } from '@/lib/razorpay';

/**
 * Retry a failed payment by ID.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required.' }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { worker: true },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    if (payment.status !== 'FAILED') {
      return NextResponse.json({ error: 'Only failed payments can be retried.' }, { status: 400 });
    }

    // Update to PROCESSING
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'PROCESSING', failureReason: null },
    });

    const result = await processPayout({
      workerName: payment.worker.bankAccountName || payment.worker.name,
      bankAccountNumber: payment.worker.bankAccountNumber,
      ifscCode: payment.worker.ifscCode,
      upiId: payment.worker.upiId,
      amount: payment.amount,
      purpose: 'salary',
      narration: `Retry payout - ${payment.worker.name}`,
    });

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: result.success ? 'SUCCESS' : 'FAILED',
        razorpayPayoutId: result.payoutId,
        failureReason: result.failureReason || null,
      },
    });

    return NextResponse.json({
      message: result.success ? 'Retry successful.' : 'Retry failed.',
      payment: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
