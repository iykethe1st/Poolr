import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface DojahVerification {
  verificationStatus: 'Completed' | 'Failed' | 'Ongoing' | 'Pending' | 'Abandoned';
  referenceId: string;
}

export interface DojahWebhookData {
  userId: string | null;
  verificationStatus: string;
}

@Injectable()
export class DojahService {
  private readonly logger = new Logger(DojahService.name);
  private readonly baseUrl = 'https://api.dojah.io';

  constructor(private readonly config: ConfigService) {}

  async getVerificationDetails(referenceId: string): Promise<DojahVerification> {
    const appId = this.config.get<string>('DOJAH_APP_ID', '');
    const secretKey = this.config.get<string>('DOJAH_SECRET_KEY', '');

    if (!appId || !secretKey) {
      this.logger.debug(`[DEV] Mock Dojah verification for ${referenceId} → Completed`);
      return { verificationStatus: 'Completed', referenceId };
    }

    const res = await fetch(
      `${this.baseUrl}/api/v1/kyc/verification?reference_id=${encodeURIComponent(referenceId)}`,
      {
        headers: {
          AppId: appId,
          Authorization: secretKey,
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Dojah verification API ${res.status}: ${text}`);
      throw new Error('Failed to fetch verification details from Dojah');
    }

    const data = (await res.json()) as {
      entity?: { verification_status?: string; reference_id?: string };
      verification_status?: string;
    };

    const status = (data.entity?.verification_status ??
      data.verification_status ??
      'Ongoing') as DojahVerification['verificationStatus'];

    return {
      verificationStatus: status,
      referenceId: data.entity?.reference_id ?? referenceId,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.config.get<string>('DOJAH_WEBHOOK_SECRET', '');
    if (!secret) return true;

    const expected = createHmac('sha256', secret)
      .update(rawBody.toString('utf8'))
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }

  parseWebhookPayload(rawBody: Buffer): DojahWebhookData {
    try {
      const payload = JSON.parse(rawBody.toString('utf8')) as {
        entity?: {
          verification_status?: string;
          metadata?: { user_id?: string };
        };
        verification_status?: string;
        metadata?: { user_id?: string };
      };

      const verificationStatus =
        payload.entity?.verification_status ?? payload.verification_status ?? 'Ongoing';

      const userId =
        payload.entity?.metadata?.user_id ?? payload.metadata?.user_id ?? null;

      return { userId, verificationStatus };
    } catch {
      return { userId: null, verificationStatus: 'Ongoing' };
    }
  }
}
