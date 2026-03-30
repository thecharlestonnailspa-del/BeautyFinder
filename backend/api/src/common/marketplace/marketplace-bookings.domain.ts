import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { BookingRecord, Role, UserSummary } from '@beauty-finder/types';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { toBookingRecord } from './marketplace-mappers.helpers';
import type { PrismaService } from '../prisma.service';

export type BookingsDomainDependencies = {
  prisma: PrismaService;
  resolveScopedUserId: (
    actor: UserSummary,
    requestedUserId?: string,
  ) => string;
  resolveScopedBookingRole: (
    actor: UserSummary,
    requestedRole?: Role,
  ) => Role;
  createNotification: (
    client: Prisma.TransactionClient,
    input: {
      userId: string;
      type: 'booking_created';
      title: string;
      body?: string;
      payload?: Record<string, unknown>;
      createdAt?: Date;
    },
  ) => Promise<unknown>;
  invalidateAvailabilityCache: () => Promise<void>;
};

export type CreateBookingInput = Omit<BookingRecord, 'id' | 'status'> & {
  status?: BookingRecord['status'];
};

export async function getBookingsFlow(
  deps: BookingsDomainDependencies,
  actor: UserSummary,
  requestedUserId?: string,
  requestedRole?: Role,
): Promise<BookingRecord[]> {
  const userId = deps.resolveScopedUserId(actor, requestedUserId);
  const role = deps.resolveScopedBookingRole(actor, requestedRole);

  const where =
    role === 'owner'
      ? { ownerId: userId }
      : role === 'admin'
        ? {}
        : { customerId: userId };

  const bookings = await deps.prisma.appointment.findMany({
    where,
    include: { service: true },
    orderBy: { startTime: 'desc' },
  });

  return bookings.map((booking) => toBookingRecord(booking));
}

export async function createBookingFlow(
  deps: BookingsDomainDependencies,
  input: CreateBookingInput,
  actor: UserSummary,
): Promise<BookingRecord> {
  const created = await deps.prisma.$transaction(async (tx) => {
    const business = await tx.business.findUnique({
      where: { id: input.businessId },
      select: {
        ownerUserId: true,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (actor.role === 'customer' && input.customerId !== actor.id) {
      throw new ForbiddenException(
        'Customers can only create bookings for themselves',
      );
    }

    if (actor.role === 'owner' && business.ownerUserId !== actor.id) {
      throw new ForbiddenException(
        'Owners can only create bookings for their own businesses',
      );
    }

    const service = await tx.service.findFirst({
      where: {
        id: input.serviceId,
        businessId: input.businessId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found for this business');
    }

    const slot = await tx.availabilitySlot.findFirst({
      where: {
        businessId: input.businessId,
        serviceId: input.serviceId,
        startTime: new Date(input.startAt),
        endTime: new Date(input.endAt),
      },
      select: {
        id: true,
        staffId: true,
        isBooked: true,
      },
    });

    if (!slot) {
      throw new NotFoundException('Availability slot not found');
    }

    if (slot.isBooked) {
      throw new ConflictException('Availability slot is already booked');
    }

    const appointment = await tx.appointment.create({
      data: {
        customerId: input.customerId,
        ownerId: business.ownerUserId,
        businessId: input.businessId,
        serviceId: service.id,
        staffId: slot.staffId,
        status: (
          input.status ?? 'pending'
        ).toUpperCase() as AppointmentStatus,
        startTime: new Date(input.startAt),
        endTime: new Date(input.endAt),
        notes: input.note,
      },
      include: { service: true },
    });

    await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        oldStatus: null,
        newStatus: appointment.status,
        changedByUserId: actor.id,
      },
    });

    await tx.availabilitySlot.update({
      where: { id: slot.id },
      data: { isBooked: true },
    });

    await deps.createNotification(tx, {
      userId: business.ownerUserId,
      type: 'booking_created',
      title: 'New booking request',
      body: `${service.name} was requested.`,
    });

    await deps.createNotification(tx, {
      userId: input.customerId,
      type: 'booking_created',
      title: 'Booking request received',
      body: `${service.name} was sent to the salon for confirmation.`,
    });

    return appointment;
  });

  await deps.invalidateAvailabilityCache();

  return toBookingRecord(created);
}
