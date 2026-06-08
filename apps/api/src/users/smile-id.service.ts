import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export type SmileIdResult = 'VERIFIED' | 'REJECTED';

interface SmileIdResponse {
  ResultCode: string;
  ResultText: string;
  Actions?: { Verify_ID_Number?: string };
}

@Injectable()
export class SmileIdService {
  private readonly logger = new Logger(SmileIdService.name);

  constructor(private readonly config: ConfigService) {}

  async verifyIdentity(params: {
    idType: 'BVN' | 'NIN';
    idNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  }): Promise<SmileIdResult> {
    const partnerId = this.config.get<string>('SMILE_ID_PARTNER_ID', '');
    const apiKey = this.config.get<string>('SMILE_ID_API_KEY', '');

    if (!partnerId || !apiKey) {
      this.logger.debug(`[DEV] Smile ID mock VERIFIED for ${params.idType}: ${params.idNumber}`);
      return 'VERIFIED';
    }

    const timestamp = new Date().toISOString();
    const signature = createHmac('sha256', apiKey)
      .update(`${timestamp}${partnerId}sid_request`)
      .digest('base64');

    const baseUrl = this.config.get<string>(
      'SMILE_ID_BASE_URL',
      'https://testapi.smileidentity.com/v1',
    );

    const [firstName, ...rest] = params.firstName.trim().split(' ');
    const lastName = params.lastName || rest.join(' ') || 'N/A';

    const body = {
      partner_id: partnerId,
      signature,
      timestamp,
      country: 'NG',
      id_type: params.idType,
      id_number: params.idNumber,
      first_name: firstName,
      last_name: lastName,
      dob: params.dateOfBirth,
    };

    const res = await fetch(`${baseUrl}/id_verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Smile ID HTTP ${res.status}: ${text}`);
      return 'REJECTED';
    }

    const data = (await res.json()) as SmileIdResponse;
    const verified = data.Actions?.Verify_ID_Number === 'Verified';
    this.logger.log(`Smile ID ${params.idType} result: ${data.ResultText} (verified=${verified})`);

    return verified ? 'VERIFIED' : 'REJECTED';
  }
}
