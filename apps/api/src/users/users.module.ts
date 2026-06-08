import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SmileIdService } from './smile-id.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, SmileIdService],
  exports: [UsersService],
})
export class UsersModule {}
