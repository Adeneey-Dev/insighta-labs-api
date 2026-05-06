import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private readonly DEFAULT_TTL = 300; // 5 minutes in seconds

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — caching is disabled, all queries go direct to DB',
      );
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        tls: redisUrl.includes('leapcell.cloud') ? {} : undefined,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        connectTimeout: 5000,
        lazyConnect: false,
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connected successfully');
      });

      this.client.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.logger.warn('Redis connection closed');
      });
    } catch (err: any) {
      this.logger.error(`Failed to initialize Redis: ${err.message}`);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  /**
   * Get a cached value by key.
   * Returns null if key doesn't exist or Redis is unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err: any) {
      this.logger.warn(`Cache GET failed for key "${key}": ${err.message}`);
      return null;
    }
  }

  /**
   * Store a value in cache with optional TTL (default 5 minutes).
   * Silently fails if Redis is unavailable — the app continues without cache.
   */
  async set(
    key: string,
    value: any,
    ttlSeconds = this.DEFAULT_TTL,
  ): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err: any) {
      this.logger.warn(`Cache SET failed for key "${key}": ${err.message}`);
    }
  }

  /**
   * Delete all keys matching a pattern.
   * Used to invalidate the profiles cache on any write.
   *
   * We use SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.client) return;

    try {
      let cursor = '0';
      let deleted = 0;

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');

      if (deleted > 0) {
        this.logger.log(
          `Cache invalidated: deleted ${deleted} keys matching "${pattern}"`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Cache invalidation failed for pattern "${pattern}": ${err.message}`,
      );
    }
  }

  /**
   * Invalidate all profile-related cache entries.
   * Called after any write (create or CSV import).
   */
  async invalidateProfiles(): Promise<void> {
    await this.invalidatePattern('profiles:*');
    await this.invalidatePattern('search:*');
  }

  isAvailable(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }
}
