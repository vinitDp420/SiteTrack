'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProject } from '@/lib/project-context';

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

interface PayrollLog {
  id: string;
  name: string;
  phone: string;
  rate: number;
  hours: number;
  gross: number;
  ppeViolations: number;
  phiCompliance: number;
  statutoryDeductions: number;
  netPay: number;
  status: 'APPROVED' | 'PENDING';
  auditStatus: string;
  bankAccountNumber: string | null;
  upiId: string | null;
  paymentType: string;
}

export default function PayrollPage() {
  const { selectedProject } = useProject();
  const [payrollLogs, setPayrollLogs] = useState<PayrollLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'INFRACTIONS'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchPayroll = async () => {
    setIsLoading(true);
    try {
      const url = selectedProject 
        ? `/api/payroll?projectId=${selectedProject.id}` 
        : '/api/payroll';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPayrollLogs(Array.isArray(data) ? data : (data.payroll || []));
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleApprove = async (workerId: string, workerName: string) => {
    setApprovingId(workerId);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `Payroll for ${workerName} approved!`);
        fetchPayroll();
      } else {
        alert(data.error || 'Failed to approve payroll.');
      }
    } catch {
      alert('Network error approving payroll.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveAll = async () => {
    if (!confirm('Approve all pending payroll calculations for disbursement?')) return;
    setApprovingAll(true);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approveAll: true, projectId: selectedProject?.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'All payroll records approved!');
        fetchPayroll();
      } else {
        alert(data.error || 'Failed to approve all payroll records.');
      }
    } catch {
      alert('Network error while approving payroll.');
    } finally {
      setApprovingAll(false);
    }
  };

  const filteredLogs = payrollLogs.filter((p) => {
    const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery));
    if (!matchesQuery) return false;

    if (filterTab === 'PENDING') return p.status === 'PENDING';
    if (filterTab === 'APPROVED') return p.status === 'APPROVED';
    if (filterTab === 'INFRACTIONS') return p.ppeViolations > 0;
    return true;
  });

  const totalGross = payrollLogs.reduce((s, p) => s + p.gross, 0);
  const totalNet = payrollLogs.reduce((s, p) => s + p.netPay, 0);
  const totalViolations = payrollLogs.reduce((s, p) => s + (p.ppeViolations || 0), 0);
  const totalStatutory = payrollLogs.reduce((s, p) => s + p.statutoryDeductions, 0);
  const pendingCount = payrollLogs.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-900 text-white flex items-center justify-between text-sm shadow-md border border-emerald-500">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-emerald-300">check_circle</span>
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start border-b border-outline-variant/30 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary tracking-tight">Payroll Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
              GAP 1 FULFILLED
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">
            {selectedProject
              ? <>Real-time automated wage calculation with Subsystem C for <span className="font-bold text-on-surface">{selectedProject.name}</span></>
              : 'Deterministic mathematical wage calculation & safety compliance auditing.'}
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/payments"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0d1c32] text-white hover:bg-[#1a3a6e] transition flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px] text-cyan-400">payments</span>
            <span>Go to Payments Module &rarr;</span>
          </Link>

          <button
            onClick={handleApproveAll}
            disabled={approvingAll || pendingCount === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {approvingAll ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">done_all</span>
            )}
            Approve All ({pendingCount})
          </button>
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
              Field AI PPE detections dynamically adjust <span className="text-cyan-200 font-bold">&Phi;_compliance</span> before final approval, eliminating manual disputes.
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary to-[#1a3a6e] text-white p-5 rounded-2xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Gross Base Pay</p>
          <h3 className="text-3xl font-black mt-2">{INR(totalGross)}</h3>
          <p className="text-[11px] opacity-75 mt-1">&Delta;t_shift &times; R_hourly</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Net Wage (&Phi;_comp Adjusted)</p>
          <h3 className="text-3xl font-black mt-2 text-emerald-700">{INR(totalNet)}</h3>
          <p className="text-[11px] text-emerald-600 mt-1">Payable after deductions</p>
        </div>

        <div className="bg-[#ffdad6]/30 border border-[#ffdad6] p-5 rounded-2xl">
          <p className="text-xs font-bold text-[#ba1a1a] uppercase tracking-wider">Safety Deductions</p>
          <h3 className="text-3xl font-black mt-2 text-[#ba1a1a]">
            {INR(Math.max(0, totalGross - totalNet - totalStatutory))}
          </h3>
          <p className="text-[11px] text-[#ba1a1a]/80 mt-1">PPE violation penalties</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Statutory D_stat (5%)</p>
          <h3 className="text-3xl font-black mt-2 text-slate-800">{INR(totalStatutory)}</h3>
          <p className="text-[11px] text-slate-500 mt-1">Mandatory ESIC & PF contributions</p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'ALL', label: `All Workers (${payrollLogs.length})` },
            { id: 'PENDING', label: `Pending Approval (${pendingCount})` },
            { id: 'APPROVED', label: `Approved (${payrollLogs.length - pendingCount})` },
            { id: 'INFRACTIONS', label: `Safety Infractions (${payrollLogs.filter((p) => p.ppeViolations > 0).length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white border border-outline-variant text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search worker by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Payroll List */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="hidden lg:grid grid-cols-12 gap-3 px-6 py-3.5 border-b border-outline-variant bg-surface-container-low text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          <div className="col-span-3">Worker Name & Details</div>
          <div className="col-span-1">Rate</div>
          <div className="col-span-1">Hours</div>
          <div className="col-span-1">Gross</div>
          <div className="col-span-2">PPE & &Phi;_comp</div>
          <div className="col-span-1">D_stat (5%)</div>
          <div className="col-span-1">Net Pay</div>
          <div className="col-span-2 text-right">Approval Status</div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-on-surface-variant font-bold">
            <span className="material-symbols-outlined animate-spin inline-block">sync</span>
            <p className="mt-2 text-sm">Calculating real-time wages with safety audit...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            No attendance records found for this period.
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {filteredLogs.map((pay) => (
              <div key={pay.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 px-6 py-4 items-center text-sm">
                <div className="col-span-3">
                  <div className="font-bold text-on-surface text-base">{pay.name}</div>
                  <div className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                    {pay.phone} &bull; {pay.paymentType}
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${
                    pay.ppeViolations === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pay.auditStatus}
                  </span>
                </div>

                <div className="col-span-1 text-on-surface-variant text-xs">
                  <span className="font-bold text-on-surface">{INR(pay.rate)}</span>
                  <span className="text-[10px] block opacity-75">/day</span>
                </div>

                <div className="col-span-1 text-on-surface-variant font-mono font-semibold">{pay.hours}h</div>
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

                <div className="col-span-1 font-black text-emerald-700 text-base">{INR(pay.netPay)}</div>

                {/* Approval Trigger */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  {pay.status === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      APPROVED
                    </span>
                  ) : (
                    <button
                      onClick={() => handleApprove(pay.id, pay.name)}
                      disabled={approvingId === pay.id || pay.netPay <= 0}
                      className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition shadow-sm disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {approvingId === pay.id ? (
                        <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      )}
                      Approve Wage
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
