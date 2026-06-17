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
        const raw = config.getOrThrow<string>('REDIS_URL');
        const parsed = new URL(raw);
        const tls = parsed.protocol === 'rediss:';
        const redis = new Redis({
          host: parsed.hostname,
          port: Number(parsed.port) || (tls ? 6380 : 6379),
          password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
          ...(tls ? { tls: {} } : {}),
          lazyConnect: true,
          maxRetriesPerRequest: null,
          enableOfflineQueue: true,
          retryStrategy: (times: number) => Math.min(times * 200, 5_000),
          reconnectOnError: () => true,
          keepAlive: 30_000,
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
