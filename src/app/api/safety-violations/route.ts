import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, cameraName, workerId: customWorkerId, workerName: customWorkerName } = body;

    let worker: any = null;

    // 1. Direct workerId if provided
    if (customWorkerId) {
      worker = await prisma.worker.findUnique({ where: { id: customWorkerId } });
    }

    // 2. Direct workerName search if provided
    if (!worker && customWorkerName) {
      worker = await prisma.worker.findFirst({
        where: { name: { contains: customWorkerName, mode: 'insensitive' } },
      });
    }

    // 3. Find worker currently on site (open attendance session)
    if (!worker) {
      let searchConditions: any = { checkOutTime: null };
      if (projectId && projectId !== 'demo' && projectId !== 'all') {
        searchConditions.projectId = projectId;
      }

      const activeSession = await prisma.attendance.findFirst({
        where: searchConditions,
        include: { worker: true },
        orderBy: { checkInTime: 'desc' },
      });

      if (activeSession?.worker) {
        worker = activeSession.worker;
      }
    }

    // 4. Fallback: Find any active worker on the project or first available worker
    if (!worker) {
      worker = await prisma.worker.findFirst({
        where: projectId && projectId !== 'demo' && projectId !== 'all' ? { projectId } : {},
      });
    }

    if (!worker) {
      return NextResponse.json({ success: false, message: 'No registered workers found to log violation.' }, { status: 404 });
    }

    const streamSource = cameraName || 'CCTV_ZONE_1';
    const alert = await prisma.fraudAlert.create({
      data: {
        workerId: worker.id,
        alertType: 'PPE_VIOLATION',
        severity: 'HIGH',
        status: 'PENDING',
        details: `YOLO Edge Stream (${streamSource}): Hardhat missing in active hazard perimeter (Multi-frame temporal confirmation). 10% safety compliance deduction applied.`,
        timestamp: new Date(),
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            phone: true,
            wageRate: true,
            project: { select: { name: true, code: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Safety violation logged for ${worker.name}.`,
      alert,
      workerName: worker.name,
      workerId: worker.id,
    });
  } catch (error: any) {
    console.error('Error in POST /api/safety-violations:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    const where: any = { alertType: 'PPE_VIOLATION' };
    if (projectId && projectId !== 'all') {
      where.worker = { projectId };
    }

    const violations = await prisma.fraudAlert.findMany({
      where,
      include: { worker: true },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    return NextResponse.json({ violations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
