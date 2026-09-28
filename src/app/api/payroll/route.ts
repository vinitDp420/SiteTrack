import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const workers = await prisma.worker.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        attendance: true,
        payroll: true,
      },
    });

    const payrollLogs = workers.map(worker => {
      // Calculate total hours worked based on attendance logs
      const totalHours = worker.attendance.reduce((sum, att) => sum + (att.hoursWorked || 0), 0);
      
      // Calculate gross pay (assuming 8 hour standard work day and daily wage rate)
      const daysWorked = totalHours / 8;
      const grossPay = Math.round(daysWorked * worker.wageRate);

      // Simple status derivation
      const hasApprovedPayroll = worker.payroll.some(p => p.status === 'APPROVED');
      
      return {
        id: worker.id,
        name: worker.name,
        rate: worker.wageRate,
        hours: Math.round(totalHours * 10) / 10,
        gross: grossPay,
        status: hasApprovedPayroll ? 'APPROVED' : 'PENDING',
      };
    });

    return NextResponse.json(payrollLogs);
  } catch (error) {
    console.error('Failed to fetch payroll data:', error);
    return NextResponse.json({ error: 'Failed to fetch payroll data' }, { status: 500 });
  }
}
