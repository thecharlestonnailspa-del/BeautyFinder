import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type {
  CheckoutPaymentInput,
  PaymentRecord,
  Role,
  UserSummary,
} from '@beauty-finder/types';
import {
  AppointmentStatus,
  Prisma,
  PaymentStatus as PrismaPaymentStatus,
} from '@prisma/client';
import type { PaymentWithRelations } from './marketplace.types';
import type { PrismaService } from '../prisma.service';

export type PaymentsDomainDependencies = {
  prisma: PrismaService;
  resolveScopedUserId: (
    actor: UserSummary,
    requestedUserId?: string,
  ) => string;
  resolveScopedBookingRole: (
    actor: UserSummary,
    requestedRole?: Role,
  ) => Role;
  toPaymentRecord: (payment: PaymentWithRelations) => PaymentRecord;
  toNumber: (value: unknown) => number;
  roundCurrency: (amount: number) => number;
  getPaymentTaxRate: () => number;
  isPromotionActive: (business: {
    promotionDiscountPercent: number | null;
    promotionExpiresAt: Date | null;
  }) => boolean;
  createReceiptNumber: () => string;
  toPaymentMethod: (method: 'card' | 'cash') => PaymentWithRelations['method'];
  sanitizeString: (value?: string | null) => string | undefined;
  createNotification: (
    client: Prisma.TransactionClient,
    input: {
      userId: string;
      type: 'booking_confirmed' | 'payment_receipt';
      title: string;
      body?: string;
      payload?: Record<string, unknown>;
      createdAt?: Date;
    },
  ) => Promise<unknown>;
  paymentCurrency: string;
};

export async function getPaymentsFlow(
  deps: PaymentsDomainDependencies,
  actor: UserSummary,
  requestedUserId?: string,
  requestedRole?: Role,
): Promise<PaymentRecord[]> {
  const userId = deps.resolveScopedUserId(actor, requestedUserId);
  const role = deps.resolveScopedBookingRole(actor, requestedRole);

  const where =
    role === 'owner'
      ? { appointment: { is: { ownerId: userId } } }
      : role === 'admin'
        ? {}
        : { appointment: { is: { customerId: userId } } };

  const payments = await deps.prisma.payment.findMany({
    where,
    include: {
      appointment: {
        include: {
          service: true,
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  });

  return payments.map((payment) => deps.toPaymentRecord(payment));
}

export async function checkoutPaymentFlow(
  deps: PaymentsDomainDependencies,
  input: CheckoutPaymentInput,
  actor: UserSummary,
): Promise<PaymentRecord> {
  const booking = await deps.prisma.appointment.findUnique({
    where: { id: input.bookingId },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          promotionDiscountPercent: true,
          promotionExpiresAt: true,
        },
      },
      customer: {
        select: {
          id: true,
          fullName: true,
        },
      },
      payment: {
        select: { id: true },
      },
      service: true,
    },
  });

  if (!booking) {
    throw new NotFoundException('Booking not found');
  }

  if (actor.role === 'customer' && booking.customerId !== actor.id) {
    throw new ForbiddenException(
      'Customers can only pay for their own bookings',
    );
  }

  if (actor.role === 'owner' && booking.ownerId !== actor.id) {
    throw new ForbiddenException(
      'Owners can only manage payments for their own bookings',
    );
  }

  if (booking.payment) {
    throw new ConflictException('This booking has already been paid');
  }

  if (
    booking.status === AppointmentStatus.CANCELLED ||
    booking.status === AppointmentStatus.NO_SHOW
  ) {
    throw new BadRequestException(
      'Cancelled bookings cannot be paid or confirmed',
    );
  }

  const subtotal = deps.roundCurrency(deps.toNumber(booking.service.price));
  const discountPercent = deps.isPromotionActive(booking.business)
    ? (booking.business.promotionDiscountPercent ?? 0)
    : 0;
  const discount = deps.roundCurrency((subtotal * discountPercent) / 100);
  const tip = deps.roundCurrency(input.tipAmount ?? 0);
  const taxableSubtotal = Math.max(0, subtotal - discount);
  const tax = deps.roundCurrency(
    taxableSubtotal * deps.getPaymentTaxRate(),
  );
  const total = deps.roundCurrency(taxableSubtotal + tax + tip);
  const paidAt = new Date();
  const receiptNumber = deps.createReceiptNumber();

  const payment = await deps.prisma.$transaction(async (tx) => {
    if (booking.status === AppointmentStatus.PENDING) {
      await tx.appointment.update({
        where: { id: booking.id },
        data: { status: AppointmentStatus.CONFIRMED },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: booking.id,
          oldStatus: AppointmentStatus.PENDING,
          newStatus: AppointmentStatus.CONFIRMED,
          changedByUserId: actor.id,
        },
      });
    }

    const createdPayment = await tx.payment.create({
      data: {
        appointmentId: booking.id,
        method: deps.toPaymentMethod(input.method),
        status: 'PAID' as PrismaPaymentStatus,
        subtotalAmount: subtotal,
        discountAmount: discount,
        taxAmount: tax,
        tipAmount: tip,
        totalAmount: total,
        currency: deps.paymentCurrency,
        receiptNumber,
        cardBrand:
          input.method === 'card'
            ? (deps.sanitizeString(input.cardBrand)?.toUpperCase() ?? 'VISA')
            : null,
        cardLast4: input.method === 'card' ? (input.cardLast4 ?? '4242') : null,
        paidAt,
      },
      include: {
        appointment: {
          include: {
            service: true,
          },
        },
      },
    });

    await deps.createNotification(tx, {
      userId: booking.customerId,
      type: 'payment_receipt',
      title: 'Payment receipt',
      body: `${booking.service.name} at ${booking.business.name} was paid in full. Receipt ${receiptNumber}.`,
      payload: {
        bookingId: booking.id,
        total,
        currency: deps.paymentCurrency,
        receiptNumber,
      },
      createdAt: paidAt,
    });

    await deps.createNotification(tx, {
      userId: booking.customerId,
      type: 'booking_confirmed',
      title: 'Booking confirmed',
      body: `${booking.business.name} confirmed your ${booking.service.name} appointment.`,
      payload: {
        bookingId: booking.id,
      },
      createdAt: paidAt,
    });

    await deps.createNotification(tx, {
      userId: booking.ownerId,
      type: 'booking_confirmed',
      title: 'Booking paid and confirmed',
      body: `${booking.customer.fullName} paid for ${booking.service.name}.`,
      payload: {
        bookingId: booking.id,
        customerId: booking.customerId,
      },
      createdAt: paidAt,
    });

    return createdPayment;
  });

  return deps.toPaymentRecord(payment);
}
