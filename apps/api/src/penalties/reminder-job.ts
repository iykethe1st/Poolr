export interface ReminderJobData {
  contributionId: string;
  memberId: string;
  cycleId: string;
  groupName: string;
  dueDate: string;
  hoursRemaining: 48 | 24 | 0;
}
