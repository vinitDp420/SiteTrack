import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [vehicles, tools] = await Promise.all([
      prisma.vehicle.findMany({
        orderBy: { name: 'asc' },
        include: {
          logs: { orderBy: { date: 'desc' }, take: 5 },
        },
      }),
      prisma.tool.findMany({
        orderBy: { name: 'asc' },
        include: {
          assignedWorker: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({ vehicles, tools });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create_vehicle_log') {
      const { vehicleId, hoursUsed, fuelFilled, notes, date } = body;
      const log = await prisma.vehicleLog.create({
        data: {
          vehicleId,
          hoursUsed: hoursUsed ? parseFloat(hoursUsed) : null,
          fuelFilled: fuelFilled ? parseFloat(fuelFilled) : null,
          notes,
          date: new Date(date),
        },
      });
      return NextResponse.json(log);
    }

    if (action === 'create_tool') {
      const { name, quantity, status, projectId, assignedWorkerId } = body;
      const tool = await prisma.tool.create({
        data: {
          name,
          quantity: parseInt(quantity || 1),
          status: status || 'AVAILABLE',
          projectId: projectId || null,
          assignedWorkerId: assignedWorkerId || null,
        },
      });
      return NextResponse.json(tool);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'update_tool_status') {
      const { id, status, assignedWorkerId } = body;
      const updated = await prisma.tool.update({
        where: { id },
        data: {
          status,
          assignedWorkerId: assignedWorkerId !== undefined ? assignedWorkerId || null : undefined,
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
