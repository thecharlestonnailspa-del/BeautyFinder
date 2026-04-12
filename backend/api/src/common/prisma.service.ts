import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly healthRetryDelayMs = 150;

  private validateDatabaseUrl() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required before starting the API');
    }

    if (databaseUrl.includes('[YOUR-PASSWORD]') || databaseUrl.includes('YOUR_PASSWORD')) {
      throw new Error('Replace the placeholder password in DATABASE_URL before starting the API');
    }
  }

  private getDatabaseTarget() {
    const databaseUrl = process.env.DATABASE_URL?.trim();

    if (!databaseUrl) {
      return undefined;
    }

    try {
      const parsed = new URL(databaseUrl);
      const databaseName = parsed.pathname.replace(/^\/+/, '') || undefined;

      return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${databaseName ? `/${databaseName}` : ''}`;
    } catch {
      return undefined;
    }
  }

  private isTransientConnectivityError(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();

    return (
      message.includes("can't reach database server") ||
      message.includes('timed out') ||
      message.includes('connection') ||
      message.includes('socket') ||
      message.includes('econnreset') ||
      message.includes('p1001')
    );
  }

  private async waitForRetryDelay() {
    await new Promise((resolve) => setTimeout(resolve, this.healthRetryDelayMs));
  }

  private async runHealthQuery() {
    await this.$queryRaw`SELECT 1`;
  }

  async getHealth() {
    const target = this.getDatabaseTarget();

    try {
      this.validateDatabaseUrl();
    } catch (error) {
      return {
        configured: false,
        status: 'down' as const,
        target,
        reason: error instanceof Error ? error.message : 'DATABASE_URL is invalid',
      };
    }

    try {
      await this.runHealthQuery();

      return {
        configured: true,
        status: 'up' as const,
        target,
      };
    } catch (error) {
      if (this.isTransientConnectivityError(error)) {
        try {
          await this.$disconnect().catch(() => undefined);
          await this.waitForRetryDelay();
          await this.$connect();
          await this.runHealthQuery();

          return {
            configured: true,
            status: 'up' as const,
            target,
          };
        } catch (retryError) {
          return {
            configured: true,
            status: 'down' as const,
            target,
            reason:
              retryError instanceof Error ? retryError.message : 'Database query failed after retry',
          };
        }
      }

      return {
        configured: true,
        status: 'down' as const,
        target,
        reason: error instanceof Error ? error.message : 'Database query failed',
      };
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
