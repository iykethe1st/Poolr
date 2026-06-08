import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TermiiService {
  private readonly logger = new Logger(TermiiService.name);

  constructor(private readonly config: ConfigService) {}

  async send(phone: string, message: string): Promise<void> {
    const apiKey = this.config.get<string>('TERMII_API_KEY');

    if (!apiKey) {
      this.logger.debug(`[DEV] SMS to ${phone}: ${message}`);
      return;
    }

    const res = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        from: 'Poolr',
        sms: message,
        type: 'plain',
        channel: 'dnd',
        api_key: apiKey,
      }),
    });

    if (!res.ok) {
      this.logger.error(`Termii SMS failed (${res.status}): ${await res.text()}`);
    }
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    await this.send(
      phone,
      `Your Poolr verification code is ${otp}. It expires in 10 minutes. Do not share it.`,
    );
  }
}
