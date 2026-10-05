import { envValidationSchema } from "./env.validation";

describe("envValidationSchema", () => {
  const requiredConfig = {
    DATABASE_URL: "postgresql://localhost/poolr",
    JWT_SECRET: "test-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
  };

  it("provides development defaults for the frontend URL and contribution fees", () => {
    const { error, value } = envValidationSchema.validate(requiredConfig);

    expect(error).toBeUndefined();
    expect(value.FRONTEND_URL).toBe("http://localhost:3003");
    expect(value.CONTRIBUTION_FEE_TIER_1_AMOUNT).toBe(0);
    expect(value.CONTRIBUTION_FEE_TIER_2_AMOUNT).toBe(0);
    expect(value.CONTRIBUTION_FEE_TIER_3_AMOUNT).toBe(1_800);
  });

  it("accepts configured frontend URLs and fee tiers", () => {
    const { error, value } = envValidationSchema.validate({
      ...requiredConfig,
      FRONTEND_URL: "https://poolr.example",
      CONTRIBUTION_FEE_TIER_1_MAX: "20000",
      CONTRIBUTION_FEE_TIER_1_AMOUNT: "150",
      CONTRIBUTION_FEE_TIER_2_MAX: "100000",
      CONTRIBUTION_FEE_TIER_2_AMOUNT: "300",
      CONTRIBUTION_FEE_TIER_3_AMOUNT: "600",
    });

    expect(error).toBeUndefined();
    expect(value.FRONTEND_URL).toBe("https://poolr.example");
    expect(value.CONTRIBUTION_FEE_TIER_1_MAX).toBe(20_000);
    expect(value.CONTRIBUTION_FEE_TIER_1_AMOUNT).toBe(150);
    expect(value.CONTRIBUTION_FEE_TIER_2_MAX).toBe(100_000);
    expect(value.CONTRIBUTION_FEE_TIER_2_AMOUNT).toBe(300);
    expect(value.CONTRIBUTION_FEE_TIER_3_AMOUNT).toBe(600);
  });

  it("rejects invalid URLs and out-of-order fee thresholds", () => {
    const { error } = envValidationSchema.validate({
      ...requiredConfig,
      FRONTEND_URL: "not-a-url",
      CONTRIBUTION_FEE_TIER_1_MAX: 20_000,
      CONTRIBUTION_FEE_TIER_2_MAX: 10_000,
    });

    expect(error).toBeDefined();
  });
});
