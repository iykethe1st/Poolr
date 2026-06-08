import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TermiiService } from './termii.service';

// Replace native bcrypt with pure-JS mocks so jest.fn() can intercept calls.
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as { hash: jest.Mock; compare: jest.Mock };

const MOCK_USER = {
  id: 'user-1',
  fullName: 'Amara Obi',
  email: 'amara@example.com',
  phone: '+2348012345678',
  passwordHash: '$2b$10$hashed',
  role: 'USER',
  status: 'PENDING_VERIFICATION',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ACTIVE_USER = { ...MOCK_USER, status: 'ACTIVE' };

function makePrismaMock() {
  const txClient = {
    user: { create: jest.fn().mockResolvedValue(MOCK_USER) },
    wallet: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue(ACTIVE_USER),
      update: jest.fn().mockResolvedValue(ACTIVE_USER),
    },
    $: {
      $transaction: jest
        .fn()
        .mockImplementation((fn: (tx: typeof txClient) => unknown) => fn(txClient)),
    },
  };
}

function makeRedisMock() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

function makeConfigMock() {
  const values: Record<string, string> = {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '30d',
  };
  return {
    getOrThrow: jest.fn((key: string) => {
      const v = values[key];
      if (!v) throw new Error(`Missing env: ${key}`);
      return v;
    }),
    get: jest.fn((key: string, def?: string) => values[key] ?? def),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let termii: { sendOtp: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    redis = makeRedisMock();
    jwtService = { sign: jest.fn().mockReturnValue('mock.jwt.token'), verify: jest.fn() };
    termii = { sendOtp: jest.fn().mockResolvedValue(undefined) };

    bcrypt.hash.mockResolvedValue('$hashed$');
    bcrypt.compare.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: makeConfigMock() },
        { provide: RedisService, useValue: redis },
        { provide: TermiiService, useValue: termii },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── register ─────────────────────────────────────────────────────────────────

  describe('register', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
    });

    it('creates user + wallet and sends OTP', async () => {
      const result = await service.register({
        fullName: 'Amara Obi',
        email: 'amara@example.com',
        phone: '+2348012345678',
        password: 'password123',
      });

      expect(result.message).toMatch(/OTP/);
      expect(termii.sendOtp).toHaveBeenCalledWith(MOCK_USER.phone, expect.any(String));
      expect(redis.set).toHaveBeenCalledWith(`otp:${MOCK_USER.phone}`, expect.any(String), 600);
    });

    it('throws ConflictException on duplicate email', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(MOCK_USER)
        .mockResolvedValueOnce(null);
      await expect(
        service.register({ fullName: 'X', email: 'amara@example.com', phone: '+1', password: 'pass1234' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws ConflictException on duplicate phone', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MOCK_USER);
      await expect(
        service.register({ fullName: 'X', email: 'new@x.com', phone: '+2348012345678', password: 'pass1234' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── verifyOtp ─────────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('activates account and issues tokens for correct OTP', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      redis.get.mockResolvedValue('$otp_hash$');
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.verifyOtp({ phone: MOCK_USER.phone, otp: '123456' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ACTIVE' } }),
      );
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws BadRequestException when OTP expired', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      redis.get.mockResolvedValue(null);
      await expect(service.verifyOtp({ phone: MOCK_USER.phone, otp: '000000' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException for wrong OTP', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      redis.get.mockResolvedValue('$otp_hash$');
      bcrypt.compare.mockResolvedValue(false);
      await expect(service.verifyOtp({ phone: MOCK_USER.phone, otp: '000000' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws NotFoundException for unknown phone', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.verifyOtp({ phone: '+9999', otp: '123456' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when account already active', async () => {
      prisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
      await expect(service.verifyOtp({ phone: MOCK_USER.phone, otp: '123456' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('issues tokens for valid active user', async () => {
      prisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.login({ email: ACTIVE_USER.email, password: 'pass123!' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(ACTIVE_USER.email);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
      bcrypt.compare.mockResolvedValue(false);
      await expect(service.login({ email: ACTIVE_USER.email, password: 'wrong' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'nobody@x.com', password: 'pass1234' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for PENDING_VERIFICATION account', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      bcrypt.compare.mockResolvedValue(true);
      await expect(service.login({ email: MOCK_USER.email, password: 'pass' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException for SUSPENDED account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, status: 'SUSPENDED' });
      bcrypt.compare.mockResolvedValue(true);
      await expect(service.login({ email: ACTIVE_USER.email, password: 'pass' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    const REFRESH_TOKEN = 'valid.refresh.token';

    beforeEach(() => {
      jwtService.verify.mockReturnValue({
        sub: ACTIVE_USER.id,
        type: 'refresh',
        iat: 0,
        exp: 9_999_999_999,
      });
    });

    it('rotates tokens on valid refresh', async () => {
      const hash = createHash('sha256').update(REFRESH_TOKEN).digest('hex');
      redis.get.mockResolvedValue(hash);

      const result = await service.refresh({ refreshToken: REFRESH_TOKEN });

      expect(redis.del).toHaveBeenCalledWith(`refresh:${ACTIVE_USER.id}`);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws UnauthorizedException for invalid JWT', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      await expect(service.refresh({ refreshToken: 'bad' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when session not found in Redis', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.refresh({ refreshToken: REFRESH_TOKEN })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('deletes session and throws on token reuse', async () => {
      redis.get.mockResolvedValue('different-hash');
      await expect(service.refresh({ refreshToken: REFRESH_TOKEN })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(redis.del).toHaveBeenCalledWith(`refresh:${ACTIVE_USER.id}`);
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('removes refresh token from Redis', async () => {
      const result = await service.logout(ACTIVE_USER.id);
      expect(redis.del).toHaveBeenCalledWith(`refresh:${ACTIVE_USER.id}`);
      expect(result.message).toMatch(/logged out/i);
    });
  });

  // ── resendOtp ─────────────────────────────────────────────────────────────────

  describe('resendOtp', () => {
    it('sends a new OTP for pending user', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      const result = await service.resendOtp({ phone: MOCK_USER.phone });
      expect(termii.sendOtp).toHaveBeenCalled();
      expect(result.message).toMatch(/OTP resent/i);
    });

    it('throws NotFoundException for unknown phone', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resendOtp({ phone: '+9999' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when already active', async () => {
      prisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
      await expect(service.resendOtp({ phone: ACTIVE_USER.phone })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
