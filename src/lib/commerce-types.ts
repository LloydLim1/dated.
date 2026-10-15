import type { Place } from "./types";
export type Rules = {
  rewardCoins: number;
  dailyReviews: number;
  rewardsPaused: boolean;
  spendingPaused: boolean;
  adsPaused: boolean;
  checkoutPaused: boolean;
  monthlyPrice: number;
};
export type Offer = {
  id: string;
  org_id: string;
  place_id: string;
  title: string;
  description: string;
  coin_cost: number;
  benefit: string;
  min_spend: number;
  stock: number;
  starts_at: number;
  ends_at: number;
  valid_days: number;
  terms: string;
  funding: string;
  status: string;
  reason?: string;
  place: Place;
  available: boolean;
};
export type Voucher = {
  id: string;
  code?: string;
  status: string;
  created_at: number;
  expires_at: number;
  redeemed_at?: number;
  snapshot: {
    title: string;
    benefit: string;
    terms: string;
    coinCost: number;
    minSpend: number;
    place: Place;
    funding: string;
  };
};
export type Reward = {
  id: string;
  review_id: string;
  amount: number;
  status: string;
  reason: string;
  created_at: number;
  username?: string;
};
export type Invitation = {
  id: string;
  name: string;
  role: string;
  branch_id: string;
};
export type WalletData = {
  balance: number;
  pending: number;
  restricted: string | null;
  entries: {
    id: string;
    amount: number;
    kind: string;
    note: string;
    created_at: number;
  }[];
  claims: Reward[];
  vouchers: Voucher[];
  offers: Offer[];
  invitations: Invitation[];
  rules: Rules;
};
export type Claim = {
  id: string;
  org_id: string;
  place_id: string;
  contact: string;
  evidence: string;
  status: string;
  reason?: string;
  created_at: number;
  organization?: string;
  place?: Place;
};
export type Invoice = {
  id: string;
  org_id: string;
  amount: number;
  status: string;
  reference?: string;
  created_at: number;
  organization?: string;
};
export type Campaign = {
  id: string;
  org_id: string;
  place_id: string;
  title: string;
  body: string;
  status: string;
  reason?: string;
  starts_at: number;
  ends_at: number;
  place?: Place;
};
export type BusinessOrg = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  branch_id: string | null;
  subscription: {
    status: string;
    period_end: number;
    cancel_at_end: number;
  } | null;
  branches: Place[];
  claims: Claim[];
  invoices: Invoice[];
  campaigns: Campaign[];
  offers: Offer[];
  members: {
    user_id: string;
    name: string;
    username: string;
    role: string;
    branch_id: string | null;
  }[];
  invites: { id: string; username: string; role: string; status: string }[];
};
export type BusinessData = {
  organizations: BusinessOrg[];
  rules: Rules;
  billingMode: string;
};
export type Report = {
  place: Place;
  start: number;
  end: number;
  generatedAt: number;
  version: number;
  sampleSize: number;
  previous: {
    start: number;
    end: number;
    sampleSize: number;
    criteria: { name: string; average: number; count: number }[];
  };
  criteria: { name: string; average: number; count: number }[];
  reviews: { id: string; title: string; body: string; visitDate: string }[];
  themes: {
    term: string;
    reviews: { id: string; title: string; body: string }[];
  }[];
  averageSpending: number | null;
  contextSuppressed: boolean;
  discovery: { views: number; saves: number; directions: number };
  advertising: { impressions: number; clicks: number; ctr: number | null };
  vouchers: {
    issued: number;
    redeemed: number;
    redemptionRate: number | null;
    periodRedemptions: number;
  };
};
export type OperationsData = {
  restrictions: {
    user_id: string;
    username: string;
    reason: string;
    balance: number;
  }[];
  vouchers: Voucher[];
  claims: Claim[];
  invoices: Invoice[];
  offers: Offer[];
  campaigns: Campaign[];
  rewards: Reward[];
  appeals: { id: string; claim_id: string; reason: string; status: string }[];
  audit: {
    id: string;
    action: string;
    entity_id: string;
    reason: string;
    created_at: number;
  }[];
  rules: Rules;
  totals: { coins: number; outstandingVouchers: number };
};
export type Sponsored = {
  deliveryId: string;
  campaignId: string;
  placeId: string;
  title: string;
  body: string;
  label: string;
};
