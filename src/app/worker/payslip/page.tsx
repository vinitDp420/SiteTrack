'use client';

import React from 'react';

export default function WorkerPayslip() {
  const payslips = [
    { period: 'Aug 01 - Aug 05', amount: '$1,000.00', status: 'PENDING' },
    { period: 'Jul 15 - Jul 31', amount: '$3,200.00', status: 'PAID' },
  ];

  return (
    <div className="flex-grow flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-on-background">Your Payslips</h1>
        <p className="text-xs text-on-surface-variant mt-1">Access and download your digital shift payslips.</p>
      </div>

      <div className="space-y-4">
        {payslips.map((payslip, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-outline-variant p-4 shadow-[0_2px_8px_rgba(13,28,50,0.05)] flex justify-between items-center"
          >
            <div>
              <p className="text-sm font-bold text-on-background">{payslip.period}</p>
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${
                  payslip.status === 'PAID' ? 'bg-[#d5e0f7] text-[#0d1c32]' : 'bg-[#ffdad6] text-[#93000a]'
                }`}
              >
                {payslip.status}
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-on-background">{payslip.amount}</p>
              <button className="text-xs text-primary font-bold mt-2 flex items-center gap-1 justify-end hover:underline">
                <span className="material-symbols-outlined text-[16px]">download</span> PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
