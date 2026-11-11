export type PaymentProvider = 'STRIPE' | 'LEMON_SQUEEZY' | 'RAZORPAY';

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export type SubscriptionTier = 'PRO_LEARNER' | 'CREATOR_PRO' | 'ENTERPRISE';

export interface Subscription {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  provider_customer_id: string;
  provider_subscription_id: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier | string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';

export interface CreatorPayoutRecord {
  id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  provider_transfer_id: string | null;
  status: PayoutStatus | string;
  created_at: string;
}

export interface CreatorEarningsSummary {
  creator_id: string;
  currency: string;
  total_gross_cents: number;
  total_platform_fee_cents: number;
  total_net_cents: number;
  available_balance_cents: number;
  pending_payout_cents: number;
  lifetime_paid_cents: number;
  payout_records: CreatorPayoutRecord[];
}

export interface CheckoutSessionRequest {
  tier: SubscriptionTier;
  success_url: string;
  cancel_url: string;
}

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
  provider: PaymentProvider;
}

export interface PaymentWebhookPayload {
  event: 'subscription.created' | 'subscription.updated' | 'subscription.canceled' | 'payout.processed' | 'payout.failed';
  provider: PaymentProvider;
  provider_subscription_id?: string;
  provider_customer_id?: string;
  user_id?: string;
  creator_id?: string;
  status?: SubscriptionStatus | PayoutStatus;
  tier?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  amount_cents?: number;
  currency?: string;
  provider_transfer_id?: string;
  timestamp: string;
}

/**
 * Standard platform revenue split ratios.
 * 85% to Creator, 15% platform infrastructure fee.
 */
export const PLATFORM_REVENUE_SPLIT = {
  CREATOR_PERCENTAGE: 0.85,
  PLATFORM_FEE_PERCENTAGE: 0.15,
} as const;
