import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
