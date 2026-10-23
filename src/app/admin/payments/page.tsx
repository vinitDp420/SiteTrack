'use client';

import React, { useEffect, useState } from 'react';
import Script from 'next/script';
import { useProject } from '@/lib/project-context';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface WorkerInfo {
  id: string;
  name: string;
  phone: string;
  wageRate: number;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  ifscCode: string | null;
  upiId: string | null;
  paymentType: string;
  isPaidToday?: boolean;
  todayPayment?: {
    id: string;
    amount: number;
    status: string;
    razorpayPayoutId: string | null;
    paymentDate: string;
    type: string;
  } | null;
}

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
    bankAccountName?: string | null;
    ifscCode?: string | null;
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

interface RazorpayConfig {
  keyId: string;
  isSimulation: boolean;
  companyName: string;
  themeColor: string;
}

interface SimulatedCheckoutOrder {
  orderId: string;
  amount: number;
  workerId?: string;
  workerName: string;
  type: string;
  isBulk?: boolean;
  workerIds?: string[];
  workerAmounts?: Record<string, number>;
}

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function PaymentsPage() {
  const { selectedProject } = useProject();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [razorpayConfig, setRazorpayConfig] = useState<RazorpayConfig | null>(null);
  const [summary, setSummary] = useState<Summary>({
    totalPaid: 0,
    totalCount: 0,
    todayPaid: 0,
    todayCount: 0,
    monthPaid: 0,
    monthCount: 0,
    pendingCount: 0,
    failedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [processingMonthly, setProcessingMonthly] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'DAILY' | 'MONTHLY' | 'CASH' | 'PAYROLL' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals & Notifications
  const [selectedVoucher, setSelectedVoucher] = useState<Payment | null>(null);
  const [isNewPaymentModalOpen, setIsNewPaymentModalOpen] = useState(false);
  const [paymentScope, setPaymentScope] = useState<'SINGLE' | 'ALL'>('ALL'); // 'SINGLE' or 'ALL'
  const [newPaymentWorkerId, setNewPaymentWorkerId] = useState<string>('');
  const [newPaymentAmount, setNewPaymentAmount] = useState<string>('');
  const [newPaymentType, setNewPaymentType] = useState<'DAILY' | 'MONTHLY' | 'BONUS'>('DAILY');
  const [customBatchAmount, setCustomBatchAmount] = useState<string>('');
  const [useCustomBatchAmount, setUseCustomBatchAmount] = useState<boolean>(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  
  // Simulated Razorpay Checkout Gateway State
  const [simulatedCheckoutOrder, setSimulatedCheckoutOrder] = useState<SimulatedCheckoutOrder | null>(null);
  const [checkoutPaymentTab, setCheckoutPaymentTab] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchPayments = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payments?projectId=${selectedProject.id}`);
      const data = await res.json();
      setPayments(data.payments || []);
      setSummary(data.summary || summary);
      if (data.workers) setWorkers(data.workers);
      if (data.razorpayConfig) setRazorpayConfig(data.razorpayConfig);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedProject) fetchPayments();
  }, [selectedProject]);

  // Partition workers into unpaid today vs already paid today
  const unpaidWorkers = workers.filter((w) => !w.isPaidToday);
  const paidTodayWorkers = workers.filter((w) => w.isPaidToday);

  // Selected worker details for single payment
  const selectedWorker = workers.find((w) => w.id === newPaymentWorkerId);

  // Calculate total batch payment amount (ONLY for unpaid workers to prevent duplicate charges!)
  const calculateTotalBatchAmount = () => {
    if (unpaidWorkers.length === 0) return 0;
    if (useCustomBatchAmount && customBatchAmount) {
      return Number(customBatchAmount) * unpaidWorkers.length;
    }
    return unpaidWorkers.reduce((sum, w) => sum + w.wageRate, 0);
  };

  // 1. Instant RazorpayX Transfer (Handles Single or ALL workers)
  const handleInstantRazorpayTransfer = async () => {
    setIsSubmittingPayment(true);
    try {
      if (paymentScope === 'ALL') {
        // Disburse to ALL UNPAID workers in project
        if (unpaidWorkers.length === 0) {
          alert('All active workers have already been paid today. Duplicate payments are not permitted.');
          setIsSubmittingPayment(false);
          return;
        }

        const totalAmount = calculateTotalBatchAmount();
        const res = await fetch('/api/payments/disburse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch: true,
            projectId: selectedProject?.id,
            workerIds: unpaidWorkers.map((w) => w.id),
            type: newPaymentType,
            amountPerWorker: useCustomBatchAmount && customBatchAmount ? Number(customBatchAmount) : undefined,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(data.message || `Disbursed ₹${totalAmount} to ${unpaidWorkers.length} workers via Razorpay!`, 'success');
          setIsNewPaymentModalOpen(false);
          fetchPayments();
        } else {
          showToast(data.error || 'Batch payout failed.', 'error');
        }
      } else {
        // Single Worker Payout with Duplicate Check
        if (!newPaymentWorkerId) {
          alert('Please select a worker.');
          setIsSubmittingPayment(false);
          return;
        }

        if (selectedWorker?.isPaidToday) {
          alert(`${selectedWorker.name} has already received payment today of ₹${selectedWorker.todayPayment?.amount}. Duplicate payments are blocked.`);
          setIsSubmittingPayment(false);
          return;
        }

        const amt = Number(newPaymentAmount);
        if (!amt || amt <= 0) {
          alert('Please enter a valid amount.');
          setIsSubmittingPayment(false);
          return;
        }

        const res = await fetch('/api/payments/disburse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId: newPaymentWorkerId,
            amount: amt,
            type: newPaymentType,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(data.message || `₹${amt} disbursed successfully via Razorpay!`, 'success');
          setIsNewPaymentModalOpen(false);
          fetchPayments();
        } else {
          showToast(data.error || 'Razorpay payout failed.', 'error');
        }
      }
    } catch {
      showToast('Network error while processing Razorpay payout.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // 1b. Cash in Hand Disbursement (Supports Single worker & Batch)
  const handleCashPayment = async () => {
    setIsSubmittingPayment(true);
    try {
      if (paymentScope === 'ALL') {
        if (unpaidWorkers.length === 0) {
          alert('All active workers have already been paid today.');
          setIsSubmittingPayment(false);
          return;
        }

        const totalAmount = calculateTotalBatchAmount();
        const count = unpaidWorkers.length;
        if (!window.confirm(`Disburse ${INR(totalAmount)} in CASH to ${count} unpaid workers?\n\nThis will record official cash payment vouchers for each worker without requiring bank accounts.`)) {
          setIsSubmittingPayment(false);
          return;
        }

        const res = await fetch('/api/payments/disburse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch: true,
            method: 'CASH',
            projectId: selectedProject?.id,
            workerIds: unpaidWorkers.map((w) => w.id),
            type: newPaymentType,
            amountPerWorker: useCustomBatchAmount && customBatchAmount ? Number(customBatchAmount) : undefined,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(data.message || `₹${totalAmount} Cash in hand disbursed to ${count} workers!`, 'success');
          setIsNewPaymentModalOpen(false);
          fetchPayments();
        } else {
          showToast(data.error || 'Batch cash payout failed.', 'error');
        }
      } else {
        if (!newPaymentWorkerId) {
          alert('Please select a worker.');
          setIsSubmittingPayment(false);
          return;
        }

        if (selectedWorker?.isPaidToday) {
          alert(`${selectedWorker.name} has already received payment today of ₹${selectedWorker.todayPayment?.amount}. Duplicate payments are blocked.`);
          setIsSubmittingPayment(false);
          return;
        }

        const amt = Number(newPaymentAmount);
        if (!amt || amt <= 0) {
          alert('Please enter a valid payment amount.');
          setIsSubmittingPayment(false);
          return;
        }

        const confirmMsg = `Confirm Cash Payment of ${INR(amt)} to ${selectedWorker?.name}?\n\n• Mode: Cash in Hand (Physical Handover)\n• No bank account / UPI required\n• An official verifiable Cash Voucher will be generated.`;
        if (!window.confirm(confirmMsg)) {
          setIsSubmittingPayment(false);
          return;
        }

        const res = await fetch('/api/payments/disburse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId: newPaymentWorkerId,
            amount: amt,
            type: newPaymentType,
            method: 'CASH',
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(data.message || `₹${amt} cash payment recorded for ${selectedWorker?.name}!`, 'success');
          setIsNewPaymentModalOpen(false);
          await fetchPayments();
          if (data.payment) {
            setSelectedVoucher(data.payment);
          }
        } else {
          showToast(data.error || 'Failed to record cash payment.', 'error');
        }
      }
    } catch {
      showToast('Network error while processing cash payment.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // 2. Razorpay Checkout Modal Initiator
  const handleRazorpayCheckout = async () => {
    setIsSubmittingPayment(true);
    try {
      const isBulk = paymentScope === 'ALL';

      if (isBulk) {
        if (unpaidWorkers.length === 0) {
          alert('All active workers have already been paid today. Duplicate payments are not allowed.');
          setIsSubmittingPayment(false);
          return;
        }
      } else {
        if (!newPaymentWorkerId) {
          alert('Please select a worker.');
          setIsSubmittingPayment(false);
          return;
        }
        if (selectedWorker?.isPaidToday) {
          alert(`${selectedWorker.name} has already received payment today of ₹${selectedWorker.todayPayment?.amount}. Duplicate payments are blocked.`);
          setIsSubmittingPayment(false);
          return;
        }
      }

      const totalAmt = isBulk ? calculateTotalBatchAmount() : Number(newPaymentAmount);
      if (!totalAmt || totalAmt <= 0) {
        alert('Invalid payment amount.');
        setIsSubmittingPayment(false);
        return;
      }

      const workerAmounts: Record<string, number> = {};
      if (isBulk) {
        unpaidWorkers.forEach((w) => {
          workerAmounts[w.id] = useCustomBatchAmount && customBatchAmount ? Number(customBatchAmount) : w.wageRate;
        });
      }

      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: isBulk ? undefined : newPaymentWorkerId,
          amount: totalAmt,
          isBulk,
          projectId: selectedProject?.id,
          description: isBulk ? `Payment to ${unpaidWorkers.length} Unpaid Workers` : `Wage: ${selectedWorker?.name}`,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to initialize Razorpay Order');
      }

      const isRealKeysConfigured = !orderData.isSimulation && orderData.keyId && 
        orderData.keyId.startsWith('rzp_') && 
        !orderData.keyId.includes('simulation') && 
        !orderData.keyId.includes('sitetrack');

      if (isRealKeysConfigured && typeof window !== 'undefined' && window.Razorpay) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: 'INR',
          name: 'SiteTrack Payments',
          description: orderData.description,
          image: '/favicon.ico',
          order_id: orderData.orderId,
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  workerId: isBulk ? undefined : newPaymentWorkerId,
                  amount: totalAmt,
                  type: newPaymentType,
                  projectId: selectedProject?.id,
                  isBulk,
                  workerIds: isBulk ? unpaidWorkers.map((w) => w.id) : undefined,
                  workerAmounts: isBulk ? workerAmounts : undefined,
                  razorpayOrderId: response.razorpay_order_id || orderData.orderId,
                  razorpayPaymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
                  razorpaySignature: response.razorpay_signature || '',
                }),
              });
              const verifyData = await verifyRes.json();
              if (verifyRes.ok && verifyData.success) {
                showToast(verifyData.message, 'success');
                setIsNewPaymentModalOpen(false);
                fetchPayments();
              } else {
                showToast(verifyData.error || 'Payment signature verification failed', 'error');
              }
            } catch {
              showToast('Verification network error.', 'error');
            }
          },
          prefill: {
            name: selectedWorker?.name || 'Unpaid Workers Payroll',
            contact: selectedWorker?.phone || '+91 98201 11111',
          },
          theme: {
            color: '#0d1c32',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          showToast(`Razorpay checkout failed: ${resp.error?.description || 'Cancelled'}`, 'error');
        });
        rzp.open();
      } else {
        // Open Built-in Simulated Razorpay Checkout Gateway modal
        setSimulatedCheckoutOrder({
          orderId: orderData.orderId,
          amount: totalAmt,
          workerId: isBulk ? undefined : newPaymentWorkerId,
          workerName: isBulk ? `${unpaidWorkers.length} Unpaid Workers (Batch)` : (selectedWorker?.name || 'Worker'),
          type: newPaymentType,
          isBulk,
          workerIds: isBulk ? unpaidWorkers.map((w) => w.id) : undefined,
          workerAmounts: isBulk ? workerAmounts : undefined,
        });
        setIsNewPaymentModalOpen(false);
      }
    } catch (e: any) {
      showToast(e.message || 'Error triggering Razorpay Checkout.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Complete Simulated Checkout Success
  const handleSimulatedCheckoutSuccess = async () => {
    if (!simulatedCheckoutOrder) return;
    setIsSubmittingPayment(true);
    try {
      const generatedPaymentId = `pay_sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: simulatedCheckoutOrder.workerId,
          amount: simulatedCheckoutOrder.amount,
          type: simulatedCheckoutOrder.type,
          projectId: selectedProject?.id,
          razorpayOrderId: simulatedCheckoutOrder.orderId,
          razorpayPaymentId: generatedPaymentId,
          razorpaySignature: 'sim_signature_verified',
          isBulk: simulatedCheckoutOrder.isBulk,
          workerIds: simulatedCheckoutOrder.workerIds,
          workerAmounts: simulatedCheckoutOrder.workerAmounts,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          simulatedCheckoutOrder.isBulk
            ? `Batch Payment of ${INR(simulatedCheckoutOrder.amount)} Settled via Razorpay for ${simulatedCheckoutOrder.workerIds?.length} workers!`
            : `Razorpay Payment Settled! Txn ID: ${generatedPaymentId}`,
          'success'
        );
        setSimulatedCheckoutOrder(null);
        fetchPayments();
      } else {
        showToast(data.error || 'Payment verification failed.', 'error');
      }
    } catch {
      showToast('Error completing simulated checkout.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // 3. Process Monthly Salary via Razorpay
  const handleProcessMonthly = async () => {
    if (!selectedProject || processingMonthly) return;
    if (!confirm('Process monthly salary payouts via Razorpay for all eligible workers in this project?')) return;
    setProcessingMonthly(true);
    try {
      const res = await fetch('/api/payments/process-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject.id }),
      });
      const data = await res.json();
      showToast(data.message || 'Monthly payroll processed via Razorpay.', 'success');
      fetchPayments();
    } catch {
      showToast('Failed to process monthly payroll.', 'error');
    }
    setProcessingMonthly(false);
  };

  // 4. Retry Failed Payout with Razorpay
  const handleRetry = async (paymentId: string) => {
    setRetryingId(paymentId);
    try {
      const res = await fetch('/api/payments/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (res.ok && data.payment) {
        showToast(data.message || 'Razorpay retry successful!', 'success');
        fetchPayments();
      } else {
        showToast(data.error || 'Retry failed.', 'error');
      }
    } catch {
      showToast('Retry request failed.', 'error');
    }
    setRetryingId(null);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'SUCCESS': return 'bg-[#d5f5d5] text-[#0a5c0a] border border-emerald-300';
      case 'FAILED': return 'bg-[#ffdad6] text-[#93000a] border border-red-300';
      case 'PROCESSING': return 'bg-[#ffddb8] text-[#2a1700] border border-amber-300';
      case 'PENDING': return 'bg-slate-200 text-slate-700';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const filteredPayments = payments.filter((pay) => {
    const matchesSearch = pay.worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pay.razorpayPayoutId && pay.razorpayPayoutId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (pay.worker.upiId && pay.worker.upiId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (pay.worker.bankAccountNumber && pay.worker.bankAccountNumber.includes(searchQuery));

    if (!matchesSearch) return false;

    if (filterType === 'DAILY') return pay.type === 'DAILY' && !pay.razorpayPayoutId?.startsWith('CASH');
    if (filterType === 'MONTHLY') return pay.type === 'MONTHLY';
    if (filterType === 'CASH') return pay.razorpayPayoutId?.startsWith('CASH');
    if (filterType === 'PAYROLL') return pay.type === 'MONTHLY' || (pay.razorpayPayoutId && (pay.razorpayPayoutId.includes('BATCH') || pay.razorpayPayoutId.includes('bulk')));
    if (filterType === 'FAILED') return pay.status === 'FAILED' || pay.status === 'PENDING';
    return true;
  });

  const tabCounts = {
    ALL: payments.length,
    DAILY: payments.filter((p) => p.type === 'DAILY' && !p.razorpayPayoutId?.startsWith('CASH')).length,
    MONTHLY: payments.filter((p) => p.type === 'MONTHLY').length,
    CASH: payments.filter((p) => p.razorpayPayoutId?.startsWith('CASH')).length,
    PAYROLL: payments.filter((p) => p.type === 'MONTHLY' || (p.razorpayPayoutId && (p.razorpayPayoutId.includes('BATCH') || p.razorpayPayoutId.includes('bulk')))).length,
    FAILED: payments.filter((p) => p.status === 'FAILED' || p.status === 'PENDING').length,
  };

  // Generate and Download PDF Payslip Voucher
  const handleDownloadPayslip = (voucher: Payment) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${voucher.worker.name} (${voucher.id.slice(0, 8)})</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
          .logo { font-size: 24px; font-weight: 900; color: #0f172a; }
          .logo span { color: #0284c7; }
          .badge { background: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; letter-spacing: 0.05em; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
          .box-title { font-size: 10px; text-transform: uppercase; font-weight: bold; color: #64748b; margin-bottom: 6px; letter-spacing: 0.05em; }
          .box-value { font-size: 16px; font-weight: 800; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; padding: 12px 14px; background: #f1f5f9; font-size: 11px; font-weight: bold; color: #475569; border-bottom: 1px solid #cbd5e1; text-transform: uppercase; }
          td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .amount-row { font-size: 18px; font-weight: 900; color: #059669; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">Site<span>Track</span></div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Autonomous Construction Edge ERP &amp; Payroll</div>
          </div>
          <div class="badge" style="${voucher.razorpayPayoutId?.startsWith('CASH') ? 'background: #dcfce7; color: #166534;' : ''}">
            ${voucher.razorpayPayoutId?.startsWith('CASH') ? 'OFFICIAL CASH DISBURSEMENT VOUCHER' : 'OFFICIAL PAYMENT VOUCHER'}
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Worker / Beneficiary</div>
            <div class="box-value">${voucher.worker.name}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
              Destination: ${voucher.razorpayPayoutId?.startsWith('CASH') ? '💵 Cash in Hand (Physical Handover)' : voucher.worker.upiId ? 'UPI: ' + voucher.worker.upiId : voucher.worker.bankAccountNumber ? 'A/C: ••••' + voucher.worker.bankAccountNumber.slice(-4) : 'Bank IMPS'}
            </div>
          </div>
          <div class="box">
            <div class="box-title">Disbursement Details</div>
            <div class="box-value" style="color: #059669;">₹${voucher.amount.toLocaleString('en-IN')}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
              ${voucher.razorpayPayoutId?.startsWith('CASH') ? 'Cash Voucher Ref: ' + voucher.razorpayPayoutId : 'Ref ID: ' + (voucher.razorpayPayoutId || 'sim_' + voucher.id.slice(0, 8))}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Type</th>
              <th>Mode</th>
              <th>Status</th>
              <th style="text-align: right;">Disbursed Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${voucher.razorpayPayoutId?.startsWith('CASH') ? 'Physical Cash Wage Handover & Verified Attendance' : 'Wage Settlement & Verified Edge Biometric Attendance'}</td>
              <td>${voucher.type}</td>
              <td style="font-weight: bold; color: ${voucher.razorpayPayoutId?.startsWith('CASH') ? '#166534' : '#0369a1'};">
                ${voucher.razorpayPayoutId?.startsWith('CASH') ? 'CASH IN HAND' : 'ONLINE TRANSFER'}
              </td>
              <td style="color: #059669; font-weight: bold;">${voucher.status}</td>
              <td style="text-align: right;" class="amount-row">₹${voucher.amount.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>

        ${voucher.razorpayPayoutId?.startsWith('CASH') ? `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px;">
          <div style="border-top: 1.5px dashed #64748b; padding-top: 8px; text-align: center; font-size: 11px; font-weight: bold; color: #334155;">
            Worker Signature / Thumb Impression<br/>
            <span style="font-size: 10px; font-weight: normal; color: #94a3b8;">I hereby acknowledge receipt of cash in full</span>
          </div>
          <div style="border-top: 1.5px dashed #64748b; padding-top: 8px; text-align: center; font-size: 11px; font-weight: bold; color: #334155;">
            Supervisor / Cashier Signature<br/>
            <span style="font-size: 10px; font-weight: normal; color: #94a3b8;">Authorized Site Disbursing Officer</span>
          </div>
        </div>
        ` : ''}

        <div class="footer">
          ${voucher.razorpayPayoutId?.startsWith('CASH') 
            ? `Cash voucher officially recorded on ${new Date(voucher.paymentDate).toLocaleString('en-IN')} on site.<br/>` 
            : `Digitally generated on ${new Date(voucher.paymentDate).toLocaleString('en-IN')} via Razorpay Payouts Gateway.<br/>`}
          SiteTrack Construction ERP • Zero-Touch Biometric Verification
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Floating Notification */}
      {toast && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm shadow-xl border ${
          toast.type === 'success' ? 'bg-emerald-950 text-white border-emerald-500' : 'bg-red-950 text-white border-red-500'
        }`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-cyan-400">
              {toast.type === 'success' ? 'verified' : 'error'}
            </span>
            <span className="font-semibold">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-white/80 hover:text-white ml-4">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary tracking-tight">Payments & Payouts</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0d1c32] text-cyan-400 border border-cyan-500/30 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Razorpay Payouts Gateway</span>
            </div>
            {razorpayConfig?.isSimulation && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                SANDBOX SIMULATION
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface-variant mt-1.5">
            {selectedProject ? (
              <>Automated wage transfers via Razorpay for <span className="font-bold text-on-surface">{selectedProject.name}</span></>
            ) : (
              'Instant UPI / Bank IMPS wage disbursements and settlement ledger.'
            )}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* PRIMARY BUTTON: PAY ALL UNPAID WORKERS */}
          <button
            onClick={() => {
              setPaymentScope('ALL');
              setIsNewPaymentModalOpen(true);
            }}
            disabled={!selectedProject || workers.length === 0}
            className={`h-[42px] px-4 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition disabled:opacity-50 ${
              unpaidWorkers.length === 0
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 text-white hover:opacity-95'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {unpaidWorkers.length === 0 ? 'check_circle' : 'group'}
            </span>
            <span>
              {unpaidWorkers.length === 0
                ? 'All Paid Today (✓)'
                : `Pay Unpaid Workers (${unpaidWorkers.length})`}
            </span>
          </button>

          {/* SECONDARY BUTTON: INDIVIDUAL WORKER PAYMENT */}
          <button
            onClick={() => {
              setPaymentScope('SINGLE');
              // Auto-select first unpaid worker if possible
              const firstUnpaid = unpaidWorkers[0] || workers[0];
              if (firstUnpaid) {
                setNewPaymentWorkerId(firstUnpaid.id);
                setNewPaymentAmount(String(firstUnpaid.wageRate));
              }
              setIsNewPaymentModalOpen(true);
            }}
            disabled={!selectedProject || workers.length === 0}
            className="h-[42px] bg-[#0d1c32] text-white px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow hover:bg-[#152e52] transition disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            <span>Single Worker</span>
            {unpaidWorkers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-400 text-[#0d1c32] font-black">
                {unpaidWorkers.length}
              </span>
            )}
          </button>

          {/* MONTHLY PAYROLL BUTTON */}
          <button
            onClick={handleProcessMonthly}
            disabled={processingMonthly || !selectedProject}
            className="h-[42px] bg-gradient-to-r from-[#b87500] to-[#e09800] text-white px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow hover:opacity-90 transition disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">account_balance</span>
            {processingMonthly ? 'Processing...' : 'Disburse Monthly'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary to-[#1a3a6e] text-white p-5 rounded-2xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Paid Today (Razorpay)</p>
          <h3 className="text-2xl font-black mt-1">{INR(summary.todayPaid)}</h3>
          <p className="text-xs opacity-60 mt-1">{summary.todayCount} payout{summary.todayCount !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white border border-outline-variant p-5 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">This Month Settled</p>
          <h3 className="text-2xl font-black mt-1 text-on-surface">{INR(summary.monthPaid)}</h3>
          <p className="text-xs text-on-surface-variant mt-1">{summary.monthCount} transactions</p>
        </div>

        <div className="bg-white border border-outline-variant p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b87500] text-[16px]">pending</span>
            <p className="text-[10px] font-bold text-[#b87500] uppercase tracking-widest">Unpaid Workers Today</p>
          </div>
          <h3 className="text-2xl font-black mt-1 text-[#b87500]">{unpaidWorkers.length}</h3>
        </div>

        <div className="bg-white border border-outline-variant p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[16px]">error</span>
            <p className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-widest">Failed Payouts</p>
          </div>
          <h3 className="text-2xl font-black mt-1 text-[#ba1a1a]">{summary.failedCount}</h3>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'DAILY', 'MONTHLY', 'CASH', 'PAYROLL', 'FAILED'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                filterType === t
                  ? 'bg-primary text-white shadow'
                  : 'bg-white border border-outline-variant text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              <span>
                {t === 'ALL'
                  ? 'All Payments'
                  : t === 'DAILY'
                    ? 'Daily Wages'
                    : t === 'MONTHLY'
                      ? 'Monthly Salary'
                      : t === 'CASH'
                        ? '💵 Cash in Hand'
                        : t === 'PAYROLL'
                          ? 'Payroll Batches'
                          : 'Failed / Pending'}
              </span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  filterType === t
                    ? 'bg-white/20 text-white'
                    : t === 'FAILED' && tabCounts.FAILED > 0
                      ? 'bg-red-100 text-red-700 font-extrabold'
                      : t === 'CASH' && tabCounts.CASH > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tabCounts[t]}
              </span>
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by worker, Razorpay ID, UPI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Payment Ledger */}
      {loading ? (
        <div className="text-center py-12 font-bold text-on-surface-variant">
          <span className="material-symbols-outlined text-[32px] animate-spin text-primary">sync</span>
          <p className="mt-2 text-sm">Loading Razorpay transaction ledger...</p>
        </div>
      ) : (
        <div className="bg-white border border-outline-variant rounded-2xl shadow-[0_2px_12px_rgba(13,28,50,0.06)] overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-outline-variant bg-surface-container-low text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            <div className="col-span-3">Worker & Account</div>
            <div className="col-span-2">Disbursed Amount</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-2">Date & Time</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Razorpay Ref ID</div>
            <div className="col-span-1 text-right">Receipt / Action</div>
          </div>

          <div className="divide-y divide-outline-variant">
            {filteredPayments.length === 0 ? (
              <div className="p-12 text-center">
                <span className={`material-symbols-outlined text-[48px] ${
                  filterType === 'FAILED' ? 'text-emerald-500' : 'text-on-surface-variant/40'
                }`}>
                  {filterType === 'FAILED' ? 'verified' : filterType === 'CASH' ? 'payments' : 'receipt_long'}
                </span>
                <p className="text-sm text-on-surface font-bold mt-2">
                  {filterType === 'FAILED'
                    ? 'All Disbursements Reconciled & Healthy'
                    : filterType === 'CASH'
                      ? 'No Cash in Hand Disbursements Found'
                      : filterType === 'PAYROLL'
                        ? 'No Payroll Batches Recorded'
                        : 'No payment records found'}
                </p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-md mx-auto">
                  {filterType === 'FAILED'
                    ? 'There are no failed or stuck payouts for this project. All wage transfers have been verified.'
                    : filterType === 'CASH'
                      ? 'When executing wage payments, choose "Cash in Hand" for unbanked workers to generate physical disbursement vouchers.'
                      : filterType === 'PAYROLL'
                        ? 'Use "Pay Unpaid Workers" or "Disburse Monthly" above to process batch wage payouts.'
                        : 'Click "Pay Unpaid Workers" or "Single Worker" to initiate wage transfers.'}
                </p>
              </div>
            ) : (
              filteredPayments.map((pay) => (
                <div
                  key={pay.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-6 py-4 items-center text-sm hover:bg-surface-container-low/40 transition-colors"
                >
                  <div className="col-span-3">
                    <div className="font-bold text-on-surface text-base">{pay.worker.name}</div>
                    <div className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                      {pay.razorpayPayoutId?.startsWith('CASH') ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300">
                          <span className="material-symbols-outlined text-[13px] text-emerald-700">payments</span>
                          Cash in Hand
                        </span>
                      ) : pay.worker.upiId ? (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <span className="material-symbols-outlined text-[12px]">smartphone</span>
                          {pay.worker.upiId}
                        </span>
                      ) : pay.worker.bankAccountNumber ? (
                        <span>A/C: ••••{pay.worker.bankAccountNumber.slice(-4)}</span>
                      ) : (
                        <span className="text-slate-400">No account details</span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 font-black text-primary text-base">{INR(pay.amount)}</div>

                  <div className="col-span-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-extrabold rounded-lg ${
                      pay.type === 'DAILY'
                        ? 'bg-[#d5e0f7] text-[#0d1c32]'
                        : pay.type === 'MONTHLY'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-teal-100 text-teal-800'
                    }`}>
                      {pay.type}
                    </span>
                  </div>

                  <div className="col-span-2 text-on-surface-variant text-xs">
                    <div className="font-semibold text-on-surface">
                      {new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {new Date(pay.paymentDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="col-span-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-lg ${statusColor(pay.status)}`}>
                      {pay.status}
                    </span>
                    {pay.failureReason && (
                      <p className="text-[10px] text-[#ba1a1a] mt-0.5 truncate max-w-[140px]" title={pay.failureReason}>
                        {pay.failureReason}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2">
                    {pay.razorpayPayoutId ? (
                      <button
                        onClick={() => setSelectedVoucher(pay)}
                        title="Click to view digital receipt / voucher"
                        className={`text-[11px] font-mono font-bold hover:underline truncate max-w-[170px] block text-left ${
                          pay.razorpayPayoutId.startsWith('CASH') ? 'text-emerald-700' : 'text-primary'
                        }`}
                      >
                        {pay.razorpayPayoutId}
                      </button>
                    ) : (
                      <span className="text-slate-400 font-mono text-xs">—</span>
                    )}
                  </div>

                  <div className="col-span-1 flex justify-end gap-1.5">
                    {(pay.status === 'FAILED' || pay.status === 'PENDING') && (
                      <button
                        onClick={() => handleRetry(pay.id)}
                        disabled={retryingId === pay.id}
                        className="px-2.5 py-1 bg-[#ba1a1a] text-white text-[10px] font-bold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1 shadow-sm transition"
                        title="Retry disbursement via Razorpay"
                      >
                        <span className="material-symbols-outlined text-[13px]">refresh</span>
                        {retryingId === pay.id ? '...' : 'Retry'}
                      </button>
                    )}

                    {pay.status === 'SUCCESS' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownloadPayslip(pay)}
                          title="Download Official PDF Payslip"
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                        </button>
                        <button
                          onClick={() => setSelectedVoucher(pay)}
                          title="View Razorpay Voucher"
                          className="p-1.5 text-primary hover:bg-slate-100 rounded-lg transition"
                        >
                          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Razorpay Payment Modal (With Duplicate Payment Protection) */}
      {isNewPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-outline-variant overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#0d1c32] text-white p-5 flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-400/20 flex items-center justify-center border border-cyan-400/40">
                  <span className="material-symbols-outlined text-cyan-300 text-[18px]">
                    {paymentScope === 'ALL' ? 'group' : 'payments'}
                  </span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    {paymentScope === 'ALL' ? 'Disburse Payment to All Unpaid Workers' : 'Initiate Single Worker Payment'}
                  </h3>
                  <p className="text-[11px] text-cyan-200/80 font-mono">
                    {paymentScope === 'ALL'
                      ? `Batch payout (Cash in Hand or Razorpay)`
                      : 'Direct wage transfer (Cash in Hand or Razorpay)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewPaymentModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Segmented Toggle: All Workers vs Single Worker */}
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPaymentScope('ALL')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    paymentScope === 'ALL'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">group</span>
                  <span>Pay All ({unpaidWorkers.length} Unpaid)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentScope('SINGLE');
                    const firstUnpaid = workers.find((w) => !w.isPaidToday) || workers[0];
                    if (firstUnpaid) {
                      setNewPaymentWorkerId(firstUnpaid.id);
                      setNewPaymentAmount(String(firstUnpaid.wageRate));
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    paymentScope === 'SINGLE'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">person</span>
                  <span>Single Worker</span>
                </button>
              </div>

              {/* VIEW 1: PAY ALL WORKERS */}
              {paymentScope === 'ALL' ? (
                <div className="space-y-4">
                  {unpaidWorkers.length === 0 ? (
                    <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-xl text-center space-y-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[32px]">task_alt</span>
                      <h3 className="font-extrabold text-emerald-900 text-sm">All Workers Already Paid Today!</h3>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        All {workers.length} active site personnel have already received their wage payouts today.
                        Duplicate payments are automatically blocked.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Summary Box */}
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            Total Payout for Unpaid Workers
                          </p>
                          <h2 className="text-2xl font-black text-emerald-700 mt-0.5">
                            {INR(calculateTotalBatchAmount())}
                          </h2>
                        </div>
                        <div className="text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                            {unpaidWorkers.length} Unpaid Today
                          </span>
                          {paidTodayWorkers.length > 0 && (
                            <p className="text-[10px] text-slate-500 mt-1 font-mono">
                              ({paidTodayWorkers.length} already paid - skipped)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Wage Calculation Mode for Batch */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                            Wage Calculation Mode
                          </label>
                          <button
                            type="button"
                            onClick={() => setUseCustomBatchAmount(!useCustomBatchAmount)}
                            className="text-[11px] font-bold text-primary hover:underline"
                          >
                            {useCustomBatchAmount ? 'Use Enrolled Daily Rates' : 'Set Uniform Amount Each'}
                          </button>
                        </div>

                        {useCustomBatchAmount ? (
                          <div>
                            <input
                              type="number"
                              min="1"
                              placeholder="Enter uniform amount per worker (e.g. 1000)"
                              value={customBatchAmount}
                              onChange={(e) => setCustomBatchAmount(e.target.value)}
                              className="w-full px-3 py-2 text-sm rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                              Every unpaid worker will receive ₹{customBatchAmount || '0'}. Total: {INR(calculateTotalBatchAmount())}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            Disburses each unpaid worker&apos;s registered daily wage rate.
                          </p>
                        )}
                      </div>

                      {/* Worker Roster Preview with Paid / Unpaid badges */}
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                          Roster Status ({workers.length} Personnel)
                        </label>
                        <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs bg-slate-50/50">
                          {workers.map((w) => (
                            <div key={w.id} className={`p-2 flex justify-between items-center ${w.isPaidToday ? 'opacity-50 bg-slate-100/60' : ''}`}>
                              <div>
                                <span className="font-bold text-slate-800">{w.name}</span>
                                {w.isPaidToday ? (
                                  <span className="text-[10px] text-emerald-700 font-bold block">
                                    ✓ Already Paid Today (₹{w.todayPayment?.amount}) — Skipped
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    {w.upiId ? `UPI: ${w.upiId}` : w.bankAccountNumber ? `A/C ••••${w.bankAccountNumber.slice(-4)}` : 'Bank Transfer'}
                                  </span>
                                )}
                              </div>
                              <span className={`font-mono font-bold ${w.isPaidToday ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                                {INR(useCustomBatchAmount && customBatchAmount ? Number(customBatchAmount) : w.wageRate)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* VIEW 2: SINGLE WORKER */
                <div className="space-y-4">
                  {unpaidWorkers.length === 0 ? (
                    <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-xl text-center space-y-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[32px]">task_alt</span>
                      <h3 className="font-extrabold text-emerald-900 text-sm">All Workers Already Paid Today!</h3>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        Every active worker ({workers.length} personnel) has already received their wage payout today.
                        Duplicate disbursements to the same person on the same day are strictly prohibited.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                          Select Recipient Worker
                        </label>
                        <select
                          value={newPaymentWorkerId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setNewPaymentWorkerId(id);
                            const w = workers.find((item) => item.id === id);
                            if (w) setNewPaymentAmount(String(w.wageRate));
                          }}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {unpaidWorkers.length > 0 && (
                            <optgroup label="⚡ Unpaid Workers (Eligible for Payment)">
                              {unpaidWorkers.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name} — Rate: ₹{w.wageRate}/d {w.upiId ? `(UPI: ${w.upiId})` : w.bankAccountNumber ? `(A/C: ••••${w.bankAccountNumber.slice(-4)})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {paidTodayWorkers.length > 0 && (
                            <optgroup label="🔒 Already Paid Today (Payment Blocked)">
                              {paidTodayWorkers.map((w) => (
                                <option key={w.id} value={w.id} disabled>
                                  ✓ [ALREADY PAID ₹{w.todayPayment?.amount}] {w.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* DUPLICATE PAYMENT WARNING IN SINGLE WORKER MODE */}
                      {selectedWorker?.isPaidToday && (
                        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900">
                            <span className="material-symbols-outlined text-[16px] text-amber-600">block</span>
                            <span>Duplicate Payment Prevented</span>
                          </div>
                          <p className="text-amber-800 leading-snug">
                            <strong>{selectedWorker.name}</strong> has already received a payment of{' '}
                            <strong>₹{selectedWorker.todayPayment?.amount}</strong> today (Ref:{' '}
                            <span className="font-mono">{selectedWorker.todayPayment?.razorpayPayoutId || 'settled'}</span>).
                            To protect your account, duplicate payments to the same person on the same day are blocked.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                            Amount (INR ₹)
                          </label>
                          <input
                            type="number"
                            min="1"
                            disabled={selectedWorker?.isPaidToday}
                            value={newPaymentAmount}
                            onChange={(e) => setNewPaymentAmount(e.target.value)}
                            placeholder="e.g. 850"
                            className="w-full px-3 py-2 text-sm rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono font-bold disabled:bg-slate-100 disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                            Classification
                          </label>
                          <select
                            value={newPaymentType}
                            disabled={selectedWorker?.isPaidToday}
                            onChange={(e) => setNewPaymentType(e.target.value as any)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:opacity-60"
                          >
                            <option value="DAILY">Daily Wage</option>
                            <option value="MONTHLY">Monthly Salary</option>
                            <option value="BONUS">Bonus / Overtime</option>
                          </select>
                        </div>
                      </div>

                      {(() => {
                        const w = selectedWorker;
                        if (!w) return null;
                        const hasAccount = !!(w.upiId || w.bankAccountNumber);
                        return (
                          <div className={`p-3 rounded-xl text-xs space-y-1.5 border ${hasAccount ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50 border-emerald-300'}`}>
                            <div className="flex justify-between items-center">
                              <p className="font-bold text-slate-800">Destination Account / Method:</p>
                              {!hasAccount && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 border border-emerald-400">
                                  Cash in Hand Ready
                                </span>
                              )}
                            </div>
                            <p className="text-slate-700 font-mono">
                              {w.upiId
                                ? `Verified UPI ID: ${w.upiId}`
                                : w.bankAccountNumber
                                  ? `Bank A/C: ${w.bankAccountNumber} (${w.ifscCode || 'IFSC'})`
                                  : '💵 No online bank account configured — Use "Cash in Hand" option below'}
                            </p>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* Execution Options */}
              <div className="pt-2 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Choose Execution Method:
                </p>

                {paymentScope === 'SINGLE' && selectedWorker?.isPaidToday ? (
                  <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-1.5 text-red-800 font-extrabold text-xs">
                      <span className="material-symbols-outlined text-[18px]">lock</span>
                      <span>DUPLICATE PAYMENT BLOCKED</span>
                    </div>
                    <p className="text-xs text-red-700">
                      <strong>{selectedWorker.name}</strong> was already paid <strong>₹{selectedWorker.todayPayment?.amount}</strong> today.
                      Duplicate payouts to the same person on the same calendar day are strictly disallowed.
                    </p>
                  </div>
                ) : (paymentScope === 'ALL' || paymentScope === 'SINGLE') && unpaidWorkers.length === 0 ? (
                  <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-center text-xs font-bold text-slate-600">
                    All workers have already been paid today. No pending disbursements.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* OPTION 1: CASH IN HAND */}
                    <button
                      onClick={handleCashPayment}
                      disabled={
                        isSubmittingPayment ||
                        (paymentScope === 'SINGLE' && selectedWorker?.isPaidToday) ||
                        (paymentScope === 'ALL' && unpaidWorkers.length === 0)
                      }
                      className="p-3.5 bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-950 text-white rounded-xl text-left hover:opacity-95 transition border border-emerald-500/70 shadow-md disabled:opacity-40 disabled:cursor-not-allowed group sm:col-span-2 cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                          <span className="material-symbols-outlined text-[18px]">payments</span>
                          <span>
                            {paymentScope === 'ALL' ? 'Disburse Cash in Hand to All Unpaid' : 'Pay Cash in Hand (Physical Disbursement)'}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                          No Bank A/C Required · Instant Voucher
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-100/90 leading-snug">
                        {paymentScope === 'ALL'
                          ? `Record physical cash wage handover of ${INR(calculateTotalBatchAmount())} for ${unpaidWorkers.length} workers without requiring bank or UPI accounts.`
                          : `Hand over physical cash to ${selectedWorker?.name || 'worker'}. Directly generates an official printable cash voucher receipt.`}
                      </p>
                    </button>

                    {/* OPTION 2: RAZORPAYX INSTANT */}
                    <button
                      onClick={handleInstantRazorpayTransfer}
                      disabled={
                        isSubmittingPayment ||
                        (paymentScope === 'SINGLE' && selectedWorker?.isPaidToday) ||
                        (paymentScope === 'ALL' && unpaidWorkers.length === 0)
                      }
                      className="p-3.5 bg-gradient-to-br from-[#0d1c32] to-[#1c3a6b] text-white rounded-xl text-left hover:opacity-95 transition border border-blue-900 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs mb-1">
                        <span className="material-symbols-outlined text-[16px]">bolt</span>
                        <span>
                          {paymentScope === 'ALL' ? 'Instant Payout to Unpaid' : 'RazorpayX Instant'}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-100/80 leading-snug">
                        {paymentScope === 'ALL'
                          ? `Directly credit remaining ${unpaidWorkers.length} unpaid workers via UPI / Bank IMPS.`
                          : "Disburse directly to worker's UPI or Bank account via IMPS."}
                      </p>
                    </button>

                    {/* OPTION 3: RAZORPAY CHECKOUT */}
                    <button
                      onClick={handleRazorpayCheckout}
                      disabled={
                        isSubmittingPayment ||
                        (paymentScope === 'SINGLE' && selectedWorker?.isPaidToday) ||
                        (paymentScope === 'ALL' && unpaidWorkers.length === 0)
                      }
                      className="p-3.5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl text-left hover:opacity-95 transition border border-slate-700 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs mb-1">
                        <span className="material-symbols-outlined text-[16px]">credit_card</span>
                        <span>
                          {paymentScope === 'ALL' ? 'Batch Razorpay Checkout' : 'Razorpay Checkout'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300/80 leading-snug">
                        {paymentScope === 'ALL'
                          ? `Pay consolidated ${INR(calculateTotalBatchAmount())} for unpaid personnel.`
                          : 'Open payment popup (Card, UPI QR, NetBanking, GPay).'}
                      </p>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-outline-variant flex justify-end">
              <button
                onClick={() => setIsNewPaymentModalOpen(false)}
                disabled={isSubmittingPayment}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-outline-variant bg-white text-on-surface hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Interactive Simulated Razorpay Checkout Gateway Modal */}
      {simulatedCheckoutOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-700 overflow-hidden">
            {/* Top Razorpay Header */}
            <div className="bg-[#0c2340] text-white p-5 flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 flex items-center justify-center border border-blue-400/40">
                  <span className="text-cyan-400 font-black text-lg italic">R</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black tracking-wide text-white text-base">Razorpay</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded">
                      Sandbox
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 font-medium">SiteTrack Construction Platform</p>
                </div>
              </div>
              <button
                onClick={() => setSimulatedCheckoutOrder(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Amount Banner */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Recipient Scope</span>
                <p className="font-bold text-slate-900 text-sm">{simulatedCheckoutOrder.workerName}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  {simulatedCheckoutOrder.isBulk ? 'Total Batch Amount' : 'Amount'}
                </span>
                <h3 className="text-xl font-black text-slate-900">{INR(simulatedCheckoutOrder.amount)}</h3>
              </div>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
                {[
                  { id: 'UPI', label: 'UPI / QR', icon: 'qr_code_2' },
                  { id: 'CARD', label: 'Cards', icon: 'credit_card' },
                  { id: 'NETBANKING', label: 'NetBanking', icon: 'account_balance' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setCheckoutPaymentTab(tab.id as any)}
                    className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition ${
                      checkoutPaymentTab === tab.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-300'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab 1: UPI */}
              {checkoutPaymentTab === 'UPI' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                        UPI
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-800">Scan & Pay via any UPI App</p>
                        <p className="text-[11px] text-slate-500">Google Pay, PhonePe, Paytm, CRED</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-blue-700 text-[22px]">qr_code_scanner</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center font-mono">
                    <span className="text-slate-500">Virtual Payment Address:</span>
                    <span className="font-bold text-slate-800">sitetrack.payroll@okhdfcbank</span>
                  </div>
                </div>
              )}

              {/* Tab 2: Test Cards */}
              {checkoutPaymentTab === 'CARD' && (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-xl text-xs font-mono shadow">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mb-2">
                      <span>RAZORPAY TEST CARD</span>
                      <span className="font-bold text-white">VISA</span>
                    </div>
                    <p className="text-base font-bold tracking-widest text-slate-100">4111 2222 3333 4444</p>
                    <div className="flex justify-between text-[11px] text-slate-300 mt-3">
                      <span>EXP: 12/28</span>
                      <span>CVV: 123</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 text-center font-medium">
                    Test Mode: Simulated Visa credentials pre-filled automatically.
                  </p>
                </div>
              )}

              {/* Tab 3: NetBanking */}
              {checkoutPaymentTab === 'NETBANKING' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-600">Select Bank</label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="State Bank of India">State Bank of India (SBI)</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="Axis Bank">Axis Bank</option>
                    <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 space-y-2">
                <button
                  onClick={handleSimulatedCheckoutSuccess}
                  disabled={isSubmittingPayment}
                  className="w-full py-3 bg-[#0c2340] hover:bg-[#153a6b] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingPayment ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                      <span>Verifying Payment...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-cyan-400">lock</span>
                      <span>
                        Pay {INR(simulatedCheckoutOrder.amount)} (Simulate Success)
                      </span>
                    </>
                  )}
                </button>

                <div className="flex justify-between items-center text-xs pt-1">
                  <button
                    onClick={() => {
                      showToast('Payment rejected in simulation test.', 'error');
                      setSimulatedCheckoutOrder(null);
                    }}
                    className="text-red-600 hover:text-red-700 font-bold"
                  >
                    Simulate Failure
                  </button>
                  <button
                    onClick={() => setSimulatedCheckoutOrder(null)}
                    className="text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1">
                <span className="material-symbols-outlined text-[12px]">shield</span>
                <span>Secured by Razorpay Standard 256-bit Encryption</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Digital Payment Receipt / Voucher Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-outline-variant overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#0d1c32] text-white p-5 flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  selectedVoucher.razorpayPayoutId?.startsWith('CASH')
                    ? 'bg-emerald-400/20 border-emerald-400/40 text-emerald-300'
                    : 'bg-cyan-400/20 border-cyan-400/40 text-cyan-300'
                }`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {selectedVoucher.razorpayPayoutId?.startsWith('CASH') ? 'payments' : 'verified'}
                  </span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    {selectedVoucher.razorpayPayoutId?.startsWith('CASH') ? 'Official Cash Payment Voucher' : 'Payment Voucher'}
                  </h3>
                  <p className="text-[11px] text-cyan-200/80 font-mono">
                    {selectedVoucher.razorpayPayoutId?.startsWith('CASH')
                      ? 'Physical Cash Disbursement Record'
                      : 'SiteTrack AI × Razorpay Verified Settlement'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Disbursed Amount</span>
                  <h2 className="text-2xl font-black text-emerald-700">{INR(selectedVoucher.amount)}</h2>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm">
                    <span className="material-symbols-outlined text-[12px]">check</span>
                    {selectedVoucher.razorpayPayoutId?.startsWith('CASH') ? 'PAID IN CASH' : selectedVoucher.status}
                  </span>
                  <p className="text-[10px] text-emerald-800 mt-1 font-mono">
                    {new Date(selectedVoucher.paymentDate).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="border border-outline-variant rounded-xl divide-y divide-outline-variant text-xs">
                <div className="p-3 flex justify-between bg-surface-container-low/40">
                  <span className="text-on-surface-variant font-medium">Beneficiary Worker</span>
                  <span className="font-bold text-on-surface">{selectedVoucher.worker.name}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-on-surface-variant font-medium">
                    {selectedVoucher.razorpayPayoutId?.startsWith('CASH') ? 'Cash Voucher Number' : 'Razorpay Reference ID'}
                  </span>
                  <span className="font-mono font-bold text-emerald-700 select-all">
                    {selectedVoucher.razorpayPayoutId || 'sim_payout_auto'}
                  </span>
                </div>
                <div className="p-3 flex justify-between bg-surface-container-low/40">
                  <span className="text-on-surface-variant font-medium">Disbursement Mode</span>
                  <span className="font-bold text-on-surface flex items-center gap-1">
                    {selectedVoucher.razorpayPayoutId?.startsWith('CASH') ? (
                      <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">payments</span>
                        Physical Cash Handover
                      </span>
                    ) : selectedVoucher.worker.upiId ? (
                      `UPI: ${selectedVoucher.worker.upiId}`
                    ) : selectedVoucher.worker.bankAccountNumber ? (
                      `A/C ••••${selectedVoucher.worker.bankAccountNumber.slice(-4)}`
                    ) : (
                      'Bank IMPS'
                    )}
                  </span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-on-surface-variant font-medium">Payment Classification</span>
                  <span className="font-bold uppercase text-on-surface">{selectedVoucher.type}</span>
                </div>
                <div className="p-3 flex justify-between bg-surface-container-low/40">
                  <span className="text-on-surface-variant font-medium">Verification Status</span>
                  <span className="font-bold text-emerald-700">
                    {selectedVoucher.razorpayPayoutId?.startsWith('CASH')
                      ? 'Verified on Site by Authorized Supervisor'
                      : 'RazorpayX Direct API Gateway'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-outline-variant flex justify-end gap-2">
              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-outline-variant bg-white text-on-surface hover:bg-slate-100"
              >
                Close
              </button>
              <button
                onClick={() => handleDownloadPayslip(selectedVoucher)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 shadow-sm transition"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download PDF Payslip
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 flex items-center gap-1 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
