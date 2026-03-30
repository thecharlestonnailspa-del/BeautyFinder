import { BadRequestException } from '@nestjs/common';
import type {
  NotificationPreferenceInput,
  NotificationPreferenceRecord,
  NotificationRecord,
  UserSummary,
} from '@beauty-finder/types';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma.service';

export type NotificationClient = Prisma.TransactionClient | PrismaService;

export type NotificationPreferenceDefaults = {
  bookingCreated: boolean;
  bookingConfirmed: boolean;
  messageReceived: boolean;
  paymentReceipt: boolean;
  reviewReceived: boolean;
  system: boolean;
};

export type NotificationRecordShape = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  createdAt: Date;
  readAt: Date | null;
};

export type NotificationPreferenceShape = {
  userId: string;
  bookingCreated: boolean;
  bookingConfirmed: boolean;
  messageReceived: boolean;
  paymentReceipt: boolean;
  reviewReceived: boolean;
  system: boolean;
  updatedAt: Date;
};

export type NotificationDomainDependencies = {
  prisma: PrismaService;
  resolveScopedUserId: (
    actor: UserSummary,
    requestedUserId?: string,
  ) => string;
  getDefaultNotificationPreferenceValues: () => NotificationPreferenceDefaults;
  getNotificationPreferenceKey: (
    type: NotificationRecord['type'],
  ) => keyof NotificationPreferenceDefaults;
  toNotificationRecord: (notification: NotificationRecordShape) => NotificationRecord;
  toNotificationPreferenceRecord: (
    preference: NotificationPreferenceShape,
  ) => NotificationPreferenceRecord;
};

export async function getNotificationPreferenceState(
  deps: NotificationDomainDependencies,
  userId: string,
  client: NotificationClient = deps.prisma,
) {
  const preference = await client.notificationPreference.findUnique({
    where: { userId },
  });

  return preference ?? { userId, ...deps.getDefaultNotificationPreferenceValues() };
}

export async function createNotificationFlow(
  deps: NotificationDomainDependencies,
  client: NotificationClient,
  input: {
    userId: string;
    type: NotificationRecord['type'];
    title: string;
    body?: string;
    payload?: Record<string, unknown>;
    createdAt?: Date;
  },
) {
  const preference = await getNotificationPreferenceState(deps, input.userId, client);
  const preferenceKey = deps.getNotificationPreferenceKey(input.type);

  if (!preference[preferenceKey]) {
    return null;
  }

  return client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload ? JSON.stringify(input.payload) : null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

export async function getNotificationsFlow(
  deps: NotificationDomainDependencies,
  actor: UserSummary,
  requestedUserId?: string,
): Promise<NotificationRecord[]> {
  const userId = deps.resolveScopedUserId(actor, requestedUserId);

  const notifications = await deps.prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return notifications.map((notification) =>
    deps.toNotificationRecord(notification),
  );
}

export async function getNotificationPreferencesFlow(
  deps: NotificationDomainDependencies,
  actor: UserSummary,
  requestedUserId?: string,
): Promise<NotificationPreferenceRecord> {
  const userId = deps.resolveScopedUserId(actor, requestedUserId);
  const preferences = await deps.prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
    },
  });

  return deps.toNotificationPreferenceRecord(preferences);
}

export async function updateNotificationPreferencesFlow(
  deps: NotificationDomainDependencies,
  actor: UserSummary,
  input: NotificationPreferenceInput,
  requestedUserId?: string,
): Promise<NotificationPreferenceRecord> {
  const userId = deps.resolveScopedUserId(actor, requestedUserId);
  const preferences = await deps.prisma.notificationPreference.upsert({
    where: { userId },
    update: input,
    create: {
      userId,
      ...deps.getDefaultNotificationPreferenceValues(),
      ...input,
    },
  });

  return deps.toNotificationPreferenceRecord(preferences);
}

export async function markNotificationsReadFlow(
  deps: NotificationDomainDependencies,
  actor: UserSummary,
  input: {
    notificationIds?: string[];
    markAll?: boolean;
  },
  requestedUserId?: string,
): Promise<NotificationRecord[]> {
  const userId = deps.resolveScopedUserId(actor, requestedUserId);

  if (
    !input.markAll &&
    (!input.notificationIds || input.notificationIds.length === 0)
  ) {
    throw new BadRequestException(
      'Provide notificationIds or set markAll to true',
    );
  }

  await deps.prisma.notification.updateMany({
    where: {
      userId,
      ...(input.markAll
        ? {}
        : {
            id: {
              in: input.notificationIds,
            },
          }),
    },
    data: {
      readAt: new Date(),
    },
  });

  return getNotificationsFlow(deps, actor, userId);
}
