import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const workerId = url.searchParams.get('workerId');

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (workerId) where.workerId = workerId;

    const logs = await prisma.attendance.findMany({
      where,
      orderBy: { checkInTime: 'desc' },
      include: {
        worker: {
          select: {
            name: true,
            phone: true,
            wageRate: true,
            paymentType: true,
          },
        },
        project: {
          select: {
            name: true,
          },
        },
      },
      take: 100,
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workerId, projectId, manualBackup, latitude, longitude } = body;

    if (!workerId || !projectId) {
      return NextResponse.json({ error: 'workerId and projectId are required.' }, { status: 400 });
    }

    // Find worker by ID or phone
    const worker = await prisma.worker.findFirst({
      where: {
        OR: [
          { id: workerId },
          { phone: { contains: workerId } }
        ],
        status: 'ACTIVE'
      }
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found or inactive.' }, { status: 404 });
    }

    const actualWorkerId = worker.id;

    // Check if already checked in today and not checked out
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeSession = await prisma.attendance.findFirst({
      where: {
        workerId: actualWorkerId,
        checkOutTime: null,
        date: { gte: today },
      },
    });

    if (activeSession) {
      return NextResponse.json({ error: 'Worker is already checked in.', session: activeSession }, { status: 400 });
    }

    const log = await prisma.attendance.create({
      data: {
        workerId: actualWorkerId,
        projectId,
        checkInTime: new Date(),
        date: new Date(),
        status: 'ON_SITE',
        manualBackup: !!manualBackup,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
      include: {
        worker: true,
      },
    });

    return NextResponse.json({ message: 'Checked in successfully.', session: log });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { workerId } = body;

    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required.' }, { status: 400 });
    }

    // Find worker by ID or phone
    const worker = await prisma.worker.findFirst({
      where: {
        OR: [
          { id: workerId },
          { phone: { contains: workerId } }
        ]
      }
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
    }

    const actualWorkerId = worker.id;

    // Find the active session (status is ON_SITE or checkOutTime is null)
    const activeSession = await prisma.attendance.findFirst({
      where: {
        workerId: actualWorkerId,
        checkOutTime: null,
      },
      include: {
        worker: true,
      },
    });

    if (!activeSession) {
      return NextResponse.json({ error: 'No active session found for this worker.' }, { status: 404 });
    }

    const checkOutTime = new Date();
    const checkInTime = new Date(activeSession.checkInTime);
    // Calculate hours worked
    const diffMs = checkOutTime.getTime() - checkInTime.getTime();
    const hoursWorked = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    const updatedSession = await prisma.attendance.update({
      where: { id: activeSession.id },
      data: {
        checkOutTime,
        hoursWorked,
        status: 'PRESENT',
      },
    });

    // Automatically trigger daily payout if paymentType is DAILY
    let paymentResult = null;
    if (activeSession.worker.paymentType === 'DAILY') {
      try {
        const hostname = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const payRes = await fetch(`${hostname}/api/payments/process-daily`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId: actualWorkerId }),
        });
        paymentResult = await payRes.json();
      } catch (err: any) {
        console.error('Failed to trigger daily payout on check-out:', err.message);
      }
    }

    return NextResponse.json({
      message: 'Checked out successfully.',
      session: updatedSession,
      payment: paymentResult,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
