import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { describe, it } from 'vitest';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

describe('PrismaExceptionFilter', () => {
  it('maps Prisma initialization failures to a 503 response', () => {
    const filter = new PrismaExceptionFilter();
    let statusCode = 0;
    let payload: Record<string, unknown> | undefined;
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(value: Record<string, unknown>) {
        payload = value;
      },
    };
    const host = {
      switchToHttp() {
        return {
          getResponse: () => response,
          getRequest: () => ({
            url: '/api/bookings',
            originalUrl: '/api/bookings',
          }),
        };
      },
    };

    filter.catch(
      new Prisma.PrismaClientInitializationError(
        'Cannot reach database server',
        '6.19.2',
        'P1001',
      ),
      host as never,
    );

    assert.equal(statusCode, 503);
    assert.equal(payload?.statusCode, 503);
    assert.equal(payload?.code, 'P1001');
    assert.equal(payload?.path, '/api/bookings');
  });
});
