import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { HealthController } from './modules/health/health.controller';
import type { PrismaService } from './common/prisma.service';
import type { RedisService } from './common/redis.service';

describe('HealthController', () => {
  it('reports degraded status when the database is unavailable', async () => {
    const controller = new HealthController(
      {
        getHealth: async () => ({
          configured: true,
          status: 'down' as const,
          target: 'db.example.com:5432/postgres',
          reason: 'Cannot reach database server',
        }),
      } as PrismaService,
      {
        getHealth: async () => ({
          configured: false,
          status: 'disabled' as const,
        }),
      } as RedisService,
    );

    const health = await controller.getHealth();

    assert.equal(health.status, 'degraded');
    assert.deepEqual(health.services.database, {
      configured: true,
      status: 'down',
      target: 'db.example.com:5432/postgres',
      reason: 'Cannot reach database server',
    });
    assert.deepEqual(health.services.redis, {
      configured: false,
      status: 'disabled',
    });
  });
});
