import { ConfigService } from "@nestjs/config";
import { DojahService } from "./dojah.service";

describe("DojahService", () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        DOJAH_ENV: "production",
        DOJAH_APP_ID: "app-id",
        DOJAH_SECRET_KEY: "secret",
      };
      return values[key] ?? fallback;
    }),
  } as unknown as ConfigService;

  afterEach(() => jest.restoreAllMocks());

  it("parses Dojah verification fields wrapped in entity", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        entity: {
          verification_status: "Completed",
          reference_id: "ref-123",
          data: {
            government_data: {
              data: {
                bvn: {
                  entity: { first_name: "Ada", last_name: "Obi" },
                },
              },
            },
          },
        },
      }),
    } as Response);

    const service = new DojahService(config);
    await expect(service.getVerificationDetails("ref-123")).resolves.toEqual({
      verificationStatus: "Completed",
      referenceId: "ref-123",
      fullName: "Ada Obi",
    });
  });

  it("continues to parse root-level Dojah verification fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        verification_status: "Completed",
        reference_id: "ref-456",
      }),
    } as Response);

    const service = new DojahService(config);
    await expect(service.getVerificationDetails("ref-456")).resolves.toEqual({
      verificationStatus: "Completed",
      referenceId: "ref-456",
      fullName: undefined,
    });
  });
});
