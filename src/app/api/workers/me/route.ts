import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';

import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.user.email;
    if (!email) {
      return NextResponse.json({ error: 'No email found in session.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        worker: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!user || !user.worker) {
      return NextResponse.json({ error: 'Worker profile not found.' }, { status: 404 });
    }

    // Check if worker is checked in currently
    const activeSession = await prisma.attendance.findFirst({
      where: {
        workerId: user.worker.id,
        checkOutTime: null,
      },
    });

    return NextResponse.json({
      worker: user.worker,
      isCheckedIn: !!activeSession,
      activeSession,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
