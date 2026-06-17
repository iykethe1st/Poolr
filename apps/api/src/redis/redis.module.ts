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
        const redisUrl = config.getOrThrow<string>('REDIS_URL');
        const tls = redisUrl.startsWith('rediss://');
        const redis = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: null,
          enableOfflineQueue: true,
          retryStrategy: (times: number) => Math.min(times * 200, 5_000),
          reconnectOnError: () => true,
          keepAlive: 30_000,
          ...(tls ? { tls: {} } : {}),
        });
        redis.on('connect', () => logger.log('Redis connected'));
        redis.on('error', (err: Error) => logger.error(`Redis error: ${err.message || String(err)}`));
        // Swallow EPIPE/ECONNRESET at the socket level — ioredis will reconnect automatically
        redis.on('close', () => logger.warn('Redis connection closed, reconnecting…'));
        return redis;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
