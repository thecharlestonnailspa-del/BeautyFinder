import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type RateLimitPolicy = {
  max: number;
  name: 'auth' | 'global';
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export class RateLimitExceededException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private nextSweepAt = 0;

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request | undefined>();
    const response = context.switchToHttp().getResponse<Response | undefined>();

    if (!request || request.method === 'OPTIONS') {
      return true;
    }

    const now = Date.now();
    if (now >= this.nextSweepAt) {
      this.sweepExpiredBuckets(now);
    }

    const policy = this.resolvePolicy(request);
    const bucketKey = `${policy.name}:${this.resolveClientId(request)}`;
    const currentBucket = this.buckets.get(bucketKey);

    if (!currentBucket || currentBucket.resetAt <= now) {
      const nextBucket = {
        count: 1,
        resetAt: now + policy.windowMs,
      };

      this.buckets.set(bucketKey, nextBucket);
      this.attachHeaders(response, policy, nextBucket, now);
      return true;
    }

    if (currentBucket.count >= policy.max) {
      this.attachHeaders(response, policy, currentBucket, now);
      throw new RateLimitExceededException(
        `Rate limit exceeded. Retry after ${Math.max(
          1,
          Math.ceil((currentBucket.resetAt - now) / 1000),
        )} seconds.`,
      );
    }

    currentBucket.count += 1;
    this.attachHeaders(response, policy, currentBucket, now);
    return true;
  }

  private resolvePolicy(request: Request): RateLimitPolicy {
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    const isAuthMutation =
      request.method === 'POST' &&
      (path === '/api/auth/login' ||
        path === '/api/auth/register/customer' ||
        path === '/api/auth/register/business');

    if (isAuthMutation) {
      return {
        name: 'auth',
        max: this.readPositiveInt('AUTH_RATE_LIMIT_MAX', 10),
        windowMs: this.readPositiveInt('AUTH_RATE_LIMIT_WINDOW_MS', 60_000),
      };
    }

    return {
      name: 'global',
      max: this.readPositiveInt('RATE_LIMIT_MAX', 120),
      windowMs: this.readPositiveInt('RATE_LIMIT_WINDOW_MS', 60_000),
    };
  }

  private resolveClientId(request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0]!.trim();
    }

    return request.ip || request.socket.remoteAddress || 'unknown-client';
  }

  private attachHeaders(
    response: Response | undefined,
    policy: RateLimitPolicy,
    bucket: RateLimitBucket,
    now: number,
  ) {
    if (!response?.setHeader) {
      return;
    }

    const remaining = Math.max(0, policy.max - bucket.count);
    response.setHeader('X-RateLimit-Policy', policy.name);
    response.setHeader('X-RateLimit-Limit', String(policy.max));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    response.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))),
    );
  }

  private readPositiveInt(name: string, fallback: number) {
    const configured = Number(process.env[name] ?? fallback);
    return Number.isFinite(configured) && configured > 0
      ? Math.floor(configured)
      : fallback;
  }

  private sweepExpiredBuckets(now: number) {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }

    this.nextSweepAt = now + 60_000;
  }
}
