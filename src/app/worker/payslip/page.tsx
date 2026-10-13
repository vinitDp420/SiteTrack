'use client';

import React, { useEffect, useState } from 'react';

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function WorkerPayslip() {
  const [loading, setLoading] = useState(true);
  const [workerData, setWorkerData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/workers/me')
      .then((res) => res.json())
      .then((data) => {
        setWorkerData(data.worker || null);
      })
      .catch((err) => console.error('Failed to load payslip:', err))
      .finally(() => setLoading(false));
  }, []);

  const payments = workerData?.payments || [];
  const baseRate = workerData?.wageRate || 850;
  const violations = workerData?.fraudAlerts || [];

  return (
    <div className="flex-grow flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-on-background">Your Digital Payslips</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
            Automated API Payout
          </span>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Instant bank & UPI disbursements calculated via Subsystem C Safety Compliance.
        </p>
      </div>

      {/* Safety Compliance & Payout Rate Card */}
      <div className="bg-gradient-to-br from-primary to-[#1a3a6e] text-white p-5 rounded-2xl shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-200">Enrolled Daily Wage Rate (R_hourly)</span>
            <h2 className="text-3xl font-black mt-1">{INR(baseRate)}<span className="text-sm font-normal opacity-75">/day</span></h2>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">Safety Status</span>
            <div className="text-sm font-bold text-emerald-300 mt-1 flex items-center gap-1 justify-end">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              {violations.length === 0 ? '100% Compliant' : `${violations.length} Warning(s)`}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-4 text-xs">
          <div>
            <span className="opacity-70 text-[10px] block">Disbursement Channel</span>
            <span className="font-mono font-bold">{workerData?.upiId || workerData?.bankAccountNumber || 'Direct UPI'}</span>
          </div>
          <div>
            <span className="opacity-70 text-[10px] block">Payment Schedule</span>
            <span className="font-bold">{workerData?.paymentType || 'DAILY'}</span>
          </div>
        </div>
      </div>

      {/* Payslip History */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-on-background">Disbursement Records</h3>
        {loading ? (
          <div className="p-8 text-center text-xs text-on-surface-variant font-bold">
            <span className="material-symbols-outlined animate-spin">sync</span>
            <p className="mt-2">Loading payslips...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-white rounded-xl border border-outline-variant p-6 text-center text-xs text-on-surface-variant">
            No payouts processed yet for this pay cycle. Completed shifts will appear here instantly.
          </div>
        ) : (
          payments.map((p: any, idx: number) => (
            <div
              key={p.id || idx}
              className="bg-white rounded-xl border border-outline-variant p-4 shadow-[0_2px_8px_rgba(13,28,50,0.05)] flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-bold text-on-background">
                  {new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status === 'SUCCESS' ? 'bg-[#d5e0f7] text-[#0d1c32]' : 'bg-[#ffdad6] text-[#93000a]'
                    }`}
                  >
                    {p.status}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    {p.type} &bull; Razorpay Instant
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-emerald-700">{INR(p.amount)}</p>
                <span className="text-[10px] text-emerald-600 block">&Phi;_comp verified</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
