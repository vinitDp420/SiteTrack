'use client';

import React, { useEffect, useState } from 'react';
import { useProject } from '@/lib/project-context';

interface Payment {
  id: string;
  workerId: string;
  amount: number;
  type: string;
  status: string;
  razorpayPayoutId: string | null;
  failureReason: string | null;
  paymentDate: string;
  worker: {
    name: string;
    bankAccountNumber: string | null;
    upiId: string | null;
  };
}

interface Summary {
  totalPaid: number;
  totalCount: number;
  todayPaid: number;
  todayCount: number;
  monthPaid: number;
  monthCount: number;
  pendingCount: number;
  failedCount: number;
}

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function PaymentsPage() {
  const { selectedProject } = useProject();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalPaid: 0, totalCount: 0, todayPaid: 0, todayCount: 0, monthPaid: 0, monthCount: 0, pendingCount: 0, failedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [processingMonthly, setProcessingMonthly] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'DAILY' | 'MONTHLY'>('ALL');

  useEffect(() => {
    if (selectedProject) fetchPayments();
  }, [selectedProject, filterType]);

  const fetchPayments = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const typeParam = filterType !== 'ALL' ? `&type=${filterType}` : '';
      const res = await fetch(`/api/payments?projectId=${selectedProject.id}${typeParam}`);
      const data = await res.json();
      setPayments(data.payments || []);
      setSummary(data.summary || summary);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleProcessMonthly = async () => {
    if (!selectedProject || processingMonthly) return;
    if (!confirm('Process monthly salary payouts for all eligible workers in this project?')) return;
    setProcessingMonthly(true);
    try {
      const res = await fetch('/api/payments/process-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject.id }),
      });
      const data = await res.json();
      alert(data.message || 'Monthly payroll processed.');
      fetchPayments();
    } catch (e) {
      alert('Failed to process monthly payroll.');
    }
    setProcessingMonthly(false);
  };

  const handleRetry = async (paymentId: string) => {
    setRetryingId(paymentId);
    try {
      const res = await fetch('/api/payments/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (data.payment) {
        setPayments((prev) => prev.map((p) => (p.id === paymentId ? { ...p, ...data.payment } : p)));
      }
    } catch {
      alert('Retry failed.');
    }
    setRetryingId(null);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'SUCCESS': return 'bg-[#d5f5d5] text-[#0a5c0a]';
      case 'FAILED': return 'bg-[#ffdad6] text-[#93000a]';
      case 'PROCESSING': return 'bg-[#ffddb8] text-[#2a1700]';
      case 'PENDING': return 'bg-slate-200 text-slate-700';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Payments & Payouts</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {selectedProject ? (
              <>Automated wage transfers for <span className="font-bold text-on-surface">{selectedProject.name}</span></>
            ) : (
              'Select a project to view payments.'
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleProcessMonthly}
            disabled={processingMonthly || !selectedProject}
            className="h-[44px] bg-gradient-to-r from-[#b87500] to-[#e09800] text-white px-5 rounded-xl font-bold text-sm flex items-center gap-1.5 shadow hover:opacity-90 transition disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">account_balance</span>
            {processingMonthly ? 'Processing...' : 'Process Monthly Payroll'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary to-[#1a3a6e] text-white p-5 rounded-2xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Paid Today</p>
          <h3 className="text-2xl font-black mt-1">{INR(summary.todayPaid)}</h3>
          <p className="text-xs opacity-60 mt-1">{summary.todayCount} transaction{summary.todayCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white border border-outline-variant p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">This Month</p>
          <h3 className="text-2xl font-black mt-1 text-on-surface">{INR(summary.monthPaid)}</h3>
          <p className="text-xs text-on-surface-variant mt-1">{summary.monthCount} payouts</p>
        </div>
        <div className="bg-white border border-outline-variant p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b87500] text-[16px]">pending</span>
            <p className="text-[10px] font-bold text-[#b87500] uppercase tracking-widest">Pending</p>
          </div>
          <h3 className="text-2xl font-black mt-1 text-[#b87500]">{summary.pendingCount}</h3>
        </div>
        <div className="bg-white border border-outline-variant p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[16px]">error</span>
            <p className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-widest">Failed</p>
          </div>
          <h3 className="text-2xl font-black mt-1 text-[#ba1a1a]">{summary.failedCount}</h3>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex gap-2">
        {(['ALL', 'DAILY', 'MONTHLY'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              filterType === t
                ? 'bg-primary text-on-primary shadow'
                : 'bg-white border border-outline-variant text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            {t === 'ALL' ? 'All Payments' : t === 'DAILY' ? 'Daily Wages' : 'Monthly Salary'}
          </button>
        ))}
      </div>

      {/* Payment Ledger */}
      {loading ? (
        <div className="text-center py-10 font-bold text-on-surface-variant">Loading payment records...</div>
      ) : (
        <div className="bg-white border border-outline-variant rounded-2xl shadow-[0_2px_12px_rgba(13,28,50,0.06)] overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-outline-variant bg-surface-container-low text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            <div className="col-span-3">Worker</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Payout ID</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          <div className="divide-y divide-outline-variant">
            {payments.length === 0 ? (
              <div className="p-10 text-center">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">payments</span>
                <p className="text-sm text-on-surface-variant mt-2 font-bold">No payment records yet.</p>
                <p className="text-xs text-on-surface-variant mt-1">Payments are created automatically when workers check out from attendance.</p>
              </div>
            ) : (
              payments.map((pay) => (
                <div key={pay.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-6 py-4 items-center text-sm hover:bg-surface-container-low/40 transition-colors">
                  <div className="col-span-3">
                    <div className="font-bold text-on-surface">{pay.worker.name}</div>
                    <div className="text-[11px] text-on-surface-variant font-mono">
                      {pay.worker.bankAccountNumber
                        ? `A/C: ****${pay.worker.bankAccountNumber.slice(-4)}`
                        : pay.worker.upiId
                          ? `UPI: ${pay.worker.upiId}`
                          : 'No bank details'}
                    </div>
                  </div>
                  <div className="col-span-2 font-black text-primary">{INR(pay.amount)}</div>
                  <div className="col-span-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                      pay.type === 'DAILY' ? 'bg-[#d5e0f7] text-[#0d1c32]' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {pay.type}
                    </span>
                  </div>
                  <div className="col-span-2 text-on-surface-variant text-xs">
                    {new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    <br />
                    <span className="text-[10px]">{new Date(pay.paymentDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="col-span-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-lg ${statusColor(pay.status)}`}>
                      {pay.status}
                    </span>
                    {pay.failureReason && (
                      <p className="text-[10px] text-[#ba1a1a] mt-0.5 truncate max-w-[150px]" title={pay.failureReason}>{pay.failureReason}</p>
                    )}
                  </div>
                  <div className="col-span-2 text-[11px] font-mono text-on-surface-variant truncate" title={pay.razorpayPayoutId || undefined}>
                    {pay.razorpayPayoutId ? pay.razorpayPayoutId.substring(0, 20) + '...' : '—'}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {pay.status === 'FAILED' && (
                      <button
                        onClick={() => handleRetry(pay.id)}
                        disabled={retryingId === pay.id}
                        className="px-3 py-1 bg-[#ba1a1a] text-white text-[10px] font-bold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">refresh</span>
                        {retryingId === pay.id ? '...' : 'Retry'}
                      </button>
                    )}
                    {pay.status === 'SUCCESS' && (
                      <span className="material-symbols-outlined text-[20px] text-[#0a5c0a]">check_circle</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Simulation Notice */}
      <div className="bg-[#ffddb8]/30 border border-[#ffddb8] rounded-xl p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-[#b87500] text-[20px] mt-0.5">science</span>
        <div>
          <p className="text-xs font-bold text-[#b87500] uppercase tracking-wider">Simulation Mode Active</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Payments are being simulated — no real money is transferred. Configure Razorpay API keys in <code className="bg-white px-1 py-0.5 rounded text-[10px] font-mono border border-outline-variant">.env</code> to enable live bank transfers via IMPS/UPI.
          </p>
        </div>
      </div>
    </div>
  );
}
