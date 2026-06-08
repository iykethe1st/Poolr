import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TermiiService } from './termii.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { ResendOtpDto } from './dto/resend-otp.dto';
import type { JwtRefreshPayload } from './interfaces/jwt-payload.interface';

interface TokenUser {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly termii: TermiiService,
  ) {}

  async register(dto: RegisterDto) {
    const [byEmail, byPhone] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.user.findUnique({ where: { phone: dto.phone } }),
    ]);
    if (byEmail) throw new ConflictException('Email already registered');
    if (byPhone) throw new ConflictException('Phone already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$.$transaction(async (tx: Prisma.TransactionClient) => {
      const u = await tx.user.create({
        data: { fullName: dto.fullName, email: dto.email, phone: dto.phone, passwordHash },
      });
      await tx.wallet.create({ data: { userId: u.id } });
      return u;
    });

    await this.dispatchOtp(user.phone);

    return { message: 'Account created. Enter the OTP sent to your phone.' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) throw new NotFoundException('Phone number not found');
    if (user.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Phone already verified');
    }

    const stored = await this.redis.get(`otp:${dto.phone}`);
    if (!stored) throw new BadRequestException('OTP expired. Request a new one.');

    const valid = await bcrypt.compare(dto.otp, stored);
    if (!valid) throw new BadRequestException('Incorrect OTP');

    await Promise.all([
      this.redis.del(`otp:${dto.phone}`),
      this.prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } }),
    ]);

    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    if (user.status === 'PENDING_VERIFICATION') {
      throw new UnauthorizedException('Phone not verified. Check your SMS for the OTP.');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account suspended. Contact support.');
    }

    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwt.verify<JwtRefreshPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const stored = await this.redis.get(`refresh:${payload.sub}`);
    if (!stored) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    if (stored !== hashToken(dto.refreshToken)) {
      // Reuse detected — nuke the session
      await this.redis.del(`refresh:${payload.sub}`);
      throw new UnauthorizedException('Token reuse detected. Please log in again.');
    }

    await this.redis.del(`refresh:${payload.sub}`);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }

  async logout(userId: string) {
    await this.redis.del(`refresh:${userId}`);
    return { message: 'Logged out successfully' };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) throw new NotFoundException('Phone number not found');
    if (user.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Phone already verified');
    }

    await this.dispatchOtp(dto.phone);
    return { message: 'OTP resent. Check your phone.' };
  }

  private async issueTokens(user: TokenUser) {
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: parseTtlSeconds(this.config.get('JWT_EXPIRES_IN', '15m')),
      },
    );

    const refreshExpiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '30d');
    const refreshToken = this.jwt.sign(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: parseTtlSeconds(refreshExpiresIn),
      },
    );

    await this.redis.set(
      `refresh:${user.id}`,
      hashToken(refreshToken),
      parseTtlSeconds(refreshExpiresIn),
    );

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  private async dispatchOtp(phone: string): Promise<void> {
    const otp = Math.floor(100_000 + Math.random() * 900_000).toString();
    const hash = await bcrypt.hash(otp, 10);
    await this.redis.set(`otp:${phone}`, hash, 600); // 10 minutes
    await this.termii.sendOtp(phone, otp);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseTtlSeconds(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) return 2_592_000;
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(m[1], 10) * (multipliers[m[2]] ?? 86400);
}
