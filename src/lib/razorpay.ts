/**
 * Razorpay Payouts Service Layer
 *
 * In simulation mode (RAZORPAY_SIMULATION_MODE=true or no keys):
 *   - Returns fake success responses after a short delay
 *   - No real money moves
 *
 * In live mode:
 *   - Calls Razorpay Payouts API for real bank transfers
 */

interface PayoutRequest {
  workerName: string;
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  upiId?: string | null;
  amount: number;
  purpose: string; // "salary" | "payout"
  narration: string;
}

interface PayoutResult {
  success: boolean;
  payoutId: string;
  status: string;
  failureReason?: string;
}

const isSimulationMode = (): boolean => {
  const mode = process.env.RAZORPAY_SIMULATION_MODE;
  const keyId = process.env.RAZORPAY_KEY_ID;
  // Simulation if explicitly set OR if no real keys are configured
  return mode === 'true' || !keyId || keyId === '' || keyId.startsWith('rzp_test_');
};

/**
 * Simulate a payout — returns a fake success after a short delay.
 */
async function simulatePayout(req: PayoutRequest): Promise<PayoutResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const fakeId = `sim_payout_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // 95% success rate in simulation to test failure handling
  const isSuccess = Math.random() < 0.95;

  if (isSuccess) {
    return {
      success: true,
      payoutId: fakeId,
      status: 'processed',
    };
  } else {
    return {
      success: false,
      payoutId: fakeId,
      status: 'failed',
      failureReason: 'Simulated failure: Insufficient funds in payout account',
    };
  }
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
      return { success: false, payoutId: '', status: 'failed', failureReason: `Contact creation failed: ${JSON.stringify(contact)}` };
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
      return { success: false, payoutId: '', status: 'failed', failureReason: 'No bank account or UPI ID configured for this worker.' };
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
      return { success: false, payoutId: '', status: 'failed', failureReason: `Fund account creation failed: ${JSON.stringify(fundAccount)}` };
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
        mode: req.bankAccountNumber ? 'IMPS' : 'UPI',
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
      };
    } else {
      return { success: false, payoutId: '', status: 'failed', failureReason: `Payout creation failed: ${JSON.stringify(payout)}` };
    }
  } catch (error: any) {
    return { success: false, payoutId: '', status: 'failed', failureReason: error.message || 'Unknown Razorpay error' };
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

export { isSimulationMode };
