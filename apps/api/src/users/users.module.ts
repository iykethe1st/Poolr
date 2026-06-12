import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DojahService } from './dojah.service';
import { DojahWebhookController } from './dojah-webhook.controller';

@Module({
  controllers: [UsersController, DojahWebhookController],
  providers: [UsersService, DojahService],
  exports: [UsersService],
})
export class UsersModule {}
