import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotifChannel } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import {
  NOTIFICATION_EVENTS,
  ContributionReceivedEvent,
  ContributionReminderEvent,
  GroupInvitedEvent,
  GroupStartedEvent,
  KycApprovedEvent,
  KycRejectedEvent,
  MemberContributedEvent,
  MemberJoinedEvent,
  MemberLeftEvent,
  MemberPayoutReceivedEvent,
  PenaltyAppliedEvent,
  PayoutFailedAdminEvent,
  PayoutReceivedEvent,
  UserWelcomeEvent,
} from './events/notification.events';

// Bridge from scheduler payout events
import {
  PAYOUT_EVENTS,
  PayoutDeadLetteredEvent,
  PayoutInitiatedEvent,
} from '../scheduler/events/payout.events';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notifs: NotificationsService,
    private readonly email: EmailService,
  ) {}

  // ── User Events ──────────────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.USER_WELCOME)
  async onUserWelcome(event: UserWelcomeEvent): Promise<void> {
    const title = 'Welcome to Poolr! 🎉';
    const body = `Hi ${event.fullName}, your account is now verified and ready.`;
    await Promise.allSettled([
      this.notifs.persist(event.userId, title, body, NotifChannel.IN_APP),
      this.email.sendWelcome(event.email, event.fullName),
    ]);
  }

  // ── KYC Events ───────────────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.KYC_APPROVED)
  async onKycApproved(event: KycApprovedEvent): Promise<void> {
    const title = 'KYC Verified ✅';
    const body = 'Your identity has been successfully verified. You can now join savings groups.';
    await Promise.allSettled([
      this.notifs.persist(event.userId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.userId, title, body),
      this.email.sendKycApproved(event.email, event.fullName),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.KYC_REJECTED)
  async onKycRejected(event: KycRejectedEvent): Promise<void> {
    const title = 'KYC Verification Failed';
    const body = 'We could not verify your identity. Please review your details and try again.';
    await Promise.allSettled([
      this.notifs.persist(event.userId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.userId, title, body),
      this.email.sendKycRejected(event.email, event.fullName),
    ]);
  }

  // ── Group Events ─────────────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.GROUP_INVITED)
  async onGroupInvited(event: GroupInvitedEvent): Promise<void> {
    const title = `Invitation: ${event.groupName}`;
    const body = `${event.adminName} invited you to join the savings group "${event.groupName}".`;
    await Promise.allSettled([
      this.notifs.persist(event.userId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.userId, title, body),
      this.email.sendGroupInvitation(
        event.email,
        event.fullName,
        event.adminName,
        event.groupName,
        event.inviteToken,
      ),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.GROUP_STARTED)
  async onGroupStarted(event: GroupStartedEvent): Promise<void> {
    const title = `"${event.groupName}" has started!`;
    const body = `Your savings group "${event.groupName}" is now active. Contributions are open.`;
    await Promise.allSettled(
      event.memberUserIds.flatMap((userId) => [
        this.notifs.persist(userId, title, body, NotifChannel.IN_APP),
        this.notifs.sendPush(userId, title, body),
        this.notifs.sendSms(userId, body),
      ]),
    );
  }

  // ── Group Membership Events ───────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.MEMBER_JOINED)
  async onMemberJoined(event: MemberJoinedEvent): Promise<void> {
    const title = `New member joined "${event.groupName}"`;
    const body = `${event.memberName} has joined the group.`;
    await Promise.allSettled(
      event.otherMemberUserIds.flatMap((userId) => [
        this.notifs.persist(userId, title, body, NotifChannel.IN_APP),
        this.notifs.sendPush(userId, title, body),
      ]),
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.MEMBER_LEFT)
  async onMemberLeft(event: MemberLeftEvent): Promise<void> {
    const title = `Member left "${event.groupName}"`;
    const body = `${event.memberName} has left the group.`;
    await Promise.allSettled(
      event.otherMemberUserIds.flatMap((userId) => [
        this.notifs.persist(userId, title, body, NotifChannel.IN_APP),
        this.notifs.sendPush(userId, title, body),
      ]),
    );
  }

  // ── Contribution Events ───────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.CONTRIBUTION_REMINDER)
  async onContributionReminder(event: ContributionReminderEvent): Promise<void> {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
    }).format(event.amountNgn);

    const isDueToday = event.hoursRemaining === 0;
    const title = isDueToday ? 'Contribution Due Today!' : 'Contribution Reminder';
    const body = isDueToday
      ? `Your contribution of ${formatted} for "${event.groupName}" is due today. Pay now to avoid a penalty.`
      : `Your contribution of ${formatted} for "${event.groupName}" is due in ${event.hoursRemaining} hours.`;

    await Promise.allSettled([
      this.notifs.persist(event.userId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.userId, title, body),
      this.notifs.sendSms(event.userId, body),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.CONTRIBUTION_RECEIVED)
  async onContributionReceived(event: ContributionReceivedEvent): Promise<void> {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
    }).format(event.amountNgn);

    const title = 'Contribution Confirmed';
    const body = `Your contribution of ${formatted} to "${event.groupName}" has been received.`;
    await Promise.allSettled([
      this.notifs.persist(event.userId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.userId, title, body),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.MEMBER_CONTRIBUTED)
  async onMemberContributed(event: MemberContributedEvent): Promise<void> {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
    }).format(event.amountNgn);
    const title = `Contribution made in "${event.groupName}"`;
    const body = `${event.payerName} paid ${formatted}. The group pot is growing!`;
    await Promise.allSettled(
      event.otherMemberUserIds.flatMap((userId) => [
        this.notifs.persist(userId, title, body, NotifChannel.IN_APP),
        this.notifs.sendPush(userId, title, body),
      ]),
    );
  }

  // ── Payout Events ─────────────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.PAYOUT_RECEIVED)
  async onPayoutReceived(event: PayoutReceivedEvent): Promise<void> {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
    }).format(event.amountNgn);

    const title = 'Payout on the way! 💰';
    const body = `Your payout of ${formatted} from "${event.groupName}" has been initiated.`;
    await Promise.allSettled([
      this.notifs.persist(event.userId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.userId, title, body),
      this.notifs.sendSms(event.userId, body),
      this.email.sendPayoutReceived(event.email, event.fullName, event.amountNgn, event.groupName),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.MEMBER_PAYOUT_RECEIVED)
  async onMemberPayoutReceived(event: MemberPayoutReceivedEvent): Promise<void> {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
    }).format(event.amountNgn);
    const title = `Payout sent in "${event.groupName}"`;
    const body = `${event.recipientName} received their payout of ${formatted}.`;
    await Promise.allSettled(
      event.otherMemberUserIds.flatMap((userId) => [
        this.notifs.persist(userId, title, body, NotifChannel.IN_APP),
        this.notifs.sendPush(userId, title, body),
      ]),
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.PENALTY_APPLIED)
  async onPenaltyApplied(event: PenaltyAppliedEvent): Promise<void> {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
    }).format(event.amountNgn);

    const title = 'Penalty Applied';
    const body = `A penalty of ${formatted} has been applied for a missed contribution in "${event.groupName}".`;
    await Promise.allSettled([
      this.notifs.persist(event.userId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.userId, title, body),
      this.notifs.sendSms(event.userId, body),
    ]);
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYOUT_FAILED_ADMIN)
  async onPayoutFailedAdmin(event: PayoutFailedAdminEvent): Promise<void> {
    const title = '⚠️ Payout Failed — Action Required';
    const body = `Payout for cycle ${event.cycleNumber} in "${event.groupName}" failed and requires your attention.`;
    await Promise.allSettled([
      this.notifs.persist(event.adminUserId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.adminUserId, title, body),
      this.email.sendPayoutFailed(
        event.adminEmail,
        event.adminName,
        event.groupName,
        event.cycleNumber,
        event.error,
      ),
    ]);
  }

  @OnEvent('notification.payout.bank_required')
  async onPayoutBankRequired(event: { userId: string; groupName: string; amountNgn: number }): Promise<void> {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
    }).format(event.amountNgn);
    const title = 'Action required: Add bank account to receive payout';
    const body = `Your payout of ${formatted} from "${event.groupName}" is ready. Add your bank account in Settings to receive it.`;
    await Promise.allSettled([
      this.notifs.persist(event.userId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.userId, title, body),
      this.notifs.sendSms(event.userId, body),
    ]);
  }

  // ── Bridge: Scheduler Payout Events ──────────────────────────────────────────

  @OnEvent(PAYOUT_EVENTS.INITIATED)
  async onPayoutInitiated(event: PayoutInitiatedEvent): Promise<void> {
    // Enrich with user data for email, then emit as PAYOUT_RECEIVED via service methods
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
    }).format(event.amountNgn);

    const title = 'Payout on the way! 💰';
    const body = `Your payout of ${formatted} has been initiated and is on its way.`;
    await Promise.allSettled([
      this.notifs.persist(event.recipientId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.recipientId, title, body),
      this.notifs.sendSms(event.recipientId, body),
    ]);
    this.logger.log(`Payout initiated notification dispatched to ${event.recipientId}`);
  }

  @OnEvent(PAYOUT_EVENTS.DEAD_LETTERED)
  async onPayoutDeadLettered(event: PayoutDeadLetteredEvent): Promise<void> {
    const title = 'Urgent: Payout Failed';
    const body = `Payout for cycle ${event.cycleNumber} in your group failed after multiple retries. Manual action required.`;
    await Promise.allSettled([
      this.notifs.persist(event.groupAdminId, title, body, NotifChannel.IN_APP),
      this.notifs.sendPush(event.groupAdminId, title, body),
    ]);
    this.logger.warn(`Dead-letter notification dispatched to admin ${event.groupAdminId}`);
  }
}
