import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface DojahVerification {
  verificationStatus: 'Completed' | 'Failed' | 'Ongoing' | 'Pending' | 'Abandoned';
  referenceId: string;
  fullName?: string;
}

export interface DojahWebhookData {
  userId: string | null;
  verificationStatus: string;
  fullName?: string;
}

@Injectable()
export class DojahService {
  private readonly logger = new Logger(DojahService.name);
  private readonly baseUrl =
    this.config.get('DOJAH_ENV') === 'production'
      ? 'https://api.dojah.io'
      : 'https://sandbox.dojah.io';

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
      entity?: {
        verification_status?: string;
        reference_id?: string;
        full_name?: string;
        first_name?: string;
        last_name?: string;
        government_data?: { first_name?: string; last_name?: string; full_name?: string };
      };
      verification_status?: string;
    };

    this.logger.log(`Dojah verification response keys: ${JSON.stringify(Object.keys(data.entity ?? {}))}`);
    this.logger.log(`Dojah verification entity: ${JSON.stringify(data.entity)}`);

    const status = (data.entity?.verification_status ??
      data.verification_status ??
      'Ongoing') as DojahVerification['verificationStatus'];

    const e = data.entity;
    const fullName =
      (e?.full_name ??
      e?.government_data?.full_name ??
      [e?.first_name ?? e?.government_data?.first_name, e?.last_name ?? e?.government_data?.last_name]
        .filter(Boolean)
        .join(' ')) || undefined;

    return {
      verificationStatus: status,
      referenceId: e?.reference_id ?? referenceId,
      fullName: fullName || undefined,
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
          full_name?: string;
          first_name?: string;
          last_name?: string;
          government_data?: { first_name?: string; last_name?: string; full_name?: string };
        };
        verification_status?: string;
        metadata?: { user_id?: string };
      };

      this.logger.log(`Dojah webhook entity: ${JSON.stringify(payload.entity)}`);

      const verificationStatus =
        payload.entity?.verification_status ?? payload.verification_status ?? 'Ongoing';

      const userId =
        payload.entity?.metadata?.user_id ?? payload.metadata?.user_id ?? null;

      const e = payload.entity;
      const fullName =
        (e?.full_name ??
        e?.government_data?.full_name ??
        [e?.first_name ?? e?.government_data?.first_name, e?.last_name ?? e?.government_data?.last_name]
          .filter(Boolean)
          .join(' ')) || undefined;

      return { userId, verificationStatus, fullName };
    } catch {
      return { userId: null, verificationStatus: 'Ongoing' };
    }
  }
}
