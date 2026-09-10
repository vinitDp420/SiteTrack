'use client';

import React from 'react';

export default function WorkerHistory() {
  const shifts = [
    { date: 'Aug 05, 2026', hours: '8.0 hrs', status: 'Approved', location: 'Project Alpha' },
    { date: 'Aug 04, 2026', hours: '8.2 hrs', status: 'Approved', location: 'Project Alpha' },
    { date: 'Aug 03, 2026', hours: '8.0 hrs', status: 'Approved', location: 'Project Alpha' },
  ];

  return (
    <div className="flex-grow flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-on-background">Shift History</h1>
        <p className="text-xs text-on-surface-variant mt-1">Review your recent check-in times and work hours.</p>
      </div>

      <div className="space-y-4">
        {shifts.map((shift, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-outline-variant p-4 shadow-[0_2px_8px_rgba(13,28,50,0.05)] flex justify-between items-center"
          >
            <div>
              <p className="text-sm font-bold text-on-background">{shift.date}</p>
              <p className="text-xs text-on-surface-variant">{shift.location}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-on-background">{shift.hours}</p>
              <span className="inline-block bg-[#d5e0f7] text-[#0d1c32] px-2 py-0.5 rounded text-[10px] font-bold mt-1">
                {shift.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
