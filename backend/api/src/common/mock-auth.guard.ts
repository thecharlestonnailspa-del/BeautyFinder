import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { MarketplaceService } from './marketplace.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly marketplace: MarketplaceService) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { session?: unknown }>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const session = await this.marketplace.verifyAccessToken(token);
    if (!session) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    request.session = session;
    return true;
  }
}

export { JwtAuthGuard as MockAuthGuard };
