import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  renderGroupInvitationEmail,
  renderKycResultEmail,
  renderPayoutFailedEmail,
  renderPayoutReceivedEmail,
  renderWelcomeEmail,
} from '@poolr/email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from = this.config.get<string>('RESEND_FROM_EMAIL', 'Poolr <noreply@poolr.app>');
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!apiKey) this.logger.warn('RESEND_API_KEY not set — emails disabled');
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    const html = await renderWelcomeEmail(name);
    await this.send(to, 'Welcome to Poolr!', html);
  }

  async sendKycApproved(to: string, name: string): Promise<void> {
    const html = await renderKycResultEmail(name, true);
    await this.send(to, 'KYC Verification Approved ✅', html);
  }

  async sendKycRejected(to: string, name: string): Promise<void> {
    const html = await renderKycResultEmail(name, false);
    await this.send(to, 'KYC Verification — Action Required', html);
  }

  async sendGroupInvitation(
    to: string,
    recipientName: string,
    adminName: string,
    groupName: string,
    inviteToken: string,
  ): Promise<void> {
    const html = await renderGroupInvitationEmail(recipientName, adminName, groupName, inviteToken);
    await this.send(to, `You're invited to join "${groupName}" on Poolr`, html);
  }

  async sendPayoutReceived(to: string, name: string, amountNgn: number, groupName: string): Promise<void> {
    const html = await renderPayoutReceivedEmail(name, amountNgn, groupName);
    await this.send(to, `Your payout from "${groupName}" is on the way!`, html);
  }

  async sendPayoutFailed(
    to: string,
    adminName: string,
    groupName: string,
    cycleNumber: number,
    error: string,
  ): Promise<void> {
    const html = await renderPayoutFailedEmail(adminName, groupName, cycleNumber, error);
    await this.send(to, `⚠️ Action Required: Payout failed for "${groupName}"`, html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.debug(`[DEV] Email skipped — to: ${to}, subject: "${subject}"`);
      return;
    }

    const { error } = await this.resend.emails.send({ from: this.from, to, subject, html });
    if (error) {
      this.logger.error(`Resend error for "${subject}" → ${to}: ${error.message}`);
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }
}
