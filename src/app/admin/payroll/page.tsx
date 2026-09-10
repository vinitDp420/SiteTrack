'use client';

import React from 'react';
import { useProject } from '@/lib/project-context';

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function PayrollPage() {
  const { selectedProject } = useProject();

  // Static mock payroll data with Indian wage rates (in ₹)
  const payrollLogs = [
    { name: 'Raj Kumar Singh', rate: 800, hours: 208, gross: 166400, status: 'PENDING' },
    { name: 'Priya Sharma', rate: 1100, hours: 197, gross: 216700, status: 'PENDING' },
    { name: 'Amit Patel', rate: 650, hours: 218, gross: 141700, status: 'APPROVED' },
  ];

  const totalPayout = payrollLogs.reduce((s, p) => s + p.gross, 0);
  const pendingPayout = payrollLogs.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.gross, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Payroll Management</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {selectedProject
            ? <>Worker wages for <span className="font-bold text-on-surface">{selectedProject.name}</span></>
            : 'Worker wages calculated from time logs.'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary to-[#1a3a6e] text-white p-5 rounded-2xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total Payroll This Month</p>
          <h3 className="text-3xl font-black mt-2">{INR(totalPayout)}</h3>
        </div>
        <div className="bg-[#ffdad6]/30 border border-[#ffdad6] p-5 rounded-2xl">
          <p className="text-xs font-bold text-[#ba1a1a] uppercase tracking-wider">Pending Payout</p>
          <h3 className="text-3xl font-black mt-2 text-[#ba1a1a]">{INR(pendingPayout)}</h3>
        </div>
        <div className="bg-[#d5e0f7]/30 border border-[#d5e0f7] p-5 rounded-2xl">
          <p className="text-xs font-bold text-[#0d1c32] uppercase tracking-wider">Approved & Paid</p>
          <h3 className="text-3xl font-black mt-2 text-[#0d1c32]">{INR(totalPayout - pendingPayout)}</h3>
        </div>
      </div>

      {/* Payroll List */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-outline-variant bg-surface-container-low text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          <div className="col-span-3">Worker Name</div>
          <div className="col-span-3">Daily Wage Rate</div>
          <div className="col-span-2">Total Hours</div>
          <div className="col-span-2">Gross Pay</div>
          <div className="col-span-2">Status</div>
        </div>
        <div className="divide-y divide-outline-variant">
          {payrollLogs.map((pay, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-6 py-4 items-center text-sm">
              <div className="col-span-3 font-bold text-on-surface">{pay.name}</div>
              <div className="col-span-3 text-on-surface-variant">{INR(pay.rate)}<span className="text-xs">/day</span></div>
              <div className="col-span-2 text-on-surface-variant">{pay.hours} hr</div>
              <div className="col-span-2 font-black text-primary">{INR(pay.gross)}</div>
              <div className="col-span-2">
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  pay.status === 'APPROVED' ? 'bg-[#d5e0f7] text-[#0d1c32]' : 'bg-[#ffdad6] text-[#93000a]'
                }`}>
                  {pay.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
