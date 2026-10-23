import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRazorpayClientConfig } from '@/lib/razorpay';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const workerId = url.searchParams.get('workerId');
    const type = url.searchParams.get('type'); // ALL, DAILY, MONTHLY, CASH, PAYROLL, FAILED

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (workerId) where.workerId = workerId;

    if (type && type !== 'ALL') {
      if (type === 'CASH') {
        where.razorpayPayoutId = { startsWith: 'CASH' };
      } else if (type === 'PAYROLL') {
        // Payroll batches include monthly payouts and batch disbursements
        where.OR = [
          { type: 'MONTHLY' },
          { razorpayPayoutId: { contains: 'BATCH' } },
          { razorpayPayoutId: { contains: 'bulk' } },
          { razorpayPayoutId: { contains: 'sim_bulk' } },
        ];
      } else if (type === 'FAILED') {
        where.status = { in: ['FAILED', 'PENDING'] };
      } else {
        where.type = type;
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            phone: true,
            bankAccountNumber: true,
            bankAccountName: true,
            ifscCode: true,
            upiId: true,
            wageRate: true,
            paymentType: true,
          },
        },
      },
      take: 200,
    });

    // Summary stats (calculated for the whole project to keep overview cards accurate)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const projectBaseWhere: any = {};
    if (projectId) projectBaseWhere.projectId = projectId;
    if (workerId) projectBaseWhere.workerId = workerId;

    // Active workers for initiating new Razorpay payments
    const rawWorkers = await prisma.worker.findMany({
      where: projectId ? { projectId, status: 'ACTIVE' } : { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        phone: true,
        wageRate: true,
        bankAccountNumber: true,
        bankAccountName: true,
        ifscCode: true,
        upiId: true,
        paymentType: true,
      },
      orderBy: { name: 'asc' },
    });

    // Check today's payment status for each worker to prevent duplicate payments
    const workers = await Promise.all(
      rawWorkers.map(async (worker) => {
        const todayPayment = await prisma.payment.findFirst({
          where: {
            workerId: worker.id,
            paymentDate: { gte: today },
            status: { in: ['SUCCESS', 'PROCESSING'] },
          },
          select: {
            id: true,
            amount: true,
            status: true,
            razorpayPayoutId: true,
            paymentDate: true,
            type: true,
          },
          orderBy: { paymentDate: 'desc' },
        });

        return {
          ...worker,
          isPaidToday: !!todayPayment,
          todayPayment: todayPayment || null,
        };
      })
    );

    const stats = await prisma.payment.aggregate({
      where: { ...projectBaseWhere, status: 'SUCCESS' },
      _sum: { amount: true },
      _count: true,
    });

    const todayStats = await prisma.payment.aggregate({
      where: { ...projectBaseWhere, status: 'SUCCESS', paymentDate: { gte: today } },
      _sum: { amount: true },
      _count: true,
    });

    const monthStats = await prisma.payment.aggregate({
      where: { ...projectBaseWhere, status: 'SUCCESS', paymentDate: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    });

    const pendingCount = await prisma.payment.count({
      where: { ...projectBaseWhere, status: 'PENDING' },
    });

    const failedCount = await prisma.payment.count({
      where: { ...projectBaseWhere, status: 'FAILED' },
    });

    const razorpayConfig = getRazorpayClientConfig();

    return NextResponse.json({
      payments,
      workers,
      razorpayConfig,
      summary: {
        totalPaid: stats._sum.amount || 0,
        totalCount: stats._count || 0,
        todayPaid: todayStats._sum.amount || 0,
        todayCount: todayStats._count || 0,
        monthPaid: monthStats._sum.amount || 0,
        monthCount: monthStats._count || 0,
        pendingCount,
        failedCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
