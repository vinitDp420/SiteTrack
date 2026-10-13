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
        fraudAlerts: true,
      },
    });

    const payrollLogs = workers.map(worker => {
      // Calculate total hours worked based on attendance logs (Delta t_shift)
      const totalHours = worker.attendance.reduce((sum, att) => sum + (att.hoursWorked || 0), 0);
      
      // Calculate gross pay: (hours / 8) * daily wage rate = Delta t_shift * R_hourly
      const daysWorked = totalHours / 8;
      const grossPay = Math.round(daysWorked * worker.wageRate);

      // Gap 1 Integration: Safety compliance multiplier Phi_compliance
      // Evaluates real-time AI PPE violations logged from CCTV / Safety sub-system
      const ppeViolations = worker.fraudAlerts.filter(a => a.alertType === 'PPE_VIOLATION').length;
      const penaltyPercent = Math.min(ppeViolations * 10, 50); // 10% penalty per violation, max 50%
      const phiCompliance = Number((1 - (penaltyPercent / 100)).toFixed(2));

      // Statutory deductions D_statutory (5% ESIC/PF statutory contribution)
      const statutoryDeductions = grossPay > 0 ? Math.round(grossPay * 0.05) : 0;

      // Net wage formula from Research Paper:
      // W_net = Delta t_shift * R_hourly * Phi_compliance - D_statutory
      const netPay = Math.max(0, Math.round((grossPay * phiCompliance) - statutoryDeductions));

      // Simple status derivation
      const hasApprovedPayroll = worker.payroll.some(p => p.status === 'APPROVED');
      
      return {
        id: worker.id,
        name: worker.name,
        rate: worker.wageRate,
        hours: Math.round(totalHours * 10) / 10,
        gross: grossPay,
        ppeViolations,
        phiCompliance,
        statutoryDeductions,
        netPay,
        status: hasApprovedPayroll ? 'APPROVED' : 'PENDING',
        auditStatus: ppeViolations === 0 ? 'FULL_COMPLIANCE' : `${ppeViolations} SAFETY VIOLATIONS`,
      };
    });

    return NextResponse.json(payrollLogs);
  } catch (error) {
    console.error('Failed to fetch payroll data:', error);
    return NextResponse.json({ error: 'Failed to fetch payroll data' }, { status: 500 });
  }
}
