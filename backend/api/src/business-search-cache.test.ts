import assert from 'node:assert/strict';
import { BusinessCategory, BusinessStatus } from '@prisma/client';
import { describe, it } from 'vitest';
import type { PrismaService } from './common/prisma.service';
import type { RedisService } from './common/redis.service';
import { MarketplaceService } from './common/marketplace.service';

function createRedisDouble() {
  const cache = new Map<string, string>();

  return {
    getNamespaceVersion: async () => 1,
    bumpNamespaceVersion: async () => 2,
    rememberJson: async <T>(
      key: string,
      _ttlSeconds: number,
      loader: () => Promise<T>,
    ) => {
      const cached = cache.get(key);

      if (cached) {
        return (JSON.parse(cached) as { value: T }).value;
      }

      const value = await loader();
      cache.set(key, JSON.stringify({ value }));
      return value;
    },
  };
}

function createBusinessFixture() {
  return {
    id: 'biz-1',
    ownerUserId: 'user-owner-1',
    category: BusinessCategory.NAIL,
    name: 'Gloss Lab',
    description: 'Gel manicure specialists in downtown Seattle.',
    phone: '555-0101',
    email: 'hello@glosslab.app',
    addressLine1: '123 Pike Street',
    addressLine2: null,
    city: 'Seattle',
    state: 'WA',
    postalCode: '98101',
    latitude: null,
    longitude: null,
    featuredOnHomepage: true,
    homepageRank: 1,
    heroImage: 'https://cdn.beautyfinder.app/gloss-lab/hero.jpg',
    videoUrl: null,
    promotionTitle: null,
    promotionDescription: null,
    promotionDiscountPercent: null,
    promotionCode: null,
    promotionExpiresAt: null,
    rating: 4.9,
    reviewCount: 28,
    status: BusinessStatus.APPROVED,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    services: [
      {
        id: 'svc-1',
        businessId: 'biz-1',
        name: 'Gel Manicure',
        description: 'Structured gel manicure with nail art add-ons.',
        durationMinutes: 60,
        price: 65,
        isActive: true,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ],
    images: [
      {
        id: 'img-1',
        businessId: 'biz-1',
        url: 'https://cdn.beautyfinder.app/gloss-lab/hero.jpg',
        sortOrder: 0,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ],
    staff: [],
  };
}

describe('Business search performance', () => {
  it('pushes category, city, and search filters into Prisma', async () => {
    const calls: unknown[] = [];
    const prisma = {
      business: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [createBusinessFixture()];
        },
      },
    };

    const service = new MarketplaceService(
      prisma as unknown as PrismaService,
      createRedisDouble() as unknown as RedisService,
    );

    const results = await service.getBusinesses({
      category: 'nail',
      city: 'Seattle',
      search: 'gel manicure',
    });

    assert.equal(results.length, 1);
    assert.equal(calls.length, 1);

    const query = calls[0] as {
      where: {
        status: BusinessStatus;
        category: BusinessCategory;
        city: { equals: string; mode: string };
        AND: Array<{ OR: Array<Record<string, unknown>> }>;
      };
    };

    assert.equal(query.where.status, BusinessStatus.APPROVED);
    assert.equal(query.where.category, BusinessCategory.NAIL);
    assert.deepEqual(query.where.city, {
      equals: 'seattle',
      mode: 'insensitive',
    });
    assert.equal(query.where.AND.length, 2);

    const firstToken = query.where.AND[0] as {
      OR: Array<Record<string, any>>;
    };
    const serviceSearch = firstToken.OR[4]?.services?.some;

    assert.equal(firstToken.OR[0]?.name?.contains, 'gel');
    assert.equal(firstToken.OR[1]?.description?.contains, 'gel');
    assert.equal(serviceSearch?.OR[0]?.name?.contains, 'gel');
    assert.equal(serviceSearch?.OR[1]?.description?.contains, 'gel');
  });

  it('reuses the cached result for equivalent search filters', async () => {
    let findManyCount = 0;
    const prisma = {
      business: {
        findMany: async () => {
          findManyCount += 1;
          return [createBusinessFixture()];
        },
      },
    };

    const service = new MarketplaceService(
      prisma as unknown as PrismaService,
      createRedisDouble() as unknown as RedisService,
    );

    await service.getBusinesses({ city: 'Seattle', search: ' GEL ' });
    await service.getBusinesses({ city: 'seattle', search: 'gel' });

    assert.equal(findManyCount, 1);
  });
});
