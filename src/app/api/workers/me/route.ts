import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';
import { processDailyPayoutForWorker } from '@/lib/payout-service';
import fs from 'fs';
import path from 'path';

function saveFacePhoto(base64Data: string, workerName: string): string {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid image data format. Must be base64.');
  }

  const buffer = Buffer.from(matches[2], 'base64');
  const mimeType = matches[1];
  const extension = mimeType === 'image/png' ? '.png' : '.jpg';
  const filename = `${workerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}${extension}`;
  const filepath = path.join(uploadDir, filename);

  fs.writeFileSync(filepath, buffer);
  return `/uploads/${filename}`;
}

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
            faceEmbeddings: true,
            payments: { orderBy: { paymentDate: 'desc' }, take: 30 },
            attendance: { orderBy: { checkInTime: 'desc' }, take: 30, include: { project: true } },
            fraudAlerts: { orderBy: { timestamp: 'desc' }, take: 10 },
          },
        },
      },
    });

    if (!user || !user.worker) {
      return NextResponse.json({ error: 'Worker profile not found.' }, { status: 404 });
    }

    // Check if worker is currently checked in
    const activeSession = await prisma.attendance.findFirst({
      where: {
        workerId: user.worker.id,
        checkOutTime: null,
      },
      include: { project: true },
    });

    // Check if daily payout was already processed today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayPayment = await prisma.payment.findFirst({
      where: {
        workerId: user.worker.id,
        type: 'DAILY',
        paymentDate: { gte: startOfToday },
        status: { in: ['SUCCESS', 'PROCESSING'] },
      },
    });

    // Calculate earnings summary
    const successfulPayments = user.worker.payments.filter((p) => p.status === 'SUCCESS');
    const totalEarnings = successfulPayments.reduce((acc, p) => acc + p.amount, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthEarnings = successfulPayments
      .filter((p) => new Date(p.paymentDate) >= startOfMonth)
      .reduce((acc, p) => acc + p.amount, 0);

    // Safety Compliance Score (0 to 100%)
    const violationsCount = user.worker.fraudAlerts.length;
    const safetyCompliance = Math.max(50, 100 - violationsCount * 10);

    return NextResponse.json({
      worker: user.worker,
      isCheckedIn: !!activeSession,
      activeSession,
      todayPayment,
      canClaimDailyPayout: !todayPayment,
      stats: {
        totalEarnings,
        monthEarnings,
        totalShifts: user.worker.attendance.length,
        safetyCompliance,
        wageRate: user.worker.wageRate,
        paymentType: user.worker.paymentType,
        hasFaceEnrolled: !!user.worker.facePhotoUrl || user.worker.faceEmbeddings.length > 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Worker updates their own disbursement details or enrolls face photo / descriptor
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { worker: true },
    });

    if (!user || !user.worker) {
      return NextResponse.json({ error: 'Worker profile not found.' }, { status: 404 });
    }

    const body = await req.json();
    const { upiId, bankAccountName, bankAccountNumber, ifscCode, paymentType, facePhoto, faceDescriptor } = body;

    const updateData: any = {};
    if (upiId !== undefined) updateData.upiId = upiId ? upiId.trim() : null;
    if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName ? bankAccountName.trim() : null;
    if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber ? bankAccountNumber.trim() : null;
    if (ifscCode !== undefined) updateData.ifscCode = ifscCode ? ifscCode.trim().toUpperCase() : null;
    if (paymentType !== undefined) updateData.paymentType = paymentType;

    if (facePhoto) {
      try {
        const photoUrl = saveFacePhoto(facePhoto, user.worker.name);
        updateData.facePhotoUrl = photoUrl;
      } catch (err: any) {
        console.error('Face photo save error:', err.message);
      }
    }

    // Save 128-d face embedding if provided
    if (faceDescriptor && Array.isArray(faceDescriptor)) {
      try {
        await prisma.faceEmbedding.deleteMany({ where: { workerId: user.worker.id } });
        await prisma.faceEmbedding.create({
          data: {
            workerId: user.worker.id,
            embedding: JSON.stringify(faceDescriptor),
          },
        });
      } catch (err: any) {
        console.error('Face embedding save error:', err.message);
      }
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: user.worker.id },
      data: updateData,
      include: { faceEmbeddings: true },
    });

    return NextResponse.json({
      message: 'Worker profile & biometric details updated successfully.',
      worker: updatedWorker,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Worker triggers on-demand daily wage payout claim
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { worker: true },
    });

    if (!user || !user.worker) {
      return NextResponse.json({ error: 'Worker profile not found.' }, { status: 404 });
    }

    const result = await processDailyPayoutForWorker(user.worker.id);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
