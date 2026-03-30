import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { AppointmentStatus } from '@prisma/client';
import type { PrismaService } from './common/prisma.service';
import type { RedisService } from './common/redis.service';
import { MarketplaceService } from './common/marketplace.service';

describe('Bookings', () => {
  it('creates a booking, reserves the slot, and sends notifications', async () => {
    const notifications: Array<{
      userId: string;
      type: string;
      title: string;
    }> = [];
    const slotUpdates: Array<{
      where: { id: string };
      data: { isBooked: boolean };
    }> = [];
    const statusHistoryCreates: Array<unknown> = [];
    const cacheInvalidations: string[] = [];

    const tx = {
      business: {
        findUnique: async () => ({
          ownerUserId: 'user-owner-1',
        }),
      },
      service: {
        findFirst: async () => ({
          id: 'svc-1',
          name: 'Gel Manicure',
          durationMinutes: 60,
        }),
      },
      availabilitySlot: {
        findFirst: async () => ({
          id: 'slot-1',
          staffId: 'staff-1',
          isBooked: false,
        }),
        update: async (args: {
          where: { id: string };
          data: { isBooked: boolean };
        }) => {
          slotUpdates.push(args);
          return undefined;
        },
      },
      appointment: {
        create: async () => ({
          id: 'booking-1',
          customerId: 'user-customer-1',
          ownerId: 'user-owner-1',
          businessId: 'biz-1',
          serviceId: 'svc-1',
          staffId: 'staff-1',
          status: AppointmentStatus.PENDING,
          startTime: new Date('2026-03-30T18:00:00.000Z'),
          endTime: new Date('2026-03-30T19:00:00.000Z'),
          notes: 'French tips',
          createdAt: new Date('2026-03-29T17:00:00.000Z'),
          updatedAt: new Date('2026-03-29T17:00:00.000Z'),
          service: {
            id: 'svc-1',
            businessId: 'biz-1',
            name: 'Gel Manicure',
            description: 'Glossy gel manicure',
            durationMinutes: 60,
            price: 55,
            isActive: true,
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
            updatedAt: new Date('2026-03-01T00:00:00.000Z'),
          },
        }),
      },
      appointmentStatusHistory: {
        create: async (args: unknown) => {
          statusHistoryCreates.push(args);
          return undefined;
        },
      },
      notificationPreference: {
        findUnique: async () => null,
      },
      notification: {
        create: async ({
          data,
        }: {
          data: { userId: string; type: string; title: string };
        }) => {
          notifications.push(data);
          return { id: `notif-${notifications.length}`, ...data };
        },
      },
    };

    const prisma = {
      $transaction: async (
        callback: (
          client: typeof tx,
        ) => Promise<Awaited<ReturnType<typeof tx.appointment.create>>>,
      ) => callback(tx),
    };
    const redis = {
      bumpNamespaceVersion: async (namespace: string) => {
        cacheInvalidations.push(namespace);
        return 2;
      },
    };

    const service = new MarketplaceService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
    );
    const booking = await service.createBooking(
      {
        customerId: 'user-customer-1',
        ownerId: 'user-owner-1',
        businessId: 'biz-1',
        serviceId: 'svc-1',
        serviceName: 'Gel Manicure',
        startAt: '2026-03-30T18:00:00.000Z',
        endAt: '2026-03-30T19:00:00.000Z',
        note: 'French tips',
      },
      {
        id: 'user-customer-1',
        role: 'customer',
        name: 'Ava Tran',
        email: 'ava@beautyfinder.app',
      },
    );

    assert.equal(booking.id, 'booking-1');
    assert.equal(booking.status, 'pending');
    assert.equal(statusHistoryCreates.length, 1);
    assert.equal(slotUpdates[0]?.data.isBooked, true);
    assert.deepEqual(cacheInvalidations, ['availability']);
    assert.deepEqual(
      notifications.map((notification) => notification.type),
      ['booking_created', 'booking_created'],
    );
  });

  it('scopes booking list queries by requested role', async () => {
    const calls: unknown[] = [];
    const prisma = {
      appointment: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [];
        },
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    await service.getBookings(
      {
        id: 'user-owner-1',
        role: 'owner',
        name: 'Lina Nguyen',
        email: 'lina@polishedstudio.app',
      },
      undefined,
      'owner',
    );

    const query = calls[0] as {
      where: {
        ownerId: string;
      };
    };

    assert.equal(query.where.ownerId, 'user-owner-1');
  });
});
