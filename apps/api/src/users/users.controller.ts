import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

function imageFilter(_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) {
  if (/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) cb(null, true);
  else cb(new BadRequestException('Only JPEG, PNG and WebP images are allowed'), false);
}

function docFilter(_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) {
  if (/^(image\/(jpeg|jpg|png)|application\/pdf)$/.test(file.mimetype)) cb(null, true);
  else cb(new BadRequestException('Only JPEG, PNG and PDF files are allowed'), false);
}

const memStore = memoryStorage();

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

  @Post('kyc')
  @HttpCode(200)
  @ApiOperation({ summary: 'Submit BVN or NIN for identity verification' })
  submitKyc(@CurrentUser() user: AuthUser, @Body() dto: SubmitKycDto) {
    return this.users.submitKyc(user.id, dto);
  }

  @Post('kyc/selfie')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload selfie photo for KYC (JPEG / PNG / WebP, max 5 MB)' })
  @UseInterceptors(FileInterceptor('file', { storage: memStore, limits: { fileSize: MAX_FILE_BYTES }, fileFilter: imageFilter }))
  uploadSelfie(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.users.saveKycFile(user.id, 'selfie', file);
  }

  @Post('kyc/document')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload ID document for KYC (JPEG / PNG / PDF, max 5 MB)' })
  @UseInterceptors(FileInterceptor('file', { storage: memStore, limits: { fileSize: MAX_FILE_BYTES }, fileFilter: docFilter }))
  uploadDocument(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.users.saveKycFile(user.id, 'document', file);
  }
}
