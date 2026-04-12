import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { PrismaService } from './common/prisma.service';

describe('PrismaService', () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
    vi.restoreAllMocks();
  });

  it('retries the health probe once after a transient connectivity failure', async () => {
    process.env.DATABASE_URL = 'postgresql://tester:password@127.0.0.1:5432/postgres';

    const service = new PrismaService();
    const queryRaw = vi
      .fn()
      .mockRejectedValueOnce(new Error("Can't reach database server at `127.0.0.1:5432`"))
      .mockResolvedValueOnce([{ '?column?': 1 }]);
    const connect = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn().mockResolvedValue(undefined);

    Object.assign(service, {
      $queryRaw: queryRaw,
      $connect: connect,
      $disconnect: disconnect,
    });

    const health = await service.getHealth();

    assert.equal(health.status, 'up');
    assert.equal(queryRaw.mock.calls.length, 2);
    assert.equal(connect.mock.calls.length, 1);
    assert.equal(disconnect.mock.calls.length, 1);
  });
});
