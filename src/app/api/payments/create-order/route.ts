import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRazorpayOrder } from '@/lib/razorpay';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workerId, amount, isBulk, projectId, description: customDesc } = body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalAmount = amount;
    let description = customDesc || 'SiteTrack Payment Disbursement';
    let workerName = 'Multiple Workers';

    if (!isBulk) {
      if (!workerId) {
        return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
      }

      // Check duplicate payment today
      const existingTodayPayment = await prisma.payment.findFirst({
        where: {
          workerId,
          paymentDate: { gte: today },
          status: { in: ['SUCCESS', 'PROCESSING'] },
        },
      });

      if (existingTodayPayment) {
        return NextResponse.json({
          error: `This worker has already been paid ₹${existingTodayPayment.amount} today (Txn: ${existingTodayPayment.razorpayPayoutId || existingTodayPayment.id}). Duplicate payments are blocked.`,
          alreadyPaid: true,
        }, { status: 400 });
      }

      const worker = await prisma.worker.findUnique({
        where: { id: workerId },
        select: { name: true, phone: true },
      });
      if (worker) {
        workerName = worker.name;
        description = `SiteTrack Wage: ${worker.name}`;
      }
    } else {
      // For bulk/batch orders, ensure there is at least one unpaid worker
      const whereClause: any = { status: 'ACTIVE' };
      if (projectId) whereClause.projectId = projectId;
      const activeWorkers = await prisma.worker.findMany({
        where: whereClause,
        select: { id: true, name: true },
      });

      const unpaidWorkers = [];
      for (const w of activeWorkers) {
        const paid = await prisma.payment.findFirst({
          where: {
            workerId: w.id,
            paymentDate: { gte: today },
            status: { in: ['SUCCESS', 'PROCESSING'] },
          },
        });
        if (!paid) unpaidWorkers.push(w.id);
      }

      if (unpaidWorkers.length === 0) {
        return NextResponse.json({
          error: 'All active workers have already been paid today. Duplicate batch payment is disallowed.',
          alreadyPaidAll: true,
        }, { status: 400 });
      }

      description = `SiteTrack Batch Wage Settlement (${unpaidWorkers.length} Unpaid Workers): ${projectId || 'All Sites'}`;
    }

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    const orderRes = await createRazorpayOrder({
      amount: totalAmount,
      currency: 'INR',
      receipt: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      notes: {
        workerId: workerId || 'bulk',
        workerName,
        projectId: projectId || 'all',
      },
    });

    if (!orderRes.success) {
      return NextResponse.json({ error: orderRes.error || 'Failed to create order' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      orderId: orderRes.orderId,
      amount: orderRes.amount,
      currency: orderRes.currency,
      keyId: orderRes.keyId,
      workerName,
      description,
      isSimulation: orderRes.isSimulation ?? false,
    });
  } catch (error: any) {
    console.error('Error in /api/payments/create-order:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
