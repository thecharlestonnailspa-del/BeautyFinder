import { Global, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './auth.guard';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from './prisma.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RedisService } from './redis.service';
import { RolesGuard } from './roles.guard';
import { OwnerMediaStorageService } from './owner-media-storage.service';

@Global()
@Module({
  providers: [
    Reflector,
    PrismaService,
    MarketplaceService,
    JwtAuthGuard,
    RolesGuard,
    RedisService,
    OwnerMediaStorageService,
    RateLimitGuard,
    {
      provide: APP_GUARD,
      useExisting: RateLimitGuard,
    },
  ],
  exports: [
    PrismaService,
    MarketplaceService,
    JwtAuthGuard,
    RolesGuard,
    RedisService,
    OwnerMediaStorageService,
    RateLimitGuard,
  ],
})
export class CommonModule {}
