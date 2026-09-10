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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const workers = await prisma.worker.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    return NextResponse.json(workers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch workers.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, wageRate, projectId, facePhoto, status, bankAccountName, bankAccountNumber, ifscCode, upiId, paymentType } = body;

    if (!name || !phone || !wageRate || !projectId) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

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
        name,
        phone,
        wageRate: parseFloat(wageRate),
        projectId,
        facePhotoUrl,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        bankAccountName: bankAccountName || null,
        bankAccountNumber: bankAccountNumber || null,
        ifscCode: ifscCode || null,
        upiId: upiId || null,
        paymentType: paymentType === 'MONTHLY' ? 'MONTHLY' : 'DAILY',
      },
    });

    return NextResponse.json(worker);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create worker.' }, { status: 500 });
  }
}
