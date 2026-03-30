import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'redis';

type RedisHealth = {
  configured: boolean;
  status: 'disabled' | 'down' | 'up';
};

type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisUrl = process.env.REDIS_URL?.trim();
  private clientPromise?: Promise<RedisClient | null>;

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
        .then(() => client)
        .catch(async () => {
          this.clientPromise = undefined;

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
        // Ignore cache read failures and fall back to the source of truth.
      }
    }

    const value = await loader();

    if (client) {
      try {
        await client.set(key, JSON.stringify({ value }), { EX: ttlSeconds });
      } catch {
        // Ignore cache write failures and return the fresh value.
      }
    }

    return value;
  }

  async getNamespaceVersion(namespace: string) {
    const client = await this.getClient();

    if (!client) {
      return 1;
    }

    try {
      const value = await client.get(this.getNamespaceVersionKey(namespace));
      const parsed = value ? Number(value) : NaN;

      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    } catch {
      return 1;
    }
  }

  async bumpNamespaceVersion(namespace: string) {
    const client = await this.getClient();

    if (!client) {
      return 1;
    }

    try {
      return await client.incr(this.getNamespaceVersionKey(namespace));
    } catch {
      return 1;
    }
  }

  async getHealth(): Promise<RedisHealth> {
    if (!this.redisUrl) {
      return {
        configured: false,
        status: 'disabled',
      };
    }

    const client = await this.getClient();

    if (!client) {
      return {
        configured: true,
        status: 'down',
      };
    }

    try {
      const response = await client.ping();

      return {
        configured: true,
        status: response === 'PONG' ? 'up' : 'down',
      };
    } catch {
      return {
        configured: true,
        status: 'down',
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
