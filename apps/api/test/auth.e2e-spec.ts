import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/database/prisma.service";
import { RedisService } from "../src/redis/redis.service";
import { TermiiService } from "../src/auth/termii.service";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

// In-memory store that mimics Redis TTL semantics
function makeInMemoryRedis() {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    get: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: jest.fn(async (key: string, value: string, ttlSeconds?: number) => {
      store.set(key, {
        value,
        expiresAt:
          Date.now() +
          (ttlSeconds ? ttlSeconds * 1000 : 365 * 24 * 60 * 60 * 1000),
      });
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  };
}

const TEST_EMAIL_DOMAIN = "@poolr-e2e.test";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeRedis: ReturnType<typeof makeInMemoryRedis>;
  let capturedOtp: string;

  beforeAll(async () => {
    fakeRedis = makeInMemoryRedis();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService)
      .useValue(fakeRedis)
      .overrideProvider(TermiiService)
      .useValue({
        sendOtp: jest.fn(async (_phone: string, otp: string) => {
          capturedOtp = otp;
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api", {
      exclude: [{ path: "health", method: 4 /* GET */ }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test users created during this suite
    await prisma.user.deleteMany({
      where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
    });
    await app.close();
  });

  beforeEach(() => {
    fakeRedis._store.clear();
    jest.clearAllMocks();
  });

  const newUser = () => ({
    fullName: "E2E Tester",
    email: `e2e-${Date.now()}${TEST_EMAIL_DOMAIN}`,
    phone: `+234${Math.floor(8000000000 + Math.random() * 999999999)}`,
    password: "SecurePass1!",
  });

  // ── POST /api/auth/register ───────────────────────────────────────────────────

  describe("POST /api/auth/register", () => {
    it("201 → creates account and returns message", async () => {
      const user = newUser();
      const res = await request(app.getHttpServer())
        .post("/api/auth/register")
        .send(user);
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/OTP/i);
    });

    it("409 → duplicate email", async () => {
      const user = newUser();
      await request(app.getHttpServer()).post("/api/auth/register").send(user);
      const res = await request(app.getHttpServer())
        .post("/api/auth/register")
        .send({ ...user, phone: `+234${Date.now()}` });
      expect(res.status).toBe(409);
    });

    it("400 → missing required fields", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/auth/register")
        .send({ email: "bad@example.com" });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/auth/verify-otp ─────────────────────────────────────────────────

  describe("POST /api/auth/verify-otp", () => {
    it("200 → issues tokens after correct OTP", async () => {
      const user = newUser();
      await request(app.getHttpServer()).post("/api/auth/register").send(user);

      const res = await request(app.getHttpServer())
        .post("/api/auth/verify-otp")
        .send({ phone: user.phone, otp: capturedOtp });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user.email).toBe(user.email);
    });

    it("400 → wrong OTP", async () => {
      const user = newUser();
      await request(app.getHttpServer()).post("/api/auth/register").send(user);

      const res = await request(app.getHttpServer())
        .post("/api/auth/verify-otp")
        .send({ phone: user.phone, otp: "000000" });

      expect(res.status).toBe(400);
    });

    it("400 → OTP not 6 digits", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/auth/verify-otp")
        .send({ phone: "+2348012345678", otp: "123" });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/auth/login ──────────────────────────────────────────────────────

  describe("POST /api/auth/login", () => {
    let registeredUser: { email: string; phone: string; password: string };

    beforeEach(async () => {
      registeredUser = newUser();
      await request(app.getHttpServer())
        .post("/api/auth/register")
        .send(registeredUser);
      await request(app.getHttpServer())
        .post("/api/auth/verify-otp")
        .send({ phone: registeredUser.phone, otp: capturedOtp });
    });

    it("200 → returns tokens for valid credentials", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: registeredUser.email,
          password: registeredUser.password,
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
    });

    it("401 → wrong password", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: registeredUser.email, password: "wrongpass" });
      expect(res.status).toBe(401);
    });

    it("401 → unknown email", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "pass1234" });
      expect(res.status).toBe(401);
    });

    it("401 → unverified account cannot log in", async () => {
      const unverified = newUser();
      await request(app.getHttpServer())
        .post("/api/auth/register")
        .send(unverified);
      const res = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: unverified.email, password: unverified.password });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/auth/refresh ────────────────────────────────────────────────────

  describe("POST /api/auth/refresh", () => {
    it("200 → rotates tokens", async () => {
      const user = newUser();
      await request(app.getHttpServer()).post("/api/auth/register").send(user);
      const verifyRes = await request(app.getHttpServer())
        .post("/api/auth/verify-otp")
        .send({ phone: user.phone, otp: capturedOtp });

      const { refreshToken } = verifyRes.body as { refreshToken: string };

      const res = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      // Tokens must be new
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });

    it("401 → old refresh token rejected after rotation", async () => {
      const user = newUser();
      await request(app.getHttpServer()).post("/api/auth/register").send(user);
      const verifyRes = await request(app.getHttpServer())
        .post("/api/auth/verify-otp")
        .send({ phone: user.phone, otp: capturedOtp });

      const { refreshToken } = verifyRes.body as { refreshToken: string };

      // First rotation
      await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .send({ refreshToken });

      // Reuse original token → 401
      const res = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(401);
    });

    it("401 → malformed token", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .send({ refreshToken: "not.a.real.jwt" });
      expect(res.status).toBe(400); // class-validator @IsJWT rejects it before the controller
    });
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────────────────

  describe("POST /api/auth/logout", () => {
    it("200 → invalidates session", async () => {
      const user = newUser();
      await request(app.getHttpServer()).post("/api/auth/register").send(user);
      const verifyRes = await request(app.getHttpServer())
        .post("/api/auth/verify-otp")
        .send({ phone: user.phone, otp: capturedOtp });

      const { accessToken, refreshToken } = verifyRes.body as {
        accessToken: string;
        refreshToken: string;
      };

      const logoutRes = await request(app.getHttpServer())
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(logoutRes.status).toBe(200);

      // Refresh token should now be invalid
      const refreshRes = await request(app.getHttpServer())
        .post("/api/auth/refresh")
        .send({ refreshToken });
      expect(refreshRes.status).toBe(401);
    });

    it("401 → logout without token", async () => {
      const res = await request(app.getHttpServer()).post("/api/auth/logout");
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/auth/resend-otp ─────────────────────────────────────────────────

  describe("POST /api/auth/resend-otp", () => {
    it("200 → resends OTP for pending user", async () => {
      const user = newUser();
      await request(app.getHttpServer()).post("/api/auth/register").send(user);
      const firstOtp = capturedOtp;

      const res = await request(app.getHttpServer())
        .post("/api/auth/resend-otp")
        .send({ phone: user.phone });

      expect(res.status).toBe(200);
      // A new OTP was dispatched (different from the first)
      expect(capturedOtp).not.toBe(firstOtp);
    });

    it("400 → already verified user", async () => {
      const user = newUser();
      await request(app.getHttpServer()).post("/api/auth/register").send(user);
      await request(app.getHttpServer())
        .post("/api/auth/verify-otp")
        .send({ phone: user.phone, otp: capturedOtp });

      const res = await request(app.getHttpServer())
        .post("/api/auth/resend-otp")
        .send({ phone: user.phone });

      expect(res.status).toBe(400);
    });
  });
});
