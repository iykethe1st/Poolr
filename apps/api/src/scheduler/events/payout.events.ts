export const PAYOUT_EVENTS = {
  INITIATED: 'payout.initiated',
  DEAD_LETTERED: 'payout.dead_lettered',
} as const;

export class PayoutInitiatedEvent {
  cycleId!: string;
  recipientId!: string;
  amountNgn!: number;
  transferCode!: string;
}

export class PayoutDeadLetteredEvent {
  cycleId!: string;
  recipientId!: string;
  groupAdminId!: string;
  cycleNumber!: number;
  error!: string;
}

export interface PayoutJobData {
  cycleId: string;
  recipientId: string;
  groupId: string;
}
