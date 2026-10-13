'use client';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/lib/project-context';

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

interface PayrollLog {
  id: string;
  name: string;
  rate: number;
  hours: number;
  gross: number;
  ppeViolations: number;
  phiCompliance: number;
  statutoryDeductions: number;
  netPay: number;
  status: string;
  auditStatus: string;
}

export default function PayrollPage() {
  const { selectedProject } = useProject();
  const [payrollLogs, setPayrollLogs] = useState<PayrollLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingWorkerId, setPayingWorkerId] = useState<string | null>(null);

  const fetchPayroll = async () => {
    setIsLoading(true);
    try {
      const url = selectedProject 
        ? `/api/payroll?projectId=${selectedProject.id}` 
        : '/api/payroll';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPayrollLogs(data);
      }
    } catch (error) {
      console.error('Failed to fetch payroll:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [selectedProject]);

  const handleDisburseDaily = async (workerId: string, workerName: string) => {
    setPayingWorkerId(workerId);
    try {
      const res = await fetch('/api/payments/process-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Payout processed for ${workerName}!`);
        fetchPayroll();
      } else {
        alert(data.error || 'Payout failed.');
      }
    } catch (e) {
      alert('Network error while processing payout.');
    } finally {
      setPayingWorkerId(null);
    }
  };

  const totalGross = payrollLogs.reduce((s, p) => s + p.gross, 0);
  const totalNet = payrollLogs.reduce((s, p) => s + (p.netPay || p.gross), 0);
  const totalViolations = payrollLogs.reduce((s, p) => s + (p.ppeViolations || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start border-b border-outline-variant/30 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Payroll Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
              GAP 1 FULFILLED
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            {selectedProject
              ? <>Real-time automated wage calculation for <span className="font-bold text-on-surface">{selectedProject.name}</span></>
              : 'Real-time automated wage calculation with Subsystem C Safety Compliance.'}
          </p>
        </div>
      </div>

      {/* Gap 1 Equation Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md border border-blue-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-block px-2 py-0.5 bg-blue-500/30 rounded text-[10px] font-mono font-bold uppercase tracking-wider text-blue-200 mb-1">
              Deterministic Mathematical Formula (Paper Subsystem C)
            </span>
            <div className="font-mono text-lg md:text-xl font-bold tracking-wide text-cyan-300">
              W_net = &Delta;t_shift &times; R_hourly &times; &Phi;_compliance &minus; D_statutory
            </div>
            <p className="text-xs text-blue-200/80 mt-1">
              Field AI PPE detections dynamically adjust <span className="text-cyan-200 font-bold">&Phi;_compliance</span> before instantaneous API disbursement, eliminating manual reconciliations.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
            <div>
              <p className="text-[10px] uppercase text-blue-200 font-bold">Total Safety Infractions</p>
              <p className="text-2xl font-black text-amber-300">{totalViolations}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary to-[#1a3a6e] text-white p-5 rounded-2xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Gross Base Pay</p>
          <h3 className="text-3xl font-black mt-2">{INR(totalGross)}</h3>
          <p className="text-[11px] opacity-75 mt-1">&Delta;t_shift &times; R_hourly</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Net Payout (&Phi;_comp Adjusted)</p>
          <h3 className="text-3xl font-black mt-2 text-emerald-700">{INR(totalNet)}</h3>
          <p className="text-[11px] text-emerald-600 mt-1">Includes statutory & safety deductions</p>
        </div>
        <div className="bg-[#ffdad6]/30 border border-[#ffdad6] p-5 rounded-2xl">
          <p className="text-xs font-bold text-[#ba1a1a] uppercase tracking-wider">Safety Penalties Applied</p>
          <h3 className="text-3xl font-black mt-2 text-[#ba1a1a]">{INR(Math.max(0, totalGross - totalNet))}</h3>
          <p className="text-[11px] text-[#ba1a1a]/80 mt-1">Automated non-compliance deductions</p>
        </div>
      </div>

      {/* Payroll List */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(13,28,50,0.05)]">
        <div className="hidden lg:grid grid-cols-12 gap-3 px-6 py-3 border-b border-outline-variant bg-surface-container-low text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          <div className="col-span-3">Worker Name</div>
          <div className="col-span-1">Rate</div>
          <div className="col-span-1">Hours</div>
          <div className="col-span-1">Gross</div>
          <div className="col-span-2">PPE & &Phi;_comp</div>
          <div className="col-span-1">D_stat</div>
          <div className="col-span-1">Net Pay</div>
          <div className="col-span-2 text-right">Instant Payout</div>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-on-surface-variant font-bold">
            <span className="material-symbols-outlined animate-spin inline-block">sync</span>
            <p className="mt-2 text-sm">Calculating real-time wages with safety audit...</p>
          </div>
        ) : payrollLogs.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            No attendance records found for this period.
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {payrollLogs.map((pay, index) => (
              <div key={pay.id || index} className="grid grid-cols-1 lg:grid-cols-12 gap-3 px-6 py-4 items-center text-sm">
                <div className="col-span-3">
                  <div className="font-bold text-on-surface">{pay.name}</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                    pay.ppeViolations === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pay.auditStatus}
                  </span>
                </div>
                <div className="col-span-1 text-on-surface-variant text-xs">{INR(pay.rate)}<span className="text-[10px]">/d</span></div>
                <div className="col-span-1 text-on-surface-variant font-mono">{pay.hours}h</div>
                <div className="col-span-1 font-bold text-on-surface">{INR(pay.gross)}</div>
                
                {/* Gap 1 Safety multiplier & violations */}
                <div className="col-span-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-xs font-bold ${pay.phiCompliance < 1 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      &Phi; = {(pay.phiCompliance * 100).toFixed(0)}%
                    </span>
                    {pay.ppeViolations > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">
                        {pay.ppeViolations} inf.
                      </span>
                    )}
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full ${pay.phiCompliance === 1 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                      style={{ width: `${pay.phiCompliance * 100}%` }}
                    />
                  </div>
                </div>

                <div className="col-span-1 text-xs text-on-surface-variant font-mono">{INR(pay.statutoryDeductions)}</div>
                
                <div className="col-span-1 font-black text-emerald-700">{INR(pay.netPay)}</div>
                
                {/* Instant Disbursement Trigger */}
                <div className="col-span-2 text-right">
                  <button
                    onClick={() => handleDisburseDaily(pay.id, pay.name)}
                    disabled={payingWorkerId === pay.id || pay.netPay <= 0}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition shadow-sm disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {payingWorkerId === pay.id ? (
                      <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-[14px]">bolt</span>
                    )}
                    Disburse
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
