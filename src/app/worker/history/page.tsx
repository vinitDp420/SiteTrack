'use client';

import React, { useEffect, useState } from 'react';

interface AttendanceShift {
  id: string;
  checkInTime: string;
  checkOutTime: string | null;
  date: string;
  hoursWorked: number | null;
  status: string;
  project?: {
    name: string;
  };
}

export default function WorkerHistory() {
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('Active Site');

  useEffect(() => {
    fetch('/api/workers/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.worker) {
          setShifts(data.worker.attendance || []);
          setPayments(data.worker.payments || []);
          if (data.worker.project?.name) {
            setProjectName(data.worker.project.name);
          }
        }
      })
      .catch((err) => console.error('Failed to load shift history:', err))
      .finally(() => setLoading(false));
  }, []);

  const totalHours = shifts
    .reduce((acc, s) => acc + (s.hoursWorked || 0), 0)
    .toFixed(1);

  // Check if a payment matches this shift date
  const isPaidForDate = (dateStr: string) => {
    const shiftDate = new Date(dateStr).toDateString();
    return payments.find((p) => new Date(p.paymentDate).toDateString() === shiftDate && p.status === 'SUCCESS');
  };

  return (
    <div className="flex-grow flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-on-background">Shift History</h1>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-cyan-100 text-cyan-800 rounded-full font-mono">
            {shifts.length} Shifts Logged
          </span>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Review your biometric attendance records, logged hours, and wage statuses.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-outline-variant p-4 shadow-sm">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
            Total Hours Logged
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-on-background">{totalHours}</span>
            <span className="text-xs text-on-surface-variant font-bold">hrs</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant p-4 shadow-sm">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
            Avg Shift Duration
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-on-background">
              {shifts.length > 0 ? (parseFloat(totalHours) / shifts.length).toFixed(1) : '0.0'}
            </span>
            <span className="text-xs text-on-surface-variant font-bold">hrs/day</span>
          </div>
        </div>
      </div>

      {/* Shifts List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Recent Shift Logs
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-on-surface-variant font-bold flex flex-col items-center gap-2">
            <span className="material-symbols-outlined animate-spin text-[24px]">sync</span>
            <span>Loading shift logs...</span>
          </div>
        ) : shifts.length === 0 ? (
          <div className="bg-white rounded-xl border border-outline-variant p-6 text-center text-xs text-on-surface-variant">
            No completed shifts recorded yet. Use the Home tab to clock in and start your shift.
          </div>
        ) : (
          shifts.map((shift) => {
            const checkInDate = new Date(shift.checkInTime);
            const checkOutDate = shift.checkOutTime ? new Date(shift.checkOutTime) : null;
            const paid = isPaidForDate(shift.checkInTime);

            return (
              <div
                key={shift.id}
                className="bg-white rounded-xl border border-outline-variant p-4 shadow-[0_2px_8px_rgba(13,28,50,0.04)] flex justify-between items-center transition-all hover:border-cyan-500/40"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">
                      {shift.checkOutTime ? 'event_available' : 'timelapse'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-background">
                      {checkInDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                      {checkInDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {checkOutDate ? ` — ${checkOutDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ' (In Progress)'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {shift.project?.name || projectName}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-black text-on-background">
                    {shift.hoursWorked ? `${shift.hoursWorked} hrs` : '--'}
                  </p>
                  {paid ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold mt-1">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                      Paid ₹{paid.amount}
                    </span>
                  ) : shift.checkOutTime ? (
                    <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold mt-1">
                      Awaiting Payout
                    </span>
                  ) : (
                    <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold mt-1">
                      On Site
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
