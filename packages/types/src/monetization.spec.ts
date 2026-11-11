import { describe, it, expect } from 'vitest';
import { PLATFORM_REVENUE_SPLIT, type Subscription, type CreatorPayoutRecord } from './monetization.js';

describe('Monetization Types & Contracts', () => {
  it('defines the standard platform revenue split accurately', () => {
    expect(PLATFORM_REVENUE_SPLIT.CREATOR_PERCENTAGE).toBe(0.85);
    expect(PLATFORM_REVENUE_SPLIT.PLATFORM_FEE_PERCENTAGE).toBe(0.15);
    expect(PLATFORM_REVENUE_SPLIT.CREATOR_PERCENTAGE + PLATFORM_REVENUE_SPLIT.PLATFORM_FEE_PERCENTAGE).toBe(1.0);
  });

  it('validates subscription model shape and typing constraints', () => {
    const sub: Subscription = {
      id: 'sub-123',
      user_id: 'usr-456',
      provider: 'STRIPE',
      provider_customer_id: 'cus_xyz',
      provider_subscription_id: 'sub_xyz',
      status: 'ACTIVE',
      tier: 'PRO_LEARNER',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancel_at_period_end: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(sub.status).toBe('ACTIVE');
    expect(sub.provider).toBe('STRIPE');
    expect(sub.cancel_at_period_end).toBe(false);
  });

  it('validates creator payout record structure', () => {
    const payout: CreatorPayoutRecord = {
      id: 'pay-001',
      creator_id: 'creator-999',
      amount_cents: 8500,
      currency: 'USD',
      provider_transfer_id: 'tr_123',
      status: 'PAID',
      created_at: new Date().toISOString(),
    };

    expect(payout.amount_cents).toBe(8500);
    expect(payout.currency).toBe('USD');
    expect(payout.status).toBe('PAID');
  });
});
