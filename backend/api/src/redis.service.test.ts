import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

describe('RedisService', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    vi.restoreAllMocks();
    vi.doUnmock('redis');
  });

  it('falls back to in-memory cache behavior when Redis is unavailable', async () => {
    const mockedClient = {
      on: vi.fn(),
      connect: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
      isOpen: false,
      quit: vi.fn(),
    };

    vi.doMock('redis', () => ({
      createClient: vi.fn(() => mockedClient),
    }));

    const { RedisService } = await import('./common/redis.service');
    const service = new RedisService();
    let loadCount = 0;

    const first = await service.rememberJson('catalog:1', 60, async () => {
      loadCount += 1;
      return { ok: true };
    });
    const second = await service.rememberJson('catalog:1', 60, async () => {
      loadCount += 1;
      return { ok: false };
    });
    const initialVersion = await service.getNamespaceVersion('catalog');
    const bumpedVersion = await service.bumpNamespaceVersion('catalog');
    const latestVersion = await service.getNamespaceVersion('catalog');
    const health = await service.getHealth();

    assert.deepEqual(first, { ok: true });
    assert.deepEqual(second, { ok: true });
    assert.equal(loadCount, 1);
    assert.equal(initialVersion, 1);
    assert.equal(bumpedVersion, 2);
    assert.equal(latestVersion, 2);
    assert.equal(health.status, 'fallback');
    assert.equal(health.configured, true);
  });
});
