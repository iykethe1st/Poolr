import type {
  Role,
  UserStatus,
  KycStatus,
  GroupStatus,
  Frequency,
  Currency,
  MemberStatus,
  CycleStatus,
  ContribStatus,
  PayoutStatus,
  PenaltyStatus,
  PenaltyReason,
  TxDirection,
  TxType,
  NotifChannel,
  NotifStatus,
} from './enums';

// Monetary amounts are serialised as numbers in JSON responses.
// Dates are ISO-8601 strings.

export type UserDto = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

export type KycProfileDto = {
  id: string;
  userId: string;
  bvn?: string;
  nin?: string;
  selfieUrl: string | null;
  idDocUrl: string | null;
  kycStatus: KycStatus;
  kycAttempts: number;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GroupDto = {
  id: string;
  adminId: string;
  name: string;
  contributionAmount: number;
  currency: Currency;
  frequency: Frequency;
  maxMembers: number;
  status: GroupStatus;
  startDate: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
};

export type GroupMemberDto = {
  id: string;
  groupId: string;
  userId: string;
  rotationPosition: number;
  memberStatus: MemberStatus;
  joinedAt: string;
  user?: UserDto;
};

export type CycleDto = {
  id: string;
  groupId: string;
  recipientId: string;
  cycleNumber: number;
  dueDate: string;
  payoutDate: string | null;
  status: CycleStatus;
  createdAt: string;
  updatedAt: string;
  recipient?: UserDto;
};

export type ContributionDto = {
  id: string;
  cycleId: string;
  memberId: string;
  amount: number;
  status: ContribStatus;
  paystackRef: string | null;
  paidAt: string | null;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PayoutDto = {
  id: string;
  cycleId: string;
  recipientId: string;
  amount: number;
  status: PayoutStatus;
  paystackTransferCode: string | null;
  initiatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PenaltyDto = {
  id: string;
  contributionId: string;
  memberId: string;
  penaltyAmount: number;
  reason: PenaltyReason;
  status: PenaltyStatus;
  appliedAt: string | null;
  createdAt: string;
};

export type WalletDto = {
  id: string;
  userId: string;
  balance: number;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
};

export type WalletTransactionDto = {
  id: string;
  walletId: string;
  amount: number;
  type: TxType;
  direction: TxDirection;
  reference: string;
  createdAt: string;
};

export type NotificationDto = {
  id: string;
  userId: string;
  title: string;
  body: string;
  channel: NotifChannel;
  status: NotifStatus;
  sentAt: string | null;
  createdAt: string;
};
