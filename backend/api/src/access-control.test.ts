import 'reflect-metadata';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role, SessionPayload, UserSummary } from '@beauty-finder/types';
import { describe, it } from 'vitest';
import type { AuthenticatedRequest } from './common/auth.types';
import { MarketplaceService } from './common/marketplace.service';
import { BusinessesController } from './modules/businesses/businesses.controller';
import { RolesGuard } from './common/roles.guard';
import { FavoritesController } from './modules/favorites/favorites.controller';
import { FavoritesService } from './modules/favorites/favorites.service';
import { BusinessesService } from './modules/businesses/businesses.service';
import { UsersController } from './modules/users/users.controller';

const testSessions: Record<Role, SessionPayload> = {
  customer: {
    user: {
      id: 'user-customer-1',
      role: 'customer',
      name: 'Ava Tran',
      email: 'ava@beautyfinder.app',
    },
    permissions: [],
    accessToken: 'test-token-customer',
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
  owner: {
    user: {
      id: 'user-owner-1',
      role: 'owner',
      name: 'Lina Nguyen',
      email: 'lina@polishedstudio.app',
    },
    permissions: [],
    accessToken: 'test-token-owner',
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
  technician: {
    user: {
      id: 'user-technician-1',
      role: 'technician',
      name: 'Maya Chen',
      email: 'maya@privatebeauty.app',
    },
    permissions: [],
    accessToken: 'test-token-technician',
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
  admin: {
    user: {
      id: 'user-admin-1',
      role: 'admin',
      name: 'Mason Lee',
      email: 'admin@beautyfinder.app',
    },
    permissions: [],
    accessToken: 'test-token-admin',
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
};

function createRequest(role: Role): AuthenticatedRequest {
  return {
    session: testSessions[role],
  } as AuthenticatedRequest;
}

function createExecutionContext(
  controllerClass: abstract new (...args: never[]) => unknown,
  handler: (...args: never[]) => unknown,
  role: Role,
): ExecutionContext {
  return {
    getClass: () => controllerClass,
    getHandler: () => handler,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => createRequest(role),
      getResponse: () => undefined,
      getNext: () => undefined,
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
  } as unknown as ExecutionContext;
}

describe('API access control', () => {
  it('scopes favorites reads and writes to the authenticated session', async () => {
    const calls = {
      addFavorite: [] as Array<{ actor: UserSummary; businessId: string }>,
      getFavorites: [] as UserSummary[],
      removeFavorite: [] as Array<{ actor: UserSummary; businessId: string }>,
    };
    const favoritesService = new FavoritesService({
      addFavorite: async (actor: UserSummary, businessId: string) => {
        calls.addFavorite.push({ actor, businessId });
        return [{ userId: actor.id, businessId }];
      },
      getFavorites: async (actor: UserSummary) => {
        calls.getFavorites.push(actor);
        return [{ userId: actor.id, businessId: 'biz-1' }];
      },
      removeFavorite: async (actor: UserSummary, businessId: string) => {
        calls.removeFavorite.push({ actor, businessId });
        return [];
      },
    } as unknown as MarketplaceService);
    const controller = new FavoritesController(favoritesService);
    const request = createRequest('customer');

    await controller.getFavorites(request);
    await controller.addFavorite('biz-99', request);
    await controller.removeFavorite('biz-77', request);

    assert.equal(calls.getFavorites[0]?.id, testSessions.customer.user.id);
    assert.deepEqual(calls.addFavorite[0], {
      actor: testSessions.customer.user,
      businessId: 'biz-99',
    });
    assert.deepEqual(calls.removeFavorite[0], {
      actor: testSessions.customer.user,
      businessId: 'biz-77',
    });
  });

  it('blocks non-admin access to users routes through RolesGuard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = createExecutionContext(
      UsersController,
      UsersController.prototype.listUsers,
      'customer',
    );

    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });

  it('allows admin access to users routes through RolesGuard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = createExecutionContext(
      UsersController,
      UsersController.prototype.listUsers,
      'admin',
    );

    assert.equal(guard.canActivate(context), true);
  });

  it('scopes owner manage businesses to the authenticated owner session', async () => {
    const calls = [] as Array<{ ownerId: string; actor: UserSummary }>;
    const businessesService = {
      getOwnerBusinesses: async (ownerId: string, actor: UserSummary) => {
        calls.push({ ownerId, actor });
        return [];
      },
    } as unknown as BusinessesService;
    const controller = new BusinessesController(businessesService);
    const request = createRequest('owner');

    await controller.getAuthenticatedOwnerBusinesses(request);

    assert.deepEqual(calls[0], {
      ownerId: testSessions.owner.user.id,
      actor: testSessions.owner.user,
    });
  });

  it('scopes owner media uploads to the authenticated owner session', async () => {
    const calls = [] as Array<{
      businessId: string;
      actor: UserSummary;
      input: { base64: string };
    }>;
    const businessesService = {
      uploadOwnerBusinessImage: async (
        businessId: string,
        input: { base64: string },
        actor: UserSummary,
      ) => {
        calls.push({ businessId, actor, input });
        return { path: '/uploads/owners/user-owner-1/biz-1/test.png' };
      },
    } as unknown as BusinessesService;
    const controller = new BusinessesController(businessesService);
    const request = createRequest('owner');

    await controller.uploadOwnerBusinessImage(
      'biz-1',
      { base64: 'Zm9v' },
      request,
    );

    assert.deepEqual(calls[0], {
      businessId: 'biz-1',
      actor: testSessions.owner.user,
      input: { base64: 'Zm9v' },
    });
  });

  it('blocks admin access to owner-scoped manage routes through RolesGuard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = createExecutionContext(
      BusinessesController,
      BusinessesController.prototype.getAuthenticatedOwnerBusinesses,
      'admin',
    );

    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });

  it('allows admin access to admin-scoped owner management routes through RolesGuard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = createExecutionContext(
      BusinessesController,
      BusinessesController.prototype.getOwnerBusinessesForAdmin,
      'admin',
    );

    assert.equal(guard.canActivate(context), true);
  });

  it('blocks admin access to owner media upload routes through RolesGuard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = createExecutionContext(
      BusinessesController,
      BusinessesController.prototype.uploadOwnerBusinessImage,
      'admin',
    );

    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });
});
