import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, phone, wageRate, projectId, facePhoto, status, bankAccountName, bankAccountNumber, ifscCode, upiId, paymentType } = body;

    const existingWorker = await prisma.worker.findUnique({
      where: { id },
    });

    if (!existingWorker) {
      return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (wageRate !== undefined) updateData.wageRate = parseFloat(wageRate);
    if (projectId !== undefined) updateData.projectId = projectId;
    if (status !== undefined) updateData.status = status;
    if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName || null;
    if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber || null;
    if (ifscCode !== undefined) updateData.ifscCode = ifscCode || null;
    if (upiId !== undefined) updateData.upiId = upiId || null;
    if (paymentType !== undefined) updateData.paymentType = paymentType;

    if (facePhoto) {
      try {
        updateData.facePhotoUrl = saveFacePhoto(facePhoto, name || existingWorker.name);
      } catch (err: any) {
        return NextResponse.json({ error: `Image upload failed: ${err.message}` }, { status: 400 });
      }
    }

    const updatedWorker = await prisma.worker.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedWorker);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update worker.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const worker = await prisma.worker.findUnique({ where: { id } });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
    }

    // Perform hard delete, but since cascade is defined, it will delete associated logs if any.
    // In Prisma, we delete the worker.
    await prisma.worker.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Worker deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete worker.' }, { status: 500 });
  }
}
