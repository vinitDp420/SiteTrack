import { NextResponse } from 'next/server';
import { processDailyPayoutForWorker } from '@/lib/payout-service';

/**
 * Process daily payout for a specific worker.
 * Called automatically on attendance check-out, or manually by admin or worker.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workerId } = body;

    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required.' }, { status: 400 });
    }

    const result = await processDailyPayoutForWorker(workerId);

    if (!result.success && !result.payment) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
