import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { describe, it } from 'vitest';
import type { PrismaService } from './common/prisma.service';
import { MarketplaceService } from './common/marketplace.service';

describe('Notification preferences', () => {
  it('upserts notification preferences for the authenticated user', async () => {
    const prisma = {
      notificationPreference: {
        upsert: async () => ({
          userId: 'user-customer-1',
          bookingCreated: true,
          bookingConfirmed: true,
          messageReceived: false,
          paymentReceipt: true,
          reviewReceived: true,
          system: true,
          updatedAt: new Date('2026-03-29T18:00:00.000Z'),
        }),
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const preferences = await service.updateNotificationPreferences(
      {
        id: 'user-customer-1',
        role: 'customer',
        name: 'Ava Tran',
        email: 'ava@beautyfinder.app',
      },
      {
        messageReceived: false,
      },
    );

    assert.equal(preferences.userId, 'user-customer-1');
    assert.equal(preferences.messageReceived, false);
  });

  it('marks all notifications as read and rejects empty read payloads', async () => {
    const updates: unknown[] = [];
    const prisma = {
      notification: {
        findMany: async () => [
          {
            id: 'notif-1',
            userId: 'user-customer-1',
            type: 'booking_confirmed',
            title: 'Booking confirmed',
            body: 'Polished Studio confirmed your appointment.',
            createdAt: new Date('2026-03-29T17:00:00.000Z'),
            readAt: new Date('2026-03-29T18:00:00.000Z'),
          },
        ],
        updateMany: async (args: unknown) => {
          updates.push(args);
          return { count: 1 };
        },
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const actor = {
      id: 'user-customer-1',
      role: 'customer' as const,
      name: 'Ava Tran',
      email: 'ava@beautyfinder.app',
    };

    await assert.rejects(
      () => service.markNotificationsRead(actor, {}),
      BadRequestException,
    );

    const notifications = await service.markNotificationsRead(actor, {
      markAll: true,
    });

    assert.equal(updates.length, 1);
    assert.equal(notifications[0]?.read, true);
  });
});
