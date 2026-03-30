import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { AppointmentStatus } from '@prisma/client';
import type { PrismaService } from './common/prisma.service';
import { MarketplaceService } from './common/marketplace.service';

describe('Payments', () => {
  it('creates a paid receipt, confirms the booking, and sends notifications', async () => {
    const notifications: Array<{
      userId: string;
      type: string;
      title: string;
    }> = [];
    const appointmentUpdates: Array<{
      where: { id: string };
      data: { status: AppointmentStatus };
    }> = [];
    const statusHistoryCreates: Array<unknown> = [];

    const tx = {
      appointment: {
        update: async (args: {
          where: { id: string };
          data: { status: AppointmentStatus };
        }) => {
          appointmentUpdates.push(args);
          return undefined;
        },
      },
      appointmentStatusHistory: {
        create: async (args: unknown) => {
          statusHistoryCreates.push(args);
          return undefined;
        },
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
      notificationPreference: {
        findUnique: async () => null,
      },
      payment: {
        create: async () => ({
          id: 'payment-1',
          appointmentId: 'booking-1',
          method: 'CARD',
          status: 'PAID',
          subtotalAmount: 55,
          discountAmount: 8.25,
          taxAmount: 3.74,
          tipAmount: 5,
          totalAmount: 55.49,
          currency: 'USD',
          receiptNumber: 'BF-20260329-TEST0001',
          cardBrand: 'VISA',
          cardLast4: '4242',
          paidAt: new Date('2026-03-29T18:00:00.000Z'),
          createdAt: new Date('2026-03-29T18:00:00.000Z'),
          updatedAt: new Date('2026-03-29T18:00:00.000Z'),
          appointment: {
            id: 'booking-1',
            customerId: 'user-customer-1',
            ownerId: 'user-owner-1',
            businessId: 'biz-1',
            serviceId: 'svc-1',
            staffId: 'staff-1',
            status: AppointmentStatus.CONFIRMED,
            startTime: new Date('2026-03-30T18:00:00.000Z'),
            endTime: new Date('2026-03-30T19:00:00.000Z'),
            notes: 'French tips',
            createdAt: new Date('2026-03-29T17:00:00.000Z'),
            updatedAt: new Date('2026-03-29T18:00:00.000Z'),
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
          },
        }),
      },
    };

    const prisma = {
      appointment: {
        findUnique: async () => ({
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
          business: {
            id: 'biz-1',
            name: 'Polished Studio',
            promotionDiscountPercent: 15,
            promotionExpiresAt: new Date('2026-04-12T23:59:59.000Z'),
          },
          customer: {
            id: 'user-customer-1',
            fullName: 'Ava Tran',
          },
          payment: null,
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
      $transaction: async (
        callback: (
          client: typeof tx,
        ) => Promise<Awaited<ReturnType<typeof tx.payment.create>>>,
      ) => callback(tx),
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const payment = await service.checkoutPayment(
      {
        bookingId: 'booking-1',
        method: 'card',
        tipAmount: 5,
        cardBrand: 'visa',
        cardLast4: '4242',
      },
      {
        id: 'user-customer-1',
        role: 'customer',
        name: 'Ava Tran',
        email: 'ava@beautyfinder.app',
      },
    );

    assert.equal(payment.status, 'paid');
    assert.equal(payment.discount, 8.25);
    assert.equal(payment.tax, 3.74);
    assert.equal(payment.total, 55.49);
    assert.equal(
      appointmentUpdates[0]?.data.status,
      AppointmentStatus.CONFIRMED,
    );
    assert.equal(statusHistoryCreates.length, 1);
    assert.deepEqual(
      notifications.map((notification) => notification.type),
      ['payment_receipt', 'booking_confirmed', 'booking_confirmed'],
    );
  });

  it('scopes payment list queries by requested role', async () => {
    const calls: unknown[] = [];
    const prisma = {
      payment: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [];
        },
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    await service.getPayments(
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
        appointment: {
          is: {
            ownerId: string;
          };
        };
      };
    };

    assert.equal(query.where.appointment.is.ownerId, 'user-owner-1');
  });
});
