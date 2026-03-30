import assert from 'node:assert/strict';
import type { ExecutionContext } from '@nestjs/common';
import { afterEach, describe, it } from 'vitest';
import { RateLimitExceededException, RateLimitGuard } from './common/rate-limit.guard';

const originalEnv = {
  AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS: process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
};

afterEach(() => {
  process.env.AUTH_RATE_LIMIT_MAX = originalEnv.AUTH_RATE_LIMIT_MAX;
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = originalEnv.AUTH_RATE_LIMIT_WINDOW_MS;
  process.env.RATE_LIMIT_MAX = originalEnv.RATE_LIMIT_MAX;
  process.env.RATE_LIMIT_WINDOW_MS = originalEnv.RATE_LIMIT_WINDOW_MS;
});

function createContext(path: string, method: string, ip = '127.0.0.1') {
  const headers = new Map<string, string>();
  const request = {
    headers: {},
    ip,
    method,
    originalUrl: path,
    socket: {
      remoteAddress: ip,
    },
    url: path,
  };
  const response = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  };

  return {
    context: {
      getClass: () => RateLimitGuard,
      getHandler: () => undefined,
      getArgs: () => [],
      getArgByIndex: () => undefined,
      getType: () => 'http',
      switchToHttp: () => ({
        getNext: () => undefined,
        getRequest: () => request,
        getResponse: () => response,
      }),
      switchToRpc: () => ({
        getContext: () => undefined,
        getData: () => undefined,
      }),
      switchToWs: () => ({
        getClient: () => undefined,
        getData: () => undefined,
        getPattern: () => undefined,
      }),
    } as unknown as ExecutionContext,
    headers,
  };
}

describe('RateLimitGuard', () => {
  it('uses the stricter auth policy for login and registration writes', () => {
    process.env.AUTH_RATE_LIMIT_MAX = '2';
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';

    const guard = new RateLimitGuard();
    const { context, headers } = createContext('/api/auth/login', 'POST');

    assert.equal(guard.canActivate(context), true);
    assert.equal(guard.canActivate(context), true);
    assert.throws(() => guard.canActivate(context), RateLimitExceededException);
    assert.equal(headers.get('X-RateLimit-Policy'), 'auth');
  });

  it('uses the global policy for normal API traffic', () => {
    process.env.RATE_LIMIT_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';

    const guard = new RateLimitGuard();
    const { context, headers } = createContext('/api/businesses', 'GET');

    assert.equal(guard.canActivate(context), true);
    assert.throws(() => guard.canActivate(context), RateLimitExceededException);
    assert.equal(headers.get('X-RateLimit-Policy'), 'global');
  });
});
