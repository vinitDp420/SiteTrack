import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addSSEClient, broadcastAlert } from '@/lib/sse-broadcaster';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      addSSEClient(controller);
      return () => {
        // cleanup handled by addSSEClient return
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workerId, alertType, severity, details, projectId } = body;

    const alert = await prisma.fraudAlert.create({
      data: {
        workerId,
        alertType,
        severity: severity || 'MEDIUM',
        status: 'PENDING',
        details: details || null,
        timestamp: new Date(),
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            phone: true,
            project: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    // Broadcast to all SSE clients
    broadcastAlert({
      type: 'alert',
      ...alert,
    });

    return NextResponse.json({ success: true, alert });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
