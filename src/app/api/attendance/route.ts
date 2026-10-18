import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processDailyPayoutForWorker } from '@/lib/payout-service';

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
            id: true,
            name: true,
            phone: true,
            wageRate: true,
            paymentType: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 150,
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      workerId,
      projectId,
      manualBackup,
      latitude,
      longitude,
      date,
      checkInTime,
      checkOutTime,
      hoursWorked,
      status,
    } = body;

    if (!workerId) {
      return NextResponse.json({ error: 'Worker is required.' }, { status: 400 });
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
    const targetProjectId = projectId || worker.projectId;

    // Parse Dates
    const shiftDate = date ? new Date(date) : new Date();
    const parsedCheckIn = checkInTime ? new Date(checkInTime) : new Date();
    let parsedCheckOut: Date | null = checkOutTime ? new Date(checkOutTime) : null;

    let computedHoursWorked: number | null = null;
    let attendanceStatus = status || 'ON_SITE';

    if (parsedCheckOut) {
      if (parsedCheckOut.getTime() <= parsedCheckIn.getTime()) {
        return NextResponse.json({ error: 'Check-out time must be after check-in time.' }, { status: 400 });
      }
      const diffMs = parsedCheckOut.getTime() - parsedCheckIn.getTime();
      computedHoursWorked = hoursWorked !== undefined && hoursWorked !== null
        ? Number(hoursWorked)
        : parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      if (!status) {
        attendanceStatus = computedHoursWorked >= 7 ? 'PRESENT' : 'HALF_DAY';
      }
    } else {
      // If no check-out time provided, check if already actively checked in
      const today = new Date(shiftDate);
      today.setHours(0, 0, 0, 0);
      const activeSession = await prisma.attendance.findFirst({
        where: {
          workerId: actualWorkerId,
          checkOutTime: null,
          date: { gte: today },
        },
      });

      if (activeSession) {
        return NextResponse.json({
          error: `${worker.name} is already checked in on site. Clock them out first or specify a completed shift.`,
          session: activeSession
        }, { status: 400 });
      }
    }

    const isManual = manualBackup !== undefined ? !!manualBackup : true;

    const log = await prisma.attendance.create({
      data: {
        workerId: actualWorkerId,
        projectId: targetProjectId,
        date: shiftDate,
        checkInTime: parsedCheckIn,
        checkOutTime: parsedCheckOut,
        hoursWorked: computedHoursWorked,
        status: attendanceStatus,
        manualBackup: isManual,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            phone: true,
            wageRate: true,
            paymentType: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: parsedCheckOut ? 'Manual shift attendance recorded successfully.' : 'Checked in successfully.',
      session: log
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { workerId, attendanceId, checkOutTime, hoursWorked } = body;

    if (!workerId && !attendanceId) {
      return NextResponse.json({ error: 'workerId or attendanceId is required.' }, { status: 400 });
    }

    let activeSession = null;

    if (attendanceId) {
      activeSession = await prisma.attendance.findUnique({
        where: { id: attendanceId },
        include: { worker: true },
      });
    } else {
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

      // Find the active session (status is ON_SITE or checkOutTime is null)
      activeSession = await prisma.attendance.findFirst({
        where: {
          workerId: worker.id,
          checkOutTime: null,
        },
        include: {
          worker: true,
        },
      });
    }

    if (!activeSession) {
      return NextResponse.json({ error: 'No active check-in session found to clock out.' }, { status: 404 });
    }

    const finalCheckOutTime = checkOutTime ? new Date(checkOutTime) : new Date();
    const checkInTime = new Date(activeSession.checkInTime);
    // Calculate hours worked
    const diffMs = finalCheckOutTime.getTime() - checkInTime.getTime();
    const computedHours = hoursWorked !== undefined && hoursWorked !== null
      ? Number(hoursWorked)
      : parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    const updatedSession = await prisma.attendance.update({
      where: { id: activeSession.id },
      data: {
        checkOutTime: finalCheckOutTime,
        hoursWorked: computedHours,
        status: computedHours >= 7 ? 'PRESENT' : 'HALF_DAY',
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            phone: true,
            wageRate: true,
            paymentType: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Automatically trigger daily payout if paymentType is DAILY
    let paymentResult = null;
    if (activeSession.worker.paymentType === 'DAILY') {
      try {
        paymentResult = await processDailyPayoutForWorker(activeSession.workerId);
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
