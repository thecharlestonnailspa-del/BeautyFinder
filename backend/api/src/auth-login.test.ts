import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { describe, it } from 'vitest';
import type { PrismaService } from './common/prisma.service';
import { MarketplaceService } from './common/marketplace.service';

process.env.JWT_SECRET = 'beauty-finder-test-jwt-secret';

const legacyPasswordHash = (password: string) =>
  `sha256$${createHash('sha256').update(password).digest('hex')}`;

describe('Email/password login', () => {
  it('requires an email and password', async () => {
    const service = new MarketplaceService({
      user: {
        findUnique: async () => null,
      },
    } as unknown as PrismaService);

    await assert.rejects(() => service.login({}), BadRequestException);
    await assert.rejects(
      () => service.login({ email: 'ava@beautyfinder.app' }),
      BadRequestException,
    );
  });

  it('upgrades legacy password hashes after a successful login', async () => {
    const user = {
      id: 'user-customer-1',
      email: 'ava@beautyfinder.app',
      passwordHash: legacyPasswordHash('mock-password'),
      fullName: 'Ava Tran',
      phone: '555-0101',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      roles: [{ role: RoleName.CUSTOMER }],
    };
    const updates: string[] = [];
    const prisma = {
      user: {
        findUnique: async ({ where }: { where: { email: string } }) =>
          where.email === user.email ? user : null,
        update: async ({ data }: { data: { passwordHash: string } }) => {
          updates.push(data.passwordHash);
          user.passwordHash = data.passwordHash;
          return user;
        },
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const session = await service.login({
      email: user.email,
      password: 'mock-password',
    });

    assert.equal(session.user.id, user.id);
    assert.equal(updates.length, 1);
    assert.match(updates[0] ?? '', /^scrypt\$/);
  });

  it('rejects invalid credentials', async () => {
    const user = {
      id: 'user-customer-1',
      email: 'ava@beautyfinder.app',
      passwordHash: legacyPasswordHash('mock-password'),
      fullName: 'Ava Tran',
      phone: '555-0101',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      roles: [{ role: RoleName.CUSTOMER }],
    };
    const service = new MarketplaceService({
      user: {
        findUnique: async ({ where }: { where: { email: string } }) =>
          where.email === user.email ? user : null,
      },
    } as unknown as PrismaService);

    await assert.rejects(
      () =>
        service.login({
          email: user.email,
          password: 'wrong-password',
        }),
      UnauthorizedException,
    );
  });
});
