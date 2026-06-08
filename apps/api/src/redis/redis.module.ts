import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: (config: ConfigService) => {
        const logger = new Logger('RedisModule');
        const redis = new Redis(config.getOrThrow<string>('REDIS_URL'), {
          lazyConnect: true,
          maxRetriesPerRequest: null,
        });
        redis.on('connect', () => logger.log('Redis connected'));
        redis.on('error', (err: Error) => logger.error(`Redis error: ${err.message}`));
        return redis;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
