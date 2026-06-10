import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KycStatus } from '@prisma/client';
import type { Express } from 'express';
import { PrismaService } from '../database/prisma.service';
import { SmileIdService } from './smile-id.service';
import {
  NOTIFICATION_EVENTS,
  KycApprovedEvent,
  KycRejectedEvent,
} from '../notifications/events/notification.events';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { SubmitKycDto } from './dto/submit-kyc.dto';

const MAX_KYC_ATTEMPTS = 3;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smileId: SmileIdService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kycProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _pw, ...profile } = user;
    return profile;
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

  async saveKycFile(userId: string, kind: 'selfie' | 'document', file: Express.Multer.File) {
    const dir = join(process.cwd(), 'uploads', 'kyc', userId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const filename = `${kind}-${Date.now()}${extname(file.originalname) || '.jpg'}`;
    const dest = join(dir, filename);
    writeFileSync(dest, file.buffer);

    const url = `/uploads/kyc/${userId}/${filename}`;
    const data = kind === 'selfie' ? { selfieUrl: url } : { idDocUrl: url };

    await this.prisma.kycProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return { url };
  }

  async updateFcmToken(userId: string, token: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { fcmToken: token } });
    return { message: 'FCM token updated' };
  }

  async submitKyc(userId: string, dto: SubmitKycDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kycProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const kyc = user.kycProfile;

    if (kyc) {
      if (kyc.kycStatus === KycStatus.UNDER_REVIEW) {
        throw new ForbiddenException('KYC verification is under review');
      }
      if (kyc.kycStatus === KycStatus.VERIFIED) {
        throw new ForbiddenException('Identity already verified');
      }
      if (kyc.kycStatus === KycStatus.REJECTED && kyc.kycAttempts >= MAX_KYC_ATTEMPTS) {
        throw new ForbiddenException('Maximum KYC attempts reached. Contact support.');
      }
    }

    const idType = dto.bvn ? 'BVN' : 'NIN';
    const idNumber = (dto.bvn ?? dto.nin)!;
    const [firstName, ...rest] = user.fullName.trim().split(' ');
    const lastName = rest.join(' ') || firstName;

    const result = await this.smileId.verifyIdentity({
      idType,
      idNumber,
      firstName,
      lastName,
      dateOfBirth: dto.dateOfBirth,
    });

    const newStatus = result === 'VERIFIED' ? KycStatus.VERIFIED : KycStatus.REJECTED;

    const updated = await this.prisma.kycProfile.upsert({
      where: { userId },
      create: {
        userId,
        bvn: dto.bvn ?? null,
        nin: dto.nin ?? null,
        kycStatus: newStatus,
        kycAttempts: 1,
        verifiedAt: newStatus === KycStatus.VERIFIED ? new Date() : null,
      },
      update: {
        bvn: dto.bvn ?? undefined,
        nin: dto.nin ?? undefined,
        kycStatus: newStatus,
        kycAttempts: { increment: 1 },
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

    return {
      kycStatus: updated.kycStatus,
      kycAttempts: updated.kycAttempts,
      message:
        newStatus === KycStatus.VERIFIED
          ? 'Identity verified successfully'
          : `Verification failed. ${MAX_KYC_ATTEMPTS - updated.kycAttempts} attempt(s) remaining.`,
    };
  }
}
