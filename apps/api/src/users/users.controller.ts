import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyKycDto } from './dto/verify-kyc.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile (name, avatar)' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('fcm-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register FCM push token' })
  updateFcmToken(@CurrentUser() user: AuthUser, @Body() dto: UpdateFcmTokenDto) {
    return this.users.updateFcmToken(user.id, dto.token);
  }

  @Post('kyc/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm Dojah KYC after widget success callback' })
  verifyKyc(@CurrentUser() user: AuthUser, @Body() dto: VerifyKycDto) {
    return this.users.verifyDojahKyc(user.id, dto.referenceId);
  }

  @Get('me/trust-score')
  @ApiOperation({ summary: 'Get own trust score, tier, and recent score history' })
  getMyTrustScore(@CurrentUser() user: AuthUser) {
    return this.users.getTrustScoreDetail(user.id);
  }

  @Get(':id/trust-score')
  @ApiOperation({ summary: 'Get another user trust score and tier (public — no event history)' })
  async getUserTrustScore(@Param('id') id: string) {
    const detail = await this.users.getTrustScoreDetail(id);
    return { score: detail.score, tier: detail.tier };
  }
}
