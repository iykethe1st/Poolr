import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { HealthController } from './health/health.controller';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),

    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    GroupsModule,

    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port) || 6379,
            ...(redisUrl.password ? { password: redisUrl.password } : {}),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
