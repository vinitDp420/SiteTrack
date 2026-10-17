'use client';

import React, { useEffect, useState } from 'react';

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

interface Payment {
  id: string;
  amount: number;
  type: string;
  status: string;
  paymentDate: string;
  razorpayPayoutId: string | null;
  failureReason: string | null;
}

interface WorkerData {
  id: string;
  name: string;
  phone: string;
  wageRate: number;
  paymentType: string;
  upiId: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  ifscCode: string | null;
  project?: {
    name: string;
    code: string;
  };
  payments?: Payment[];
  fraudAlerts?: any[];
}

export default function WorkerPayslip() {
  const [loading, setLoading] = useState(true);
  const [workerData, setWorkerData] = useState<WorkerData | null>(null);
  const [stats, setStats] = useState<any>({
    totalEarnings: 0,
    monthEarnings: 0,
    safetyCompliance: 100,
    wageRate: 850,
  });
  const [todayPayment, setTodayPayment] = useState<Payment | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  // Edit Payout Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUpiId, setEditUpiId] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editBankAcc, setEditBankAcc] = useState('');
  const [editIfsc, setEditIfsc] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  // Digital Payslip Voucher Modal State
  const [selectedPayslip, setSelectedPayslip] = useState<Payment | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/workers/me');
      const data = await res.json();
      if (data.worker) {
        setWorkerData(data.worker);
        setStats(data.stats || {});
        setTodayPayment(data.todayPayment || null);
        setEditUpiId(data.worker.upiId || '');
        setEditBankName(data.worker.bankAccountName || data.worker.name);
        setEditBankAcc(data.worker.bankAccountNumber || '');
        setEditIfsc(data.worker.ifscCode || '');
      }
    } catch (err) {
      console.error('Failed to load payslip data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleClaimDailyPayout = async () => {
    setClaiming(true);
    setClaimMessage(null);
    try {
      const res = await fetch('/api/workers/me', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClaimMessage(data.message || 'Payout successfully initiated!');
        await fetchProfile();
      } else {
        setClaimMessage(data.message || data.error || 'Payout request failed.');
      }
    } catch {
      setClaimMessage('Communication error with server.');
    } finally {
      setClaiming(false);
    }
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      const res = await fetch('/api/workers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upiId: editUpiId,
          bankAccountName: editBankName,
          bankAccountNumber: editBankAcc,
          ifscCode: editIfsc,
        }),
      });
      if (res.ok) {
        setEditModalOpen(false);
        await fetchProfile();
      } else {
        alert('Failed to update bank details.');
      }
    } catch {
      alert('Network error while updating details.');
    } finally {
      setSavingBank(false);
    }
  };

  const payments = workerData?.payments || [];
  const baseRate = workerData?.wageRate || 850;
  const violations = workerData?.fraudAlerts || [];

  return (
    <div className="flex-grow flex flex-col gap-6">
      {/* Title Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-on-background">Your Digital Payslips</h1>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 uppercase tracking-wider font-mono">
            Automated Disbursal
          </span>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Instant bank & UPI disbursements calculated with biometric hours and safety compliance.
        </p>
      </div>

      {/* Main Stats Gradient Card */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-5 rounded-2xl shadow-xl border border-blue-900/40 relative overflow-hidden">
        {/* Ambient glow decoration */}
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-bold">
              Enrolled Daily Wage
            </span>
            <h2 className="text-3xl font-black mt-1 text-white">
              {INR(baseRate)}
              <span className="text-xs font-normal text-slate-300 ml-1">/shift</span>
            </h2>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
              Safety Rating
            </span>
            <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1 justify-end">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              {violations.length === 0 ? '100% Compliant' : `${stats.safetyCompliance}% Score`}
            </div>
            <span className="text-[9px] text-slate-400 block">&Phi;_comp multiplier = 1.0</span>
          </div>
        </div>

        {/* Total Earned Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
            <span className="text-[10px] text-slate-400 block">Total Disbursed</span>
            <span className="text-lg font-black text-cyan-300">{INR(stats.totalEarnings || 0)}</span>
          </div>
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
            <span className="text-[10px] text-slate-400 block">This Month (MTD)</span>
            <span className="text-lg font-black text-white">{INR(stats.monthEarnings || 0)}</span>
          </div>
        </div>

        {/* Payout Channel Info & Edit Trigger */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">Disbursement Channel</span>
            <span className="font-mono font-bold text-white text-xs">
              {workerData?.upiId || (workerData?.bankAccountNumber ? `A/C ••••${workerData.bankAccountNumber.slice(-4)}` : 'UPI (Default)')}
            </span>
          </div>
          <button
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-cyan-300 rounded-lg text-[11px] font-bold transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">edit</span>
            Edit Details
          </button>
        </div>
      </div>

      {/* Today's Daily Payout Action Card */}
      <div className="bg-white rounded-2xl border border-outline-variant p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${todayPayment ? 'bg-emerald-100 text-emerald-800' : 'bg-cyan-100 text-cyan-800'}`}>
              <span className="material-symbols-outlined text-[20px]">
                {todayPayment ? 'check_circle' : 'payments'}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-background">
                {todayPayment ? "Today's Wage Deposited" : "Today's Shift Wage"}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                {todayPayment
                  ? `₹${todayPayment.amount} deposited via ${todayPayment.type} Razorpay Instant.`
                  : 'Automatic payout triggers upon Clock-Out, or claim below.'}
              </p>
            </div>
          </div>
        </div>

        {claimMessage && (
          <div className="mt-3 p-2.5 rounded-xl text-xs font-bold bg-cyan-50 text-cyan-900 border border-cyan-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span>{claimMessage}</span>
          </div>
        )}

        {!todayPayment && (
          <button
            onClick={handleClaimDailyPayout}
            disabled={claiming}
            className="mt-3 w-full bg-primary-container text-on-primary hover:bg-primary-container/90 active:scale-[0.98] transition-all font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span>{claiming ? 'Processing Payout...' : 'Claim Today’s Wage Payout'}</span>
          </button>
        )}
      </div>

      {/* Disbursement Records List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Disbursement History ({payments.length})
          </h3>
          <span className="text-[10px] text-slate-500 font-medium">Click card for digital voucher</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-on-surface-variant font-bold flex flex-col items-center gap-2">
            <span className="material-symbols-outlined animate-spin text-[24px]">sync</span>
            <span>Loading payslip records...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-white rounded-xl border border-outline-variant p-6 text-center text-xs text-on-surface-variant">
            No payouts recorded yet. Completed shifts and instant wage transfers will appear here.
          </div>
        ) : (
          payments.map((p: Payment) => (
            <div
              key={p.id}
              onClick={() => setSelectedPayslip(p)}
              className="bg-white rounded-xl border border-outline-variant p-4 shadow-[0_2px_8px_rgba(13,28,50,0.04)] flex justify-between items-center cursor-pointer transition-all hover:border-cyan-500/50 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-background">
                    {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'SUCCESS' ? 'bg-[#d5e0f7] text-[#0d1c32]' : 'bg-[#ffdad6] text-[#93000a]'
                      }`}
                    >
                      {p.status}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {p.type} &bull; Razorpay
                    </span>
                  </div>
                  {p.razorpayPayoutId && (
                    <p className="text-[10px] text-slate-400 font-mono mt-1 truncate max-w-[170px]">
                      ID: {p.razorpayPayoutId}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="text-base font-black text-emerald-700">{INR(p.amount)}</p>
                <span className="text-[10px] text-emerald-600 block">&Phi;_comp 100%</span>
                <span className="text-[10px] text-primary font-bold hover:underline mt-1 inline-flex items-center gap-0.5">
                  Voucher <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Payout Account Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-outline-variant animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-on-background">Update Payout Details</h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-on-surface-variant hover:text-on-background"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveBankDetails} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  UPI ID (VPA)
                </label>
                <input
                  type="text"
                  placeholder="e.g. yourname@upi"
                  value={editUpiId}
                  onChange={(e) => setEditUpiId(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant text-sm rounded-xl h-[42px] px-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="text-center my-1 text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                — OR Direct Bank Transfer —
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  placeholder="Full name as in bank"
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant text-sm rounded-xl h-[42px] px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123456789012"
                  value={editBankAcc}
                  onChange={(e) => setEditBankAcc(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant text-sm rounded-xl h-[42px] px-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. SBIN0001234"
                  value={editIfsc}
                  onChange={(e) => setEditIfsc(e.target.value.toUpperCase())}
                  className="w-full bg-surface-container-low border border-outline-variant text-sm rounded-xl h-[42px] px-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                />
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-outline-variant font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBank}
                  className="w-1/2 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs uppercase shadow-md disabled:opacity-50"
                >
                  {savingBank ? 'Saving...' : 'Save Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Digital Payslip Voucher Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-outline-variant animate-in fade-in zoom-in-95 duration-200">
            {/* Voucher Header */}
            <div className="border-b border-outline-variant/60 pb-3 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[20px]">domain</span>
                  <span className="font-extrabold text-sm tracking-tight">SiteTrack AI</span>
                </div>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mt-0.5">
                  Official Digital Wage Voucher
                </p>
              </div>
              <button
                onClick={() => setSelectedPayslip(null)}
                className="text-on-surface-variant hover:text-on-background"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Voucher Details */}
            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Worker Name:</span>
                <span className="font-bold text-on-background">{workerData?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Project:</span>
                <span className="font-bold text-on-background">{workerData?.project?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Disbursement Date:</span>
                <span className="font-mono text-on-background">
                  {new Date(selectedPayslip.paymentDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Razorpay Payout ID:</span>
                <span className="font-mono text-[10px] text-on-background truncate max-w-[160px]">
                  {selectedPayslip.razorpayPayoutId || 'sim_payout_auto'}
                </span>
              </div>

              {/* Breakdown Table */}
              <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/60 mt-2 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Enrolled Base Shift Rate:</span>
                  <span className="font-mono font-bold">₹{baseRate}.00</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Safety Compliance Multiplier:</span>
                  <span className="font-mono font-bold text-emerald-600">&times; 1.00 (&Phi;_comp)</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>PPE Penalties / Deductions:</span>
                  <span className="font-mono font-bold text-slate-400">₹0.00</span>
                </div>
                <div className="border-t border-outline-variant/60 pt-1.5 flex justify-between text-sm font-black text-on-background">
                  <span>Net Disbursed Amount:</span>
                  <span className="text-emerald-700 font-mono">{INR(selectedPayslip.amount)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg font-medium">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>Verified by Subsystem C Instant Payout Gateway</span>
              </div>
            </div>

            {/* Voucher Footer Actions */}
            <div className="flex gap-2 pt-2 border-t border-outline-variant/60">
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase flex items-center justify-center gap-1.5 hover:bg-slate-800 active:scale-95 transition-all shadow-md"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print / Save Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
