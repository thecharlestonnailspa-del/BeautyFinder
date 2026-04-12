import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'redis';

type RedisHealth = {
  configured: boolean;
  status: 'disabled' | 'fallback' | 'up';
  reason?: string;
  target?: string;
};

type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisUrl = process.env.REDIS_URL?.trim();
  private clientPromise?: Promise<RedisClient | null>;
  private readonly memoryCache = new Map<string, { value: string; expiresAt: number }>();
  private readonly memoryNamespaceVersions = new Map<string, number>();
  private lastConnectionFailure?: string;

  private getRedisTarget() {
    if (!this.redisUrl) {
      return undefined;
    }

    try {
      const parsed = new URL(this.redisUrl);
      return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    } catch {
      return undefined;
    }
  }

  private pruneExpiredMemoryCache() {
    const now = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  private readMemoryCache<T>(key: string) {
    this.pruneExpiredMemoryCache();
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return null;
    }

    return (JSON.parse(entry.value) as { value: T }).value;
  }

  private writeMemoryCache(key: string, ttlSeconds: number, value: unknown) {
    this.memoryCache.set(key, {
      value: JSON.stringify({ value }),
      expiresAt: Date.now() + ttlSeconds * 1_000,
    });
  }

  private getFallbackReason(defaultReason: string) {
    const normalized = this.lastConnectionFailure?.trim();
    return normalized ? normalized : defaultReason;
  }

  private async getClient() {
    if (!this.redisUrl) {
      return null;
    }

    if (!this.clientPromise) {
      const client = createClient({
        url: this.redisUrl,
        socket: {
          connectTimeout: 1_000,
          reconnectStrategy: false,
        },
      });

      client.on('error', () => undefined);
      this.clientPromise = client
        .connect()
        .then(() => {
          this.lastConnectionFailure = undefined;
          return client;
        })
        .catch(async (error) => {
          this.clientPromise = undefined;
          this.lastConnectionFailure =
            error instanceof Error ? error.message : 'Redis connection failed';

          if (client.isOpen) {
            await client.quit().catch(() => undefined);
          }

          return null;
        });
    }

    return this.clientPromise;
  }

  private getNamespaceVersionKey(namespace: string) {
    return `beauty-finder:cache-version:${namespace}`;
  }

  async rememberJson<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();

    if (client) {
      try {
        const cached = await client.get(key);

        if (cached !== null) {
          return (JSON.parse(cached) as { value: T }).value;
        }
      } catch {
        const cached = this.readMemoryCache<T>(key);

        if (cached !== null) {
          return cached;
        }
      }
    } else {
      const cached = this.readMemoryCache<T>(key);

      if (cached !== null) {
        return cached;
      }
    }

    const value = await loader();

    if (client) {
      try {
        await client.set(key, JSON.stringify({ value }), { EX: ttlSeconds });
      } catch {
        this.writeMemoryCache(key, ttlSeconds, value);
      }
    } else {
      this.writeMemoryCache(key, ttlSeconds, value);
    }

    return value;
  }

  async getNamespaceVersion(namespace: string) {
    const client = await this.getClient();

    if (!client) {
      return this.memoryNamespaceVersions.get(namespace) ?? 1;
    }

    try {
      const value = await client.get(this.getNamespaceVersionKey(namespace));
      const parsed = value ? Number(value) : NaN;

      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    } catch {
      return this.memoryNamespaceVersions.get(namespace) ?? 1;
    }
  }

  async bumpNamespaceVersion(namespace: string) {
    const client = await this.getClient();

    if (!client) {
      const nextVersion = (this.memoryNamespaceVersions.get(namespace) ?? 1) + 1;
      this.memoryNamespaceVersions.set(namespace, nextVersion);
      return nextVersion;
    }

    try {
      return await client.incr(this.getNamespaceVersionKey(namespace));
    } catch {
      const nextVersion = (this.memoryNamespaceVersions.get(namespace) ?? 1) + 1;
      this.memoryNamespaceVersions.set(namespace, nextVersion);
      return nextVersion;
    }
  }

  async getHealth(): Promise<RedisHealth> {
    const target = this.getRedisTarget();

    if (!this.redisUrl) {
      return {
        configured: false,
        status: 'disabled',
        target,
      };
    }

    const client = await this.getClient();

    if (!client) {
      return {
        configured: true,
        status: 'fallback',
        target,
        reason: this.getFallbackReason(
          'Redis is unavailable. Falling back to in-memory cache behavior for this process.',
        ),
      };
    }

    try {
      const response = await client.ping();

      return {
        configured: true,
        status: response === 'PONG' ? 'up' : 'fallback',
        target,
        ...(response === 'PONG'
          ? {}
          : {
              reason:
                'Redis responded unexpectedly. Falling back to in-memory cache behavior for this process.',
            }),
      };
    } catch {
      return {
        configured: true,
        status: 'fallback',
        target,
        reason: this.getFallbackReason(
          'Redis ping failed. Falling back to in-memory cache behavior for this process.',
        ),
      };
    }
  }

  async onModuleDestroy() {
    if (!this.clientPromise) {
      return;
    }

    const client = await this.clientPromise.catch(() => null);

    if (client?.isOpen) {
      await client.quit().catch(() => undefined);
    }
  }
}
