import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface InitializeParams {
  email: string;
  amountNgn: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeResult {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyResult {
  status: "success" | "failed" | "pending" | "abandoned";
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

export interface CustomerResult {
  customerCode: string;
}

export interface DvaResult {
  accountNumber: string;
  accountName: string;
  bankName: string;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get("PAYSTACK_BASE_URL", "https://api.paystack.co");
  }

  /**
   * Gross up so that after Paystack deducts their local fee, the merchant
   * receives exactly `amountNgn`.
   * Nigeria local: 1.5% + ₦100, capped at ₦2,000. ₦100 waived under ₦2,500.
   * Formula: https://support.paystack.com/en/articles/2130306
   */
  grossUpAmount(amountNgn: number): number {
    const PCT = 0.015;
    const FLAT = amountNgn < 2_500 ? 0 : 100;
    const CAP = 2_000;

    if (PCT * amountNgn + FLAT >= CAP) return amountNgn + CAP;
    return (amountNgn + FLAT) / (1 - PCT) + 0.01;
  }

  async initializeTransaction(
    params: InitializeParams,
  ): Promise<InitializeResult> {
    const secretKey = this.config.get<string>("PAYSTACK_SECRET_KEY", "");

    if (!secretKey) {
      this.logger.debug(`[DEV] Paystack mock init → ${params.reference}`);
      return {
        authorizationUrl: `https://checkout.paystack.com/dev_mock?ref=${params.reference}`,
        reference: params.reference,
      };
    }

    const data = await this.request<{
      authorization_url: string;
      reference: string;
    }>("/transaction/initialize", "POST", secretKey, {
      email: params.email,
      amount: Math.round(params.amountNgn * 100),
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    });

    return {
      authorizationUrl: data.authorization_url,
      reference: data.reference,
    };
  }

  async verifyTransaction(reference: string): Promise<VerifyResult> {
    const secretKey = this.config.get<string>("PAYSTACK_SECRET_KEY", "");

    if (!secretKey) {
      this.logger.debug(`[DEV] Paystack mock verify → ${reference}: success`);
      return { status: "success", amountKobo: 0, reference };
    }

    const data = await this.request<{
      status: string;
      amount: number;
      reference: string;
      metadata?: Record<string, unknown>;
    }>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      "GET",
      secretKey,
    );

    return {
      status: data.status as VerifyResult["status"],
      amountKobo: data.amount,
      reference: data.reference,
      metadata: data.metadata,
    };
  }

  async initiateTransfer(params: TransferParams): Promise<TransferResult> {
    const secretKey = this.config.get<string>("PAYSTACK_SECRET_KEY", "");
    const isProduction =
      this.config.get<string>("NODE_ENV", "development") === "production";
    const transfersEnabled = this.config.get<boolean>(
      "PAYSTACK_TRANSFERS_ENABLED",
      isProduction,
    );

    if (!secretKey || !transfersEnabled) {
      throw new ServiceUnavailableException(
        !secretKey
          ? "Paystack transfers are unavailable because PAYSTACK_SECRET_KEY is not configured."
          : "Paystack transfers are disabled. Enable PAYSTACK_TRANSFERS_ENABLED to initiate a real transfer.",
      );
    }

    const data = await this.request<{
      transfer_code: string;
      reference: string;
    }>("/transfer", "POST", secretKey, {
      source: "balance",
      amount: Math.round(params.amountNgn * 100),
      recipient: params.recipientCode,
      reason: params.reason ?? "Poolr payout",
      reference: params.reference,
    });

    return { transferCode: data.transfer_code, reference: data.reference };
  }

  async createCustomer(params: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<CustomerResult> {
    const secretKey = this.config.get<string>("PAYSTACK_SECRET_KEY", "");

    if (!secretKey) {
      const mockCode = `CUS_mock_${Date.now()}`;
      this.logger.debug(`[DEV] Paystack mock customer → ${mockCode}`);
      return { customerCode: mockCode };
    }

    const data = await this.request<{ customer_code: string }>(
      "/customer",
      "POST",
      secretKey,
      {
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
      },
    );

    return { customerCode: data.customer_code };
  }

  async createDedicatedAccount(customerCode: string): Promise<DvaResult> {
    const secretKey = this.config.get<string>("PAYSTACK_SECRET_KEY", "");

    if (!secretKey) {
      const mock = `91${Math.floor(Math.random() * 100_000_000)
        .toString()
        .padStart(8, "0")}`;
      this.logger.debug(`[DEV] Paystack mock DVA → ${mock}`);
      return {
        accountNumber: mock,
        accountName: "PAYSTACK-POOLR TEST",
        bankName: "Wema Bank",
      };
    }

    const data = await this.request<{
      account_number: string;
      account_name: string;
      bank: { name: string };
    }>("/dedicated_account", "POST", secretKey, {
      customer: customerCode,
      preferred_bank: "wema-bank",
    });

    return {
      accountNumber: data.account_number,
      accountName: data.account_name,
      bankName: data.bank.name,
    };
  }

  async listBanks(): Promise<
    Array<{ name: string; code: string; slug: string }>
  > {
    const secretKey = this.config.get<string>("PAYSTACK_SECRET_KEY", "");

    if (!secretKey) {
      return [
        { name: "Access Bank", code: "044", slug: "access-bank" },
        { name: "GTBank", code: "058", slug: "guaranty-trust-bank" },
        { name: "First Bank", code: "011", slug: "first-bank-of-nigeria" },
        { name: "Zenith Bank", code: "057", slug: "zenith-bank" },
        { name: "UBA", code: "033", slug: "united-bank-for-africa" },
        { name: "Wema Bank", code: "035", slug: "wema-bank" },
        { name: "Opay", code: "999992", slug: "paycom" },
        { name: "Kuda Bank", code: "090267", slug: "kuda-bank" },
      ];
    }

    const data = await this.request<
      Array<{ name: string; code: string; slug: string }>
    >("/bank?currency=NGN&perPage=100", "GET", secretKey);
    return data;
  }

  async resolveAccount(
    bankCode: string,
    accountNumber: string,
  ): Promise<{ accountName: string; accountNumber: string }> {
    const secretKey = this.config.get<string>("PAYSTACK_SECRET_KEY", "");

    if (!secretKey) {
      this.logger.debug(`[DEV] Paystack mock resolve → ${accountNumber}`);
      return { accountName: "MOCK ACCOUNT HOLDER", accountNumber };
    }

    const data = await this.request<{
      account_name: string;
      account_number: string;
    }>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      "GET",
      secretKey,
    );
    return {
      accountName: data.account_name,
      accountNumber: data.account_number,
    };
  }

  async createTransferRecipient(params: {
    name: string;
    accountNumber: string;
    bankCode: string;
  }): Promise<{ recipientCode: string }> {
    const secretKey = this.config.get<string>("PAYSTACK_SECRET_KEY", "");

    if (!secretKey) {
      const mockCode = `RCP_mock_${Date.now()}`;
      this.logger.debug(`[DEV] Paystack mock recipient → ${mockCode}`);
      return { recipientCode: mockCode };
    }

    const data = await this.request<{ recipient_code: string }>(
      "/transferrecipient",
      "POST",
      secretKey,
      {
        type: "nuban",
        name: params.name,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: "NGN",
      },
    );
    return { recipientCode: data.recipient_code };
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST",
    secretKey: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as {
      status: boolean;
      data: T;
      message?: string;
    };

    if (!res.ok || !json.status) {
      const msg = json.message ?? res.statusText;
      this.logger.error(`Paystack ${method} ${path} failed: ${msg}`);
      throw new Error(`Paystack error: ${msg}`);
    }

    return json.data;
  }
}
