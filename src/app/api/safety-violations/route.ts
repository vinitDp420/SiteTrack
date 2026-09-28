import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, cameraName } = body;

    let searchConditions: any = { checkOutTime: null };
    // If projectId is provided, filter by it. Otherwise, find ANY active worker for demo purposes.
    if (projectId && projectId !== 'demo') {
      searchConditions.projectId = projectId;
    }

    // For demonstration of the paper's Subsystem C correlation, we'll find an active worker 
    // on the site to penalize. In a full production scenario with spatial correlation, 
    // the system would know exactly which worker it is based on location tags or zone checking.
    const activeSession = await prisma.attendance.findFirst({
      where: searchConditions,
      include: { worker: true }
    });

    if (!activeSession) {
      return NextResponse.json({ message: 'No active workers found to penalize.' });
    }

    const workerId = activeSession.workerId;

    const alert = await prisma.fraudAlert.create({
      data: {
        workerId,
        alertType: 'PPE_VIOLATION',
        severity: 'HIGH',
        status: 'PENDING',
        details: `Missing Helmet detected at ${cameraName || 'CCTV_ZONE'}`,
      }
    });

    return NextResponse.json({ message: 'Safety violation logged.', alert });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
