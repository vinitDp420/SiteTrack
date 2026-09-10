import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const tasks = await prisma.dailyTask.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { date: 'desc' },
      include: {
        assignedWorker: {
          select: { name: true },
        },
      },
    });
    return NextResponse.json(tasks);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, date, assignedWorkerId, projectId } = body;

    const task = await prisma.dailyTask.create({
      data: {
        title,
        description,
        date: new Date(date),
        assignedWorkerId: assignedWorkerId || null,
        projectId,
      },
    });

    return NextResponse.json(task);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;

    const updated = await prisma.dailyTask.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
