export const NOTIFICATION_EVENTS = {
  USER_WELCOME: 'notification.user.welcome',
  KYC_APPROVED: 'notification.kyc.approved',
  KYC_REJECTED: 'notification.kyc.rejected',
  GROUP_INVITED: 'notification.group.invited',
  GROUP_STARTED: 'notification.group.started',
  CONTRIBUTION_REMINDER: 'notification.contribution.reminder',
  CONTRIBUTION_RECEIVED: 'notification.contribution.received',
  PAYOUT_RECEIVED: 'notification.payout.received',
  PENALTY_APPLIED: 'notification.penalty.applied',
  PAYOUT_FAILED_ADMIN: 'notification.payout.failed_admin',
} as const;

export type NotificationEventKey = keyof typeof NOTIFICATION_EVENTS;

export class UserWelcomeEvent {
  userId!: string;
  email!: string;
  fullName!: string;
}

export class KycApprovedEvent {
  userId!: string;
  email!: string;
  fullName!: string;
}

export class KycRejectedEvent {
  userId!: string;
  email!: string;
  fullName!: string;
}

export class GroupInvitedEvent {
  userId!: string;
  email!: string;
  fullName!: string;
  groupName!: string;
  adminName!: string;
  inviteToken!: string;
}

export class GroupStartedEvent {
  memberUserIds!: string[];
  groupName!: string;
}

export class ContributionReminderEvent {
  userId!: string;
  groupName!: string;
  dueDate!: string;
  hoursRemaining!: 48 | 24 | 0;
  amountNgn!: number;
}

export class ContributionReceivedEvent {
  userId!: string;
  amountNgn!: number;
  groupName!: string;
}

export class PayoutReceivedEvent {
  userId!: string;
  email!: string;
  fullName!: string;
  amountNgn!: number;
  groupName!: string;
}

export class PenaltyAppliedEvent {
  userId!: string;
  amountNgn!: number;
  groupName!: string;
}

export class PayoutFailedAdminEvent {
  adminUserId!: string;
  adminEmail!: string;
  adminName!: string;
  groupName!: string;
  cycleNumber!: number;
  error!: string;
}
