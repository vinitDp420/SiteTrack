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

import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const existingWorker = await prisma.worker.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingWorker) {
      return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (wageRate !== undefined) updateData.wageRate = parseFloat(wageRate);
    if (projectId !== undefined) updateData.projectId = projectId;
    if (status !== undefined) updateData.status = status;
    if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName || null;
    if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber || null;
    if (ifscCode !== undefined) updateData.ifscCode = ifscCode || null;
    if (upiId !== undefined) updateData.upiId = upiId || null;
    if (paymentType !== undefined) updateData.paymentType = paymentType;

    // Handle Login ID & Password update
    if (loginEmail || password) {
      let finalLoginEmail = loginEmail ? loginEmail.trim().toLowerCase() : '';
      if (finalLoginEmail && !finalLoginEmail.includes('@')) {
        finalLoginEmail = `${finalLoginEmail}@sitetrack.com`;
      }

      if (existingWorker.userId) {
        // Worker already has a linked User
        if (finalLoginEmail && finalLoginEmail !== existingWorker.user?.email) {
          const taken = await prisma.user.findFirst({
            where: {
              email: finalLoginEmail,
              id: { not: existingWorker.userId },
            },
          });
          if (taken) {
            return NextResponse.json(
              { error: `Login ID / Email '${finalLoginEmail}' is already taken by another user.` },
              { status: 400 }
            );
          }
        }

        const userUpdate: any = {};
        if (finalLoginEmail) userUpdate.email = finalLoginEmail;
        if (name) userUpdate.name = name.trim();
        if (password && password.trim()) {
          userUpdate.passwordHash = bcrypt.hashSync(password.trim(), 10);
        }

        if (Object.keys(userUpdate).length > 0) {
          await prisma.user.update({
            where: { id: existingWorker.userId },
            data: userUpdate,
          });
        }
      } else if (finalLoginEmail) {
        // Worker had no linked User — create one now
        const taken = await prisma.user.findUnique({
          where: { email: finalLoginEmail },
        });
        if (taken) {
          return NextResponse.json(
            { error: `Login ID / Email '${finalLoginEmail}' is already taken.` },
            { status: 400 }
          );
        }

        const workerPassword = password && password.trim() ? password.trim() : 'Worker@123';
        const newUser = await prisma.user.create({
          data: {
            name: (name || existingWorker.name).trim(),
            email: finalLoginEmail,
            passwordHash: bcrypt.hashSync(workerPassword, 10),
            role: 'WORKER',
          },
        });
        updateData.userId = newUser.id;
      }
    }

    if (facePhoto) {
      try {
        updateData.facePhotoUrl = saveFacePhoto(facePhoto, name || existingWorker.name);
      } catch (err: any) {
        return NextResponse.json({ error: `Image upload failed: ${err.message}` }, { status: 400 });
      }
    }

    if (body.faceDescriptor && Array.isArray(body.faceDescriptor)) {
      try {
        await prisma.faceEmbedding.deleteMany({ where: { workerId: id } });
        await prisma.faceEmbedding.create({
          data: {
            workerId: id,
            embedding: JSON.stringify(body.faceDescriptor),
          },
        });
      } catch (embErr: any) {
        console.error('Failed to save face descriptor for worker:', embErr.message);
      }
    }

    const updatedWorker = await prisma.worker.update({
      where: { id },
      data: updateData,
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

    const userId = worker.userId;

    // Delete related child records first to satisfy foreign key constraints
    await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { workerId: id } }),
      prisma.payroll.deleteMany({ where: { workerId: id } }),
      prisma.fraudAlert.deleteMany({ where: { workerId: id } }),
      prisma.payment.deleteMany({ where: { workerId: id } }),
      prisma.faceEmbedding.deleteMany({ where: { workerId: id } }),
      prisma.dailyTask.updateMany({ where: { assignedWorkerId: id }, data: { assignedWorkerId: null } }),
      prisma.tool.updateMany({ where: { assignedWorkerId: id }, data: { assignedWorkerId: null } }),
      prisma.worker.delete({ where: { id } }),
    ]);

    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }

    return NextResponse.json({ message: 'Worker deleted successfully.' });
  } catch (error: any) {
    console.error('Delete worker error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete worker.' }, { status: 500 });
  }
}
