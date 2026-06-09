import { render } from '@react-email/render';
import * as React from 'react';

import { WelcomeEmail } from './templates/welcome';
import { KycResultEmail } from './templates/kyc-result';
import { GroupInvitationEmail } from './templates/group-invitation';
import { PayoutReceivedEmail } from './templates/payout-received';
import { PayoutFailedEmail } from './templates/payout-failed';

export { WelcomeEmail } from './templates/welcome';
export { KycResultEmail } from './templates/kyc-result';
export { GroupInvitationEmail } from './templates/group-invitation';
export { PayoutReceivedEmail } from './templates/payout-received';
export { PayoutFailedEmail } from './templates/payout-failed';

export async function renderWelcomeEmail(name: string): Promise<string> {
  return render(React.createElement(WelcomeEmail, { name }));
}

export async function renderKycResultEmail(name: string, approved: boolean): Promise<string> {
  return render(React.createElement(KycResultEmail, { name, approved }));
}

export async function renderGroupInvitationEmail(
  recipientName: string,
  adminName: string,
  groupName: string,
  inviteToken: string,
): Promise<string> {
  return render(
    React.createElement(GroupInvitationEmail, {
      recipientName,
      adminName,
      groupName,
      inviteToken,
    }),
  );
}

export async function renderPayoutReceivedEmail(
  name: string,
  amountNgn: number,
  groupName: string,
): Promise<string> {
  return render(React.createElement(PayoutReceivedEmail, { name, amountNgn, groupName }));
}

export async function renderPayoutFailedEmail(
  adminName: string,
  groupName: string,
  cycleNumber: number,
  error: string,
): Promise<string> {
  return render(React.createElement(PayoutFailedEmail, { adminName, groupName, cycleNumber, error }));
}
