// Mirrors Prisma enums exactly — no import from @prisma/client to avoid circular deps.
// Keep in sync with packages/database/prisma/schema.prisma.

export const Role = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const KycStatus = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const GroupStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type GroupStatus = (typeof GroupStatus)[keyof typeof GroupStatus];

export const Frequency = {
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
export type Frequency = (typeof Frequency)[keyof typeof Frequency];

export const Currency = { NGN: 'NGN' } as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const MemberStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  LEFT: 'LEFT',
  REMOVED: 'REMOVED',
} as const;
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

export const CycleStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
} as const;
export type CycleStatus = (typeof CycleStatus)[keyof typeof CycleStatus];

export const ContribStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  WAIVED: 'WAIVED',
} as const;
export type ContribStatus = (typeof ContribStatus)[keyof typeof ContribStatus];

export const PayoutStatus = {
  PENDING: 'PENDING',
  INITIATED: 'INITIATED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

export const PenaltyStatus = {
  PENDING: 'PENDING',
  APPLIED: 'APPLIED',
  WAIVED: 'WAIVED',
} as const;
export type PenaltyStatus = (typeof PenaltyStatus)[keyof typeof PenaltyStatus];

export const PenaltyReason = {
  LATE_PAYMENT: 'LATE_PAYMENT',
  MISSED_PAYMENT: 'MISSED_PAYMENT',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
} as const;
export type PenaltyReason = (typeof PenaltyReason)[keyof typeof PenaltyReason];

export const TxDirection = { CREDIT: 'CREDIT', DEBIT: 'DEBIT' } as const;
export type TxDirection = (typeof TxDirection)[keyof typeof TxDirection];

export const TxType = {
  CONTRIBUTION: 'CONTRIBUTION',
  PAYOUT: 'PAYOUT',
  PENALTY: 'PENALTY',
  TOPUP: 'TOPUP',
  WITHDRAWAL: 'WITHDRAWAL',
  REVERSAL: 'REVERSAL',
} as const;
export type TxType = (typeof TxType)[keyof typeof TxType];

export const NotifChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  IN_APP: 'IN_APP',
} as const;
export type NotifChannel = (typeof NotifChannel)[keyof typeof NotifChannel];

export const NotifStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  READ: 'READ',
} as const;
export type NotifStatus = (typeof NotifStatus)[keyof typeof NotifStatus];
