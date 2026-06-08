import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InitializeParams {
  email: string;
  amountNgn: number;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeResult {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyResult {
  status: 'success' | 'failed' | 'pending' | 'abandoned';
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface TransferParams {
  amountNgn: number;
  recipientCode: string;
  reference: string;
  reason?: string;
}

export interface TransferResult {
  transferCode: string;
  reference: string;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get('PAYSTACK_BASE_URL', 'https://api.paystack.co');
  }

  async initializeTransaction(params: InitializeParams): Promise<InitializeResult> {
    const secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY', '');

    if (!secretKey) {
      this.logger.debug(`[DEV] Paystack mock init → ${params.reference}`);
      return {
        authorizationUrl: `https://checkout.paystack.com/dev_mock?ref=${params.reference}`,
        reference: params.reference,
      };
    }

    const data = await this.request<{ authorization_url: string; reference: string }>(
      '/transaction/initialize',
      'POST',
      secretKey,
      { email: params.email, amount: Math.round(params.amountNgn * 100), reference: params.reference, metadata: params.metadata },
    );

    return { authorizationUrl: data.authorization_url, reference: data.reference };
  }

  async verifyTransaction(reference: string): Promise<VerifyResult> {
    const secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY', '');

    if (!secretKey) {
      this.logger.debug(`[DEV] Paystack mock verify → ${reference}: success`);
      return { status: 'success', amountKobo: 0, reference };
    }

    const data = await this.request<{
      status: string;
      amount: number;
      reference: string;
      metadata?: Record<string, unknown>;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`, 'GET', secretKey);

    return {
      status: data.status as VerifyResult['status'],
      amountKobo: data.amount,
      reference: data.reference,
      metadata: data.metadata,
    };
  }

  async initiateTransfer(params: TransferParams): Promise<TransferResult> {
    const secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY', '');

    if (!secretKey) {
      const mockCode = `TRF_mock_${Date.now()}`;
      this.logger.debug(`[DEV] Paystack mock transfer ${params.reference} → ${mockCode}`);
      return { transferCode: mockCode, reference: params.reference };
    }

    const data = await this.request<{ transfer_code: string; reference: string }>(
      '/transfer',
      'POST',
      secretKey,
      {
        source: 'balance',
        amount: Math.round(params.amountNgn * 100),
        recipient: params.recipientCode,
        reason: params.reason ?? 'Poolr payout',
        reference: params.reference,
      },
    );

    return { transferCode: data.transfer_code, reference: data.reference };
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    secretKey: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as { status: boolean; data: T; message?: string };

    if (!res.ok || !json.status) {
      const msg = json.message ?? res.statusText;
      this.logger.error(`Paystack ${method} ${path} failed: ${msg}`);
      throw new Error(`Paystack error: ${msg}`);
    }

    return json.data;
  }
}
