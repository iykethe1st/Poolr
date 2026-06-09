import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string | undefined;
  private readonly senderId: string;
  private readonly baseUrl = 'https://api.ng.termii.com/api/sms/send';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('TERMII_API_KEY');
    this.senderId = this.config.get<string>('TERMII_SENDER_ID', 'Poolr');
    if (!this.apiKey) this.logger.warn('TERMII_API_KEY not set — SMS disabled');
  }

  async send(phone: string, message: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.debug(`[DEV] SMS skipped — to: ${phone}, message: "${message.slice(0, 40)}…"`);
      return;
    }

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        from: this.senderId,
        sms: message,
        type: 'plain',
        api_key: this.apiKey,
        channel: 'generic',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Termii SMS failed (${res.status}): ${text}`);
      throw new Error(`SMS delivery failed: ${res.status}`);
    }
  }
}
