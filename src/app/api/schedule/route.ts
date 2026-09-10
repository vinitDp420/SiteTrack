import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const milestones = await prisma.scheduleMilestone.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { startDate: 'asc' },
    });
    return NextResponse.json(milestones);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, startDate, endDate, plannedProgress, actualProgress, projectId } = body;

    const milestone = await prisma.scheduleMilestone.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        plannedProgress: parseFloat(plannedProgress || 0),
        actualProgress: parseFloat(actualProgress || 0),
        projectId,
      },
    });

    return NextResponse.json(milestone);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, actualProgress } = body;

    const updated = await prisma.scheduleMilestone.update({
      where: { id },
      data: {
        actualProgress: parseFloat(actualProgress),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
