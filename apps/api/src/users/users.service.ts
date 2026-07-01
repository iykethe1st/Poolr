import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KycStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DojahService } from './dojah.service';
import { DefaultProtectionService } from '../protection/default-protection.service';
import {
  NOTIFICATION_EVENTS,
  KycApprovedEvent,
  KycRejectedEvent,
} from '../notifications/events/notification.events';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { getTier, getMaxSlotsEligible, TrustScoreService } from './trust-score.service';

const MAX_KYC_ATTEMPTS = 3;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dojah: DojahService,
    private readonly eventEmitter: EventEmitter2,
    private readonly defaultProtection: DefaultProtectionService,
    private readonly trustScore: TrustScoreService,
  ) {}

  async getProfile(userId: string) {
    const [user, paidContribs, totalPenalties] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { kycProfile: true } }),
      this.prisma.contribution.findMany({
        where: { member: { userId }, status: 'PAID' },
        select: { paidAt: true, dueAt: true },
      }),
      this.prisma.penalty.count({ where: { member: { userId }, status: 'APPLIED' } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    const totalPaid = paidContribs.length;
    const onTimePaid = paidContribs.filter((c) => c.paidAt && c.paidAt <= c.dueAt).length;
    const onTimeRate = totalPaid > 0 ? Math.round((onTimePaid / totalPaid) * 100) : 0;
    const tier = getTier(user.trustScore);
    const maxSlotsEligible = getMaxSlotsEligible(user.trustScore);
    const { passwordHash: _pw, ...profile } = user;
    return {
      ...profile,
      contributionStats: { tier, totalPaid, onTimePaid, onTimeRate, totalPenalties, trustScore: user.trustScore, maxSlotsEligible },
    };
  }

  async getTrustScoreDetail(userId: string) {
    return this.trustScore.getScoreDetail(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data['fullName'] = dto.fullName;
    if (dto.avatarUrl !== undefined) data['avatarUrl'] = dto.avatarUrl;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { kycProfile: true },
    });
    const { passwordHash: _pw, ...profile } = user;
    return profile;
  }

  async updateFcmToken(userId: string, token: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { fcmToken: token } });
    return { message: 'FCM token updated' };
  }

  async verifyDojahKyc(userId: string, referenceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kycProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const kyc = user.kycProfile;

    if (kyc?.kycStatus === KycStatus.VERIFIED) {
      throw new ForbiddenException('Identity already verified');
    }
    if (kyc?.kycStatus === KycStatus.REJECTED && (kyc.kycAttempts ?? 0) >= MAX_KYC_ATTEMPTS) {
      throw new ForbiddenException('Maximum KYC attempts reached. Contact support.');
    }

    const result = await this.dojah.getVerificationDetails(referenceId);

    let newStatus: KycStatus;
    if (result.verificationStatus === 'Completed') {
      newStatus = KycStatus.VERIFIED;
    } else if (result.verificationStatus === 'Failed') {
      newStatus = KycStatus.REJECTED;
    } else {
      newStatus = KycStatus.UNDER_REVIEW;
    }

    const updated = await this.prisma.kycProfile.upsert({
      where: { userId },
      create: {
        userId,
        kycStatus: newStatus,
        kycAttempts: 1,
        verifiedAt: newStatus === KycStatus.VERIFIED ? new Date() : null,
      },
      update: {
        kycStatus: newStatus,
        kycAttempts: { increment: 1 },
        verifiedAt: newStatus === KycStatus.VERIFIED ? new Date() : undefined,
      },
    });

    if (newStatus === KycStatus.VERIFIED) {
      // Check if this identity was previously flagged (banned user attempting re-registration)
      const kycNow = await this.prisma.kycProfile.findUnique({ where: { userId } });
      const isFlagged = await this.defaultProtection.isFlaggedIdentity(kycNow?.bvn, kycNow?.nin);
      if (isFlagged) {
        await this.prisma.user.update({ where: { id: userId }, data: { status: 'BANNED' as never } });
        const attemptsLeft = Math.max(0, MAX_KYC_ATTEMPTS - updated.kycAttempts);
        return {
          kycStatus: 'REJECTED' as KycStatus,
          kycAttempts: updated.kycAttempts,
          message: `Verification failed. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
        };
      }

      const evt: KycApprovedEvent = { userId: user.id, email: user.email, fullName: user.fullName };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.KYC_APPROVED, evt);
    } else if (newStatus === KycStatus.REJECTED) {
      const evt: KycRejectedEvent = { userId: user.id, email: user.email, fullName: user.fullName };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.KYC_REJECTED, evt);
    }

    const attemptsLeft = Math.max(0, MAX_KYC_ATTEMPTS - updated.kycAttempts);
    return {
      kycStatus: updated.kycStatus,
      kycAttempts: updated.kycAttempts,
      message:
        newStatus === KycStatus.VERIFIED
          ? 'Identity verified successfully'
          : newStatus === KycStatus.REJECTED
          ? `Verification failed. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`
          : 'Verification submitted. Your identity is being reviewed.',
    };
  }

  async handleDojahWebhook(userId: string, verificationStatus: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kycProfile: true },
    });
    if (!user) return;

    let newStatus: KycStatus;
    if (verificationStatus === 'Completed') {
      newStatus = KycStatus.VERIFIED;
    } else if (verificationStatus === 'Failed') {
      newStatus = KycStatus.REJECTED;
    } else {
      return;
    }

    if (user.kycProfile?.kycStatus === KycStatus.VERIFIED) return;

    await this.prisma.kycProfile.upsert({
      where: { userId },
      create: {
        userId,
        kycStatus: newStatus,
        kycAttempts: 1,
        verifiedAt: newStatus === KycStatus.VERIFIED ? new Date() : null,
      },
      update: {
        kycStatus: newStatus,
        verifiedAt: newStatus === KycStatus.VERIFIED ? new Date() : undefined,
      },
    });

    if (newStatus === KycStatus.VERIFIED) {
      const evt: KycApprovedEvent = { userId: user.id, email: user.email, fullName: user.fullName };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.KYC_APPROVED, evt);
    } else {
      const evt: KycRejectedEvent = { userId: user.id, email: user.email, fullName: user.fullName };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.KYC_REJECTED, evt);
    }
  }
}
