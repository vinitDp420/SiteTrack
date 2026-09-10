import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const reports = await prisma.dailyReport.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { date: 'desc' },
      include: {
        submittedBy: {
          select: { name: true },
        },
      },
    });
    return NextResponse.json(reports);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { note, date, photoBase64, projectId, submittedById } = body;

    let photoUrl: string | null = null;

    if (photoBase64) {
      // Decode base64 and write to public/uploads directory
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileName = `report-${Date.now()}.png`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);

      photoUrl = `/uploads/${fileName}`;
    }

    const report = await prisma.dailyReport.create({
      data: {
        note,
        date: new Date(date),
        photoUrl,
        projectId,
        submittedById,
      },
    });

    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
