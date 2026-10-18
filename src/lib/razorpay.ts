/**
 * Razorpay & RazorpayX Payouts Service Layer
 *
 * In simulation mode (RAZORPAY_SIMULATION_MODE=true or no keys):
 *   - Returns deterministic simulated success responses after a short delay
 *   - Generates realistic transaction references (payout_sim_..., order_sim_..., pay_sim_...)
 *   - No real money moves, ideal for testing & hackathon evaluation
 *
 * In live mode (configured with RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env):
 *   - Calls Razorpay Payouts API for real UPI / IMPS bank transfers
 *   - Creates standard Razorpay orders for Checkout gateway modal
 */

import crypto from 'crypto';

export interface PayoutRequest {
  workerName: string;
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  upiId?: string | null;
  amount: number;
  purpose: string; // "salary" | "payout"
  narration: string;
}

export interface PayoutResult {
  success: boolean;
  payoutId: string;
  status: string;
  failureReason?: string;
  transferMode?: 'UPI' | 'IMPS';
  destination?: string;
}

export interface CreateOrderRequest {
  amount: number; // in INR (will be converted to paise)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  success: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  isSimulation?: boolean;
  error?: string;
}

export const isSimulationMode = (): boolean => {
  const mode = process.env.RAZORPAY_SIMULATION_MODE;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // Explicit simulation flag takes precedence
  if (mode === 'true') return true;
  // If no credentials configured, default to safe simulation
  if (!keyId || !keySecret || keyId === '') return true;
  return false;
};

/**
 * Simulate a payout — returns a fake success after a short delay.
 */
async function simulatePayout(req: PayoutRequest): Promise<PayoutResult> {
  await new Promise((resolve) => setTimeout(resolve, 350));

  const fakeId = `pout_sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const transferMode = req.upiId ? 'UPI' : 'IMPS';
  const destination = req.upiId || (req.bankAccountNumber ? `A/C ••••${req.bankAccountNumber.slice(-4)}` : 'Bank Transfer');

  return {
    success: true,
    payoutId: fakeId,
    status: 'processed',
    transferMode,
    destination,
  };
}

/**
 * Live Razorpay Payout via REST API.
 * Requires RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_ACCOUNT_NUMBER in .env
 */
async function livePayout(req: PayoutRequest): Promise<PayoutResult> {
  const keyId = process.env.RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const accountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER!;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const transferMode = req.upiId ? 'UPI' : 'IMPS';
  const destination = req.upiId || (req.bankAccountNumber ? `A/C ••••${req.bankAccountNumber.slice(-4)}` : 'Bank Transfer');

  try {
    // Step 1: Create a Contact
    const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        name: req.workerName,
        type: 'employee',
      }),
    });
    const contact = await contactRes.json();
    if (!contact.id) {
      return { 
        success: false, 
        payoutId: '', 
        status: 'failed', 
        failureReason: `Contact creation failed: ${JSON.stringify(contact)}`,
        transferMode,
        destination 
      };
    }

    // Step 2: Create a Fund Account
    const fundAccountPayload: any = {
      contact_id: contact.id,
      account_type: req.bankAccountNumber ? 'bank_account' : 'vpa',
    };

    if (req.bankAccountNumber && req.ifscCode) {
      fundAccountPayload.bank_account = {
        name: req.workerName,
        ifsc: req.ifscCode,
        account_number: req.bankAccountNumber,
      };
    } else if (req.upiId) {
      fundAccountPayload.vpa = { address: req.upiId };
    } else {
      return { 
        success: false, 
        payoutId: '', 
        status: 'failed', 
        failureReason: 'No bank account or UPI ID configured for this worker.',
        transferMode,
        destination 
      };
    }

    const fundRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(fundAccountPayload),
    });
    const fundAccount = await fundRes.json();
    if (!fundAccount.id) {
      return { 
        success: false, 
        payoutId: '', 
        status: 'failed', 
        failureReason: `Fund account creation failed: ${JSON.stringify(fundAccount)}`,
        transferMode,
        destination 
      };
    }

    // Step 3: Create the Payout
    const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        account_number: accountNumber,
        fund_account_id: fundAccount.id,
        amount: Math.round(req.amount * 100), // Razorpay uses paise
        currency: 'INR',
        mode: transferMode,
        purpose: req.purpose,
        narration: req.narration,
        queue_if_low_balance: true,
      }),
    });
    const payout = await payoutRes.json();

    if (payout.id) {
      return {
        success: payout.status !== 'failed' && payout.status !== 'rejected',
        payoutId: payout.id,
        status: payout.status,
        failureReason: payout.failure_reason || undefined,
        transferMode,
        destination,
      };
    } else {
      return { 
        success: false, 
        payoutId: '', 
        status: 'failed', 
        failureReason: `Payout creation failed: ${JSON.stringify(payout)}`,
        transferMode,
        destination 
      };
    }
  } catch (error: any) {
    return { 
      success: false, 
      payoutId: '', 
      status: 'failed', 
      failureReason: error.message || 'Unknown Razorpay error',
      transferMode,
      destination 
    };
  }
}

/**
 * Main payout function — automatically selects simulation or live mode.
 */
export async function processPayout(req: PayoutRequest): Promise<PayoutResult> {
  if (isSimulationMode()) {
    console.log(`[Razorpay SIMULATION] Payout ₹${req.amount} to ${req.workerName}`);
    return simulatePayout(req);
  } else {
    console.log(`[Razorpay LIVE] Payout ₹${req.amount} to ${req.workerName}`);
    return livePayout(req);
  }
}

/**
 * Create a standard Razorpay Order for Checkout Modal
 */
export async function createRazorpayOrder(req: CreateOrderRequest): Promise<CreateOrderResult> {
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_sitetrack_key';
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const amountPaise = Math.round(req.amount * 100);

  if (isSimulationMode() || !process.env.RAZORPAY_KEY_ID || !keySecret) {
    const fakeOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      orderId: fakeOrderId,
      amount: amountPaise,
      currency: req.currency || 'INR',
      keyId: keyId || '',
      isSimulation: true,
    };
  }

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: req.currency || 'INR',
        receipt: req.receipt || `rcpt_${Date.now()}`,
        notes: req.notes || {},
      }),
    });
    const data = await res.json();
    if (data.id) {
      return {
        success: true,
        orderId: data.id,
        amount: data.amount,
        currency: data.currency,
        keyId,
      };
    } else {
      return {
        success: false,
        orderId: '',
        amount: amountPaise,
        currency: 'INR',
        keyId,
        error: data.error?.description || 'Failed to create Razorpay order',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      orderId: '',
      amount: amountPaise,
      currency: 'INR',
      keyId,
      error: error.message || 'Razorpay order creation network error',
    };
  }
}

/**
 * Verify Razorpay Checkout Signature
 */
export function verifyRazorpayPayment(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (isSimulationMode() || params.orderId.startsWith('order_sim_') || params.paymentId.startsWith('pay_sim_')) {
    return true;
  }
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return true;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');
    return expectedSignature === params.signature;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

/**
 * Client-facing Razorpay configuration
 */
export function getRazorpayClientConfig() {
  const isSim = isSimulationMode();
  return {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_sitetrack_simulation',
    isSimulation: isSim,
    companyName: 'SiteTrack AI Autonomous Payroll',
    themeColor: '#0d1c32',
  };
}
