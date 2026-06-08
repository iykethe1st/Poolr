import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { KycStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';
import { SmileIdService } from './smile-id.service';

const MOCK_USER = {
  id: 'user-1',
  fullName: 'Amara Obi',
  email: 'amara@example.com',
  phone: '+2348012345678',
  passwordHash: '$2b$10$hashed',
  avatarUrl: null,
  role: 'USER',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  kycProfile: null,
};

const MOCK_KYC = {
  id: 'kyc-1',
  userId: 'user-1',
  bvn: '12345678901',
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
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
}

function makeSmileIdMock() {
  return {
    verifyIdentity: jest.fn().mockResolvedValue('VERIFIED'),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let smileId: ReturnType<typeof makeSmileIdMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    smileId = makeSmileIdMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmileIdService, useValue: smileId },
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

  // ── submitKyc ────────────────────────────────────────────────────────────────

  describe('submitKyc', () => {
    const KYC_DTO = { bvn: '12345678901', dateOfBirth: '1990-01-15' };

    it('creates KYC profile as VERIFIED on success', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      smileId.verifyIdentity.mockResolvedValue('VERIFIED');
      prisma.kycProfile.upsert.mockResolvedValue({
        ...MOCK_KYC,
        kycStatus: KycStatus.VERIFIED,
        kycAttempts: 1,
        verifiedAt: new Date(),
      });

      const result = await service.submitKyc('user-1', KYC_DTO);
      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
      expect(result.message).toMatch(/verified/i);
    });

    it('creates KYC profile as REJECTED on failure', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      smileId.verifyIdentity.mockResolvedValue('REJECTED');
      prisma.kycProfile.upsert.mockResolvedValue({
        ...MOCK_KYC,
        kycStatus: KycStatus.REJECTED,
        kycAttempts: 1,
      });

      const result = await service.submitKyc('user-1', KYC_DTO);
      expect(result.kycStatus).toBe(KycStatus.REJECTED);
      expect(result.message).toMatch(/attempt/i);
    });

    it('allows retry when REJECTED with attempts < 3', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        kycProfile: { ...MOCK_KYC, kycStatus: KycStatus.REJECTED, kycAttempts: 2 },
      });
      smileId.verifyIdentity.mockResolvedValue('VERIFIED');
      prisma.kycProfile.upsert.mockResolvedValue({
        ...MOCK_KYC,
        kycStatus: KycStatus.VERIFIED,
        kycAttempts: 3,
        verifiedAt: new Date(),
      });

      const result = await service.submitKyc('user-1', KYC_DTO);
      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
    });

    it('blocks submission when VERIFIED', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        kycProfile: { ...MOCK_KYC, kycStatus: KycStatus.VERIFIED, kycAttempts: 1 },
      });

      await expect(service.submitKyc('user-1', KYC_DTO)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks submission when UNDER_REVIEW', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        kycProfile: { ...MOCK_KYC, kycStatus: KycStatus.UNDER_REVIEW, kycAttempts: 1 },
      });

      await expect(service.submitKyc('user-1', KYC_DTO)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks submission when REJECTED with attempts >= 3', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...MOCK_USER,
        kycProfile: { ...MOCK_KYC, kycStatus: KycStatus.REJECTED, kycAttempts: 3 },
      });

      await expect(service.submitKyc('user-1', KYC_DTO)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException for unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.submitKyc('unknown', KYC_DTO)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('passes NIN when bvn is absent', async () => {
      prisma.user.findUnique.mockResolvedValue(MOCK_USER);
      smileId.verifyIdentity.mockResolvedValue('VERIFIED');
      prisma.kycProfile.upsert.mockResolvedValue({
        ...MOCK_KYC,
        kycStatus: KycStatus.VERIFIED,
        kycAttempts: 1,
      });

      await service.submitKyc('user-1', { nin: '98765432101', dateOfBirth: '1990-01-15' });

      expect(smileId.verifyIdentity).toHaveBeenCalledWith(
        expect.objectContaining({ idType: 'NIN', idNumber: '98765432101' }),
      );
    });
  });
});
