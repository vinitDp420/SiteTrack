import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const workerId = url.searchParams.get('workerId');
    const type = url.searchParams.get('type'); // DAILY or MONTHLY

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (workerId) where.workerId = workerId;
    if (type) where.type = type;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        worker: { select: { name: true, bankAccountNumber: true, upiId: true } },
      },
      take: 100,
    });

    // Summary stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = await prisma.payment.aggregate({
      where: { ...where, status: 'SUCCESS' },
      _sum: { amount: true },
      _count: true,
    });

    const todayStats = await prisma.payment.aggregate({
      where: { ...where, status: 'SUCCESS', paymentDate: { gte: today } },
      _sum: { amount: true },
      _count: true,
    });

    const monthStats = await prisma.payment.aggregate({
      where: { ...where, status: 'SUCCESS', paymentDate: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    });

    const pendingCount = await prisma.payment.count({
      where: { ...where, status: 'PENDING' },
    });

    const failedCount = await prisma.payment.count({
      where: { ...where, status: 'FAILED' },
    });

    return NextResponse.json({
      payments,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
