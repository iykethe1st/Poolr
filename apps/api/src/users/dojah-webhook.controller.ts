import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBody,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { DojahService } from './dojah.service';
import { UsersService } from './users.service';

@Controller('webhooks')
export class DojahWebhookController {
  private readonly logger = new Logger(DojahWebhookController.name);

  constructor(
    private readonly dojah: DojahService,
    private readonly users: UsersService,
  ) {}

  @Post('dojah')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handle(
    @RawBody() rawBody: Buffer,
    @Headers('x-dojah-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!this.dojah.verifyWebhookSignature(rawBody, signature ?? '')) {
      this.logger.warn('Dojah webhook: invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    const { userId, verificationStatus, fullName } = this.dojah.parseWebhookPayload(rawBody);

    if (userId) {
      this.logger.log(`Dojah webhook: userId=${userId} status=${verificationStatus} fullName=${fullName ?? '(none)'}`);
      await this.users.handleDojahWebhook(userId, verificationStatus, fullName);
    } else {
      this.logger.warn('Dojah webhook received without user_id in metadata — skipping');
    }

    return { received: true };
  }
}
