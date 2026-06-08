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
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('x-paystack-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const secret = this.config.get<string>('PAYSTACK_WEBHOOK_SECRET', '');

    if (secret) {
      const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
      if (expected !== signature) {
        this.logger.warn('Paystack webhook: invalid HMAC signature');
        throw new BadRequestException('Invalid signature');
      }
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      data: Record<string, unknown>;
    };

    await this.payments.handleWebhook(payload.event, payload.data);

    return { received: true };
  }
}
