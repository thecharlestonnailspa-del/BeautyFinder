import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  defaultAllowedCorsOrigins,
  getAllowedCorsOrigins,
  isCorsOriginAllowed,
} from './common/cors.config';

describe('CORS configuration', () => {
  it('uses the local development defaults when CORS_ORIGINS is not configured', () => {
    const allowedOrigins = getAllowedCorsOrigins({});

    assert.deepEqual(allowedOrigins, defaultAllowedCorsOrigins);
    assert.equal(
      isCorsOriginAllowed('http://127.0.0.1:3001', allowedOrigins),
      true,
    );
    assert.equal(
      isCorsOriginAllowed('https://malicious.example', allowedOrigins),
      false,
    );
  });

  it('parses and deduplicates configured origins', () => {
    const allowedOrigins = getAllowedCorsOrigins({
      CORS_ORIGINS:
        'https://owner.beautyfinder.app, https://admin.beautyfinder.app, https://owner.beautyfinder.app',
    });

    assert.deepEqual(allowedOrigins, [
      'https://owner.beautyfinder.app',
      'https://admin.beautyfinder.app',
    ]);
    assert.equal(
      isCorsOriginAllowed('https://admin.beautyfinder.app', allowedOrigins),
      true,
    );
    assert.equal(isCorsOriginAllowed(undefined, allowedOrigins), true);
  });
});
