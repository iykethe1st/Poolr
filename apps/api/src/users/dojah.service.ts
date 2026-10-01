import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

export interface DojahVerification {
  verificationStatus:
    | "Completed"
    | "Successful"
    | "Failed"
    | "Ongoing"
    | "Pending"
    | "Abandoned";
  referenceId: string;
  fullName?: string;
}

interface DojahVerificationPayload {
  verification_status?: string;
  reference_id?: string;
  data?: {
    government_data?: {
      data?: {
        bvn?: {
          entity?: {
            first_name?: string;
            last_name?: string;
            full_name?: string;
          };
        };
        nin?: {
          entity?: {
            first_name?: string;
            last_name?: string;
            full_name?: string;
          };
        };
        passport?: {
          entity?: {
            first_name?: string;
            last_name?: string;
            full_name?: string;
          };
        };
      };
    };
  };
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
    this.config.get("DOJAH_ENV") === "production"
      ? "https://api.dojah.io"
      : "https://sandbox.dojah.io";

  constructor(private readonly config: ConfigService) {}

  async getVerificationDetails(
    referenceId: string,
  ): Promise<DojahVerification> {
    const appId = this.config.get<string>("DOJAH_APP_ID", "");
    const secretKey = this.config.get<string>("DOJAH_SECRET_KEY", "");

    if (!appId || !secretKey) {
      this.logger.debug(
        `[DEV] Mock Dojah verification for ${referenceId} → Completed`,
      );
      return { verificationStatus: "Completed", referenceId };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    let res: Response;
    try {
      res = await fetch(
        `${this.baseUrl}/api/v1/kyc/verification?reference_id=${encodeURIComponent(referenceId)}`,
        {
          headers: { AppId: appId, Authorization: secretKey },
          signal: controller.signal,
        },
      );
    } catch (err) {
      clearTimeout(timeout);
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Dojah API timed out"
          : "Dojah API unreachable";
      this.logger.warn(
        `${msg} — returning Ongoing so webhook can confirm later`,
      );
      return { verificationStatus: "Ongoing", referenceId };
    }
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Dojah verification API ${res.status}: ${text}`);
      // Treat non-fatal errors as Ongoing so the webhook can still confirm
      return { verificationStatus: "Ongoing", referenceId };
    }

    const response = (await res.json()) as DojahVerificationPayload & {
      entity?: DojahVerificationPayload;
    };
    const data = response.entity ?? response;

    this.logger.log(
      `Dojah verification result: referenceId=${data.reference_id ?? referenceId} status=${data.verification_status ?? "Ongoing"}`,
    );

    const status = (data.verification_status ??
      "Ongoing") as DojahVerification["verificationStatus"];

    const govData = data.data?.government_data?.data;
    const idEntity =
      govData?.bvn?.entity ?? govData?.nin?.entity ?? govData?.passport?.entity;

    const fullName =
      idEntity?.full_name ||
      [idEntity?.first_name, idEntity?.last_name].filter(Boolean).join(" ") ||
      undefined;

    return {
      verificationStatus: status,
      referenceId: data.reference_id ?? referenceId,
      fullName: fullName || undefined,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.config.get<string>("DOJAH_WEBHOOK_SECRET", "");
    if (!secret) return true;

    const expected = createHmac("sha256", secret)
      .update(rawBody.toString("utf8"))
      .digest("hex");

    try {
      return timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(signature, "hex"),
      );
    } catch {
      return false;
    }
  }

  parseWebhookPayload(rawBody: Buffer): DojahWebhookData {
    try {
      // Dojah webhook payload mirrors the verification response structure
      const payload = JSON.parse(rawBody.toString("utf8")) as {
        verification_status?: string;
        reference_id?: string;
        entity?: {
          verification_status?: string;
          reference_id?: string;
          metadata?: { user_id?: string };
        };
        metadata?: { user_id?: string };
        data?: {
          government_data?: {
            data?: {
              bvn?: {
                entity?: {
                  first_name?: string;
                  last_name?: string;
                  full_name?: string;
                };
              };
              nin?: {
                entity?: {
                  first_name?: string;
                  last_name?: string;
                  full_name?: string;
                };
              };
              passport?: {
                entity?: {
                  first_name?: string;
                  last_name?: string;
                  full_name?: string;
                };
              };
            };
          };
        };
      };

      this.logger.log(`Dojah webhook payload: ${JSON.stringify(payload)}`);

      const verificationStatus =
        payload.verification_status ??
        payload.entity?.verification_status ??
        "Ongoing";

      // Try metadata first, then parse userId from referenceId (format: "${userId}-${timestamp}")
      const referenceId =
        payload.reference_id ?? payload.entity?.reference_id ?? "";
      const userIdFromMeta =
        payload.entity?.metadata?.user_id ?? payload.metadata?.user_id ?? null;
      const userIdFromRef = referenceId
        ? referenceId.substring(0, referenceId.lastIndexOf("-")) || null
        : null;
      const userId = userIdFromMeta ?? userIdFromRef;

      const govData = payload.data?.government_data?.data;
      const idEntity =
        govData?.bvn?.entity ??
        govData?.nin?.entity ??
        govData?.passport?.entity;
      const fullName =
        idEntity?.full_name ||
        [idEntity?.first_name, idEntity?.last_name].filter(Boolean).join(" ") ||
        undefined;

      return { userId, verificationStatus, fullName };
    } catch {
      return { userId: null, verificationStatus: "Ongoing" };
    }
  }
}
