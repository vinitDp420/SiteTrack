import { describe, it, expect } from '@jest/globals';
import { processDailyPayoutForWorker } from '@/lib/payout-service';

describe('Payout Service', () => {
  it('should return failure for non-existent worker', async () => {
    const result = await processDailyPayoutForWorker('non-existent-worker-id');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Worker not found');
  });
});
