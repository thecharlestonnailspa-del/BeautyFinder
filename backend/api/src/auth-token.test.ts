import assert from 'node:assert/strict';
import { RoleName } from '@prisma/client';
import { describe, it } from 'vitest';
import type { PrismaService } from './common/prisma.service';
import { MarketplaceService } from './common/marketplace.service';

process.env.JWT_SECRET = 'beauty-finder-test-jwt-secret';

const mockUser = {
  id: 'user-customer-1',
  email: 'ava@beautyfinder.app',
  passwordHash: 'sha256$test',
  fullName: 'Ava Tran',
  phone: '555-0101',
  createdAt: new Date('2026-03-01T00:00:00.000Z'),
  updatedAt: new Date('2026-03-01T00:00:00.000Z'),
  roles: [{ role: RoleName.CUSTOMER }],
};

function createMarketplaceService() {
  const prisma = {
    userRole: {
      findFirst: async () => ({
        user: mockUser,
      }),
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === mockUser.id ? mockUser : null,
      findFirst: async () => mockUser,
    },
  };

  return new MarketplaceService(prisma as unknown as PrismaService);
}

describe('JWT access tokens', () => {
  it('issues JWT tokens for new sessions and verifies them', async () => {
    const service = createMarketplaceService();
    const session = await service.getSession('customer');

    assert.equal(session.accessToken.split('.').length, 3);
    assert.notEqual(session.accessToken.split('.')[0], 'bf');

    const verifiedSession = await service.verifyAccessToken(
      session.accessToken,
    );

    assert.equal(verifiedSession?.user.id, mockUser.id);
    assert.equal(verifiedSession?.user.role, 'customer');
    assert.equal(verifiedSession?.accessToken, session.accessToken);
  });

  it('rejects legacy bf tokens', async () => {
    const service = createMarketplaceService();
    const now = Math.floor(Date.now() / 1000);
    const legacyClaims = {
      ver: 1 as const,
      iss: 'beauty-finder-api',
      sub: mockUser.id,
      role: 'customer' as const,
      iat: now,
      exp: now + 60,
    };
    const encodedPayload = (service as any).toBase64Url(
      JSON.stringify(legacyClaims),
    );
    const signature = (service as any).signAccessTokenValue(encodedPayload);
    const legacyToken = `bf.${encodedPayload}.${signature}`;

    const verifiedSession = await service.verifyAccessToken(legacyToken);

    assert.equal(verifiedSession, undefined);
  });
});
