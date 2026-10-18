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
        payroll: { orderBy: { createdAt: 'desc' }, take: 1 },
        fraudAlerts: true,
      },
      orderBy: { name: 'asc' },
    });

    const payrollLogs = workers.map((worker) => {
      // Calculate total hours worked based on attendance logs (Delta t_shift)
      const totalHours = worker.attendance.reduce((sum, att) => sum + (att.hoursWorked || 0), 0);

      // Calculate gross pay: (hours / 8) * daily wage rate = Delta t_shift * R_hourly
      const daysWorked = totalHours / 8;
      const grossPay = Math.round(daysWorked * worker.wageRate);

      // Gap 1 Integration: Safety compliance multiplier Phi_compliance
      // Evaluates real-time AI PPE violations logged from CCTV / Safety sub-system
      const ppeViolations = worker.fraudAlerts.filter((a) => a.alertType === 'PPE_VIOLATION').length;
      const penaltyPercent = Math.min(ppeViolations * 10, 50); // 10% penalty per violation, max 50%
      const phiCompliance = Number((1 - penaltyPercent / 100).toFixed(2));

      // Statutory deductions D_statutory (5% ESIC/PF statutory contribution)
      const statutoryDeductions = grossPay > 0 ? Math.round(grossPay * 0.05) : 0;

      // Net wage formula from Research Paper Subsystem C:
      // W_net = Delta t_shift * R_hourly * Phi_compliance - D_statutory
      const netPay = Math.max(0, Math.round(grossPay * phiCompliance - statutoryDeductions));

      const hasApprovedPayroll = worker.payroll.some((p) => p.status === 'APPROVED');

      return {
        id: worker.id,
        name: worker.name,
        phone: worker.phone,
        rate: worker.wageRate,
        hours: Math.round(totalHours * 10) / 10,
        gross: grossPay,
        ppeViolations,
        phiCompliance,
        statutoryDeductions,
        netPay,
        status: hasApprovedPayroll ? 'APPROVED' : 'PENDING',
        auditStatus: ppeViolations === 0 ? 'FULL_COMPLIANCE' : `${ppeViolations} SAFETY VIOLATIONS`,
        bankAccountNumber: worker.bankAccountNumber,
        upiId: worker.upiId,
        paymentType: worker.paymentType,
      };
    });

    return NextResponse.json(payrollLogs);
  } catch (error) {
    console.error('Failed to fetch payroll data:', error);
    return NextResponse.json({ error: 'Failed to fetch payroll data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workerId, approveAll, projectId } = body;

    const now = new Date();
    const periodStart = new Date(now.getTime() - 7 * 86400000);

    if (approveAll) {
      const whereClause: any = { status: 'ACTIVE' };
      if (projectId) whereClause.projectId = projectId;

      const workers = await prisma.worker.findMany({
        where: whereClause,
        include: { attendance: true, fraudAlerts: true },
      });

      for (const worker of workers) {
        const totalHours = worker.attendance.reduce((sum, att) => sum + (att.hoursWorked || 0), 0);
        const daysWorked = totalHours / 8;
        const grossPay = Math.round(daysWorked * worker.wageRate);
        const ppeViolations = worker.fraudAlerts.filter((a) => a.alertType === 'PPE_VIOLATION').length;
        const penaltyPercent = Math.min(ppeViolations * 10, 50);
        const phiCompliance = Number((1 - penaltyPercent / 100).toFixed(2));
        const statutoryDeductions = grossPay > 0 ? Math.round(grossPay * 0.05) : 0;
        const netPay = Math.max(0, Math.round(grossPay * phiCompliance - statutoryDeductions));

        await prisma.payroll.create({
          data: {
            workerId: worker.id,
            periodStart,
            periodEnd: now,
            totalHours,
            totalEarnings: netPay,
            status: 'APPROVED',
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Approved payroll for ${workers.length} active workers. Ready for disbursement in Payments module.`,
      });
    }

    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
    }

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: { attendance: true, fraudAlerts: true },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    const totalHours = worker.attendance.reduce((sum, att) => sum + (att.hoursWorked || 0), 0);
    const daysWorked = totalHours / 8;
    const grossPay = Math.round(daysWorked * worker.wageRate);
    const ppeViolations = worker.fraudAlerts.filter((a) => a.alertType === 'PPE_VIOLATION').length;
    const penaltyPercent = Math.min(ppeViolations * 10, 50);
    const phiCompliance = Number((1 - penaltyPercent / 100).toFixed(2));
    const statutoryDeductions = grossPay > 0 ? Math.round(grossPay * 0.05) : 0;
    const netPay = Math.max(0, Math.round(grossPay * phiCompliance - statutoryDeductions));

    await prisma.payroll.create({
      data: {
        workerId: worker.id,
        periodStart,
        periodEnd: now,
        totalHours,
        totalEarnings: netPay,
        status: 'APPROVED',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Payroll for ${worker.name} approved successfully. Proceed to Payments module for disbursement.`,
    });
  } catch (error: any) {
    console.error('Error approving payroll:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
