import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KycStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';
import { DojahService } from './dojah.service';
import { DefaultProtectionService } from '../protection/default-protection.service';
import { TrustScoreService } from './trust-score.service';

const MOCK_USER = {
  id: 'user-1',
  fullName: 'Amara Obi',
  email: 'amara@example.com',
  phone: '+2348012345678',
  passwordHash: '$2b$10$hashed',
  avatarUrl: null,
  fcmToken: null,
  role: 'USER',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  kycProfile: null,
};

const MOCK_KYC = {
  id: 'kyc-1',
  userId: 'user-1',
  bvn: null,
  nin: null,
  selfieUrl: null,
  idDocUrl: null,
  kycStatus: KycStatus.PENDING,
  kycAttempts: 0,
  verifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    kycProfile: {
      upsert: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(MOCK_KYC),
    },
  };
}

function makeDojahMock() {
  return {
    getVerificationDetails: jest.fn().mockResolvedValue({
      verificationStatus: 'Completed',
      referenceId: 'DJ-TEST001',
    }),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let dojah: ReturnType<typeof makeDojahMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    dojah = makeDojahMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: DojahService, useValue: dojah },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: DefaultProtectionService, useValue: { isFlaggedIdentity: jest.fn().mockResolvedValue(false) } },
        { provide: TrustScoreService, useValue: { getScoreDetail: jest.fn() } },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getProfile ───────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns user without passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      const result = await service.getProfile('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe(MOCK_USER.email);
    });

    it('throws NotFoundException for unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('unknown')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── updateProfile ────────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates fullName and returns profile without passwordHash', async () => {
      const updated = { ...MOCK_USER, fullName: 'New Name' };
      prisma.user.update.mockResolvedValue(updated);
      const result = await service.updateProfile('user-1', { fullName: 'New Name' });
      expect(result.fullName).toBe('New Name');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('updates avatarUrl', async () => {
      const updated = { ...MOCK_USER, avatarUrl: 'https://cdn.example.com/avatar.jpg' };
      prisma.user.update.mockResolvedValue(updated);
      const result = await service.updateProfile('user-1', {
        avatarUrl: 'https://cdn.example.com/avatar.jpg',
      });
      expect(result.avatarUrl).toBe('https://cdn.example.com/avatar.jpg');
    });
  });

  // ── verifyDojahKyc ───────────────────────────────────────────────────────────

  describe('verifyDojahKyc', () => {
    const REF = 'DJ-TEST001';

    it('sets VERIFIED when Dojah returns Completed', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      dojah.getVerificationDetails.mockResolvedValue({ verificationStatus: 'Completed', referenceId: REF });
      prisma.kycProfile.upsert.mockResolvedValue({ ...MOCK_KYC, kycStatus: KycStatus.VERIFIED, kycAttempts: 1, verifiedAt: new Date() });

      const result = await service.verifyDojahKyc('user-1', REF);
      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
      expect(result.message).toMatch(/verified/i);
    });

    it('sets VERIFIED when Dojah returns Successful', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      dojah.getVerificationDetails.mockResolvedValue({ verificationStatus: 'Successful', referenceId: REF });
      prisma.kycProfile.upsert.mockResolvedValue({ ...MOCK_KYC, kycStatus: KycStatus.VERIFIED, kycAttempts: 1, verifiedAt: new Date() });

      const result = await service.verifyDojahKyc('user-1', REF);
      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
      expect(result.message).toMatch(/verified/i);
    });

    it('sets REJECTED when Dojah returns Failed', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      dojah.getVerificationDetails.mockResolvedValue({ verificationStatus: 'Failed', referenceId: REF });
      prisma.kycProfile.upsert.mockResolvedValue({ ...MOCK_KYC, kycStatus: KycStatus.REJECTED, kycAttempts: 1 });

      const result = await service.verifyDojahKyc('user-1', REF);
      expect(result.kycStatus).toBe(KycStatus.REJECTED);
      expect(result.message).toMatch(/attempt/i);
    });

    it('sets UNDER_REVIEW for intermediate Dojah statuses', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      dojah.getVerificationDetails.mockResolvedValue({ verificationStatus: 'Ongoing', referenceId: REF });
      prisma.kycProfile.upsert.mockResolvedValue({ ...MOCK_KYC, kycStatus: KycStatus.UNDER_REVIEW, kycAttempts: 1 });

      const result = await service.verifyDojahKyc('user-1', REF);
      expect(result.kycStatus).toBe(KycStatus.UNDER_REVIEW);
    });

    it('blocks when already VERIFIED', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        kycProfile: { ...MOCK_KYC, kycStatus: KycStatus.VERIFIED, kycAttempts: 1 },
      });
      await expect(service.verifyDojahKyc('user-1', REF)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks when REJECTED with max attempts reached', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        kycProfile: { ...MOCK_KYC, kycStatus: KycStatus.REJECTED, kycAttempts: 3 },
      });
      await expect(service.verifyDojahKyc('user-1', REF)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows retry when REJECTED with attempts < 3', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        kycProfile: { ...MOCK_KYC, kycStatus: KycStatus.REJECTED, kycAttempts: 2 },
      });
      dojah.getVerificationDetails.mockResolvedValue({ verificationStatus: 'Completed', referenceId: REF });
      prisma.kycProfile.upsert.mockResolvedValue({ ...MOCK_KYC, kycStatus: KycStatus.VERIFIED, kycAttempts: 3, verifiedAt: new Date() });

      const result = await service.verifyDojahKyc('user-1', REF);
      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
    });

    it('throws NotFoundException for unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.verifyDojahKyc('unknown', REF)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
