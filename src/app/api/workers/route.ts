import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

// Helper to save base64 face photo to public/uploads
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

import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const workers = await prisma.worker.findMany({
      where: projectId && projectId !== 'ALL' ? { projectId } : undefined,
      include: {
        project: true,
        faceEmbeddings: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
    return NextResponse.json(workers, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch workers.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      wageRate,
      projectId,
      facePhoto,
      status,
      bankAccountName,
      bankAccountNumber,
      ifscCode,
      upiId,
      paymentType,
      loginEmail,
      password,
    } = body;

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim().replace(/[^0-9]/g, '') : '';
    const numWage = Number(wageRate);

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: 'Worker name must be at least 2 characters long.' }, { status: 400 });
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Worker phone must contain at least 10 numeric digits.' }, { status: 400 });
    }

    if (isNaN(numWage) || numWage <= 0) {
      return NextResponse.json({ error: 'Daily wage rate must be a positive number greater than 0.' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required.' }, { status: 400 });
    }

    // Determine login email
    let finalLoginEmail = loginEmail ? loginEmail.trim().toLowerCase() : '';
    if (finalLoginEmail && !finalLoginEmail.includes('@')) {
      finalLoginEmail = `${finalLoginEmail}@sitetrack.com`;
    }

    // If no custom login email provided, generate one from name and digits
    if (!finalLoginEmail) {
      const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '.');
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-4);
      finalLoginEmail = `${sanitizedName}.${cleanPhone || 'w'}@sitetrack.com`;
    }

    // Check if user with this login email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: finalLoginEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: `Login ID / Email '${finalLoginEmail}' is already registered. Please choose a different Login ID.` },
        { status: 400 }
      );
    }

    // Create user login account with encrypted password
    const workerPassword = password && password.trim() ? password.trim() : 'Worker@123';
    const passwordHash = bcrypt.hashSync(workerPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: finalLoginEmail,
        passwordHash,
        role: 'WORKER',
      },
    });

    let facePhotoUrl = null;
    if (facePhoto) {
      try {
        facePhotoUrl = saveFacePhoto(facePhoto, name);
      } catch (err: any) {
        return NextResponse.json({ error: `Image upload failed: ${err.message}` }, { status: 400 });
      }
    }

    const worker = await prisma.worker.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        wageRate: parseFloat(wageRate),
        projectId,
        userId: user.id,
        facePhotoUrl,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        bankAccountName: bankAccountName || null,
        bankAccountNumber: bankAccountNumber || null,
        ifscCode: ifscCode || null,
        upiId: upiId || null,
        paymentType: paymentType === 'MONTHLY' ? 'MONTHLY' : 'DAILY',
      },
      include: {
        project: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      ...worker,
      rawPassword: workerPassword, // Returned once so admin/supervisor can share with worker
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create worker.' }, { status: 500 });
  }
}
