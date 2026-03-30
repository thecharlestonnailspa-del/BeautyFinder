import type {
  AdminActionRecord,
  AdminBusinessQueueItem,
  AdminConversationCase,
  BookingRecord,
  BusinessModerationStatus,
  BusinessSummary,
  MessageRecord,
  NotificationPreferenceRecord,
  NotificationRecord,
  OwnerBusinessProfile,
  OwnerServiceSummary,
  PaymentRecord,
  ReviewModerationStatus,
  StaffSummary,
} from '@beauty-finder/types';
import {
  BusinessCategory,
  BusinessStatus,
  PaymentMethod as PrismaPaymentMethod,
  PaymentStatus as PrismaPaymentStatus,
  Prisma,
  ReviewStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import type {
  AdminActionWithAdmin,
  BusinessWithOwner,
  BusinessWithRelations,
  PaymentWithRelations,
  ReviewWithRelations,
} from './marketplace.types';

export function sanitizeString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeEmail(value?: string | null) {
  return sanitizeString(value)?.toLowerCase();
}

export function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  return typeof value === 'number' ? value : value.toNumber();
}

export function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function getPaymentTaxRate(
  rawValue: string | undefined,
  fallbackRate: number,
) {
  const parsed = Number(rawValue);

  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return fallbackRate;
}

export function toPaymentMethod(method: 'card' | 'cash'): PrismaPaymentMethod {
  return method.toUpperCase() as PrismaPaymentMethod;
}

export function fromPaymentMethod(
  method: PrismaPaymentMethod,
): PaymentRecord['method'] {
  return method.toLowerCase() as PaymentRecord['method'];
}

export function fromPaymentStatus(
  status: PrismaPaymentStatus,
): PaymentRecord['status'] {
  return status.toLowerCase() as PaymentRecord['status'];
}

export function getDefaultNotificationPreferenceValues() {
  return {
    bookingCreated: true,
    bookingConfirmed: true,
    messageReceived: true,
    paymentReceipt: true,
    reviewReceived: true,
    system: true,
  };
}

export function getNotificationPreferenceKey(type: NotificationRecord['type']) {
  switch (type) {
    case 'booking_created':
      return 'bookingCreated';
    case 'booking_confirmed':
      return 'bookingConfirmed';
    case 'message_received':
      return 'messageReceived';
    case 'payment_receipt':
      return 'paymentReceipt';
    case 'review_received':
      return 'reviewReceived';
    case 'system':
    default:
      return 'system';
  }
}

export function isPromotionActive(business: {
  promotionDiscountPercent: number | null;
  promotionExpiresAt: Date | null;
}) {
  if (
    business.promotionDiscountPercent == null ||
    business.promotionDiscountPercent <= 0
  ) {
    return false;
  }

  if (
    business.promotionExpiresAt &&
    business.promotionExpiresAt.getTime() < Date.now()
  ) {
    return false;
  }

  return true;
}

export function createReceiptNumber() {
  return `BF-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;
}

export function fromBusinessStatus(
  status: BusinessStatus,
): BusinessModerationStatus {
  return status.toLowerCase() as BusinessModerationStatus;
}

export function toBusinessStatus(
  status: BusinessModerationStatus,
): BusinessStatus {
  return status.toUpperCase() as BusinessStatus;
}

export function fromReviewStatus(status: ReviewStatus): ReviewModerationStatus {
  return status.toLowerCase() as ReviewModerationStatus;
}

export function toReviewStatus(status: ReviewModerationStatus): ReviewStatus {
  return status.toUpperCase() as ReviewStatus;
}

export function toBusinessCategory(category: 'nail' | 'hair'): BusinessCategory {
  return category.toUpperCase() as BusinessCategory;
}

export function isBusinessCategory(value: string): value is 'nail' | 'hair' {
  return value === 'nail' || value === 'hair';
}

export function toOwnerServiceSummary(
  service: BusinessWithRelations['services'][number],
): OwnerServiceSummary {
  return {
    id: service.id,
    businessId: service.businessId,
    name: service.name,
    description: service.description ?? undefined,
    durationMinutes: service.durationMinutes,
    price: toNumber(service.price),
    isActive: service.isActive,
  };
}

export function toStaffSummary(
  staff: BusinessWithRelations['staff'][number],
): StaffSummary {
  return {
    id: staff.id,
    businessId: staff.businessId,
    name: staff.name,
    title: staff.title ?? undefined,
    isActive: staff.isActive,
  };
}

export function toBusinessSummary(
  business: BusinessWithRelations,
): BusinessSummary {
  return {
    id: business.id,
    ownerId: business.ownerUserId,
    category: business.category.toLowerCase() as BusinessSummary['category'],
    name: business.name,
    featuredOnHomepage: business.featuredOnHomepage,
    homepageRank: business.homepageRank,
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2 ?? undefined,
    city: business.city,
    state: business.state,
    postalCode: business.postalCode,
    latitude:
      business.latitude == null ? undefined : toNumber(business.latitude),
    longitude:
      business.longitude == null ? undefined : toNumber(business.longitude),
    rating: business.rating,
    reviewCount: business.reviewCount,
    heroImage: business.heroImage ?? business.images[0]?.url ?? '',
    description: business.description ?? '',
    services: business.services
      .filter((service) => service.isActive)
      .map((service) => ({
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        price: toNumber(service.price),
      })),
  };
}

export function toOwnerBusinessProfile(
  business: BusinessWithRelations,
): OwnerBusinessProfile {
  return {
    id: business.id,
    ownerId: business.ownerUserId,
    category:
      business.category.toLowerCase() as OwnerBusinessProfile['category'],
    status: fromBusinessStatus(business.status),
    name: business.name,
    featuredOnHomepage: business.featuredOnHomepage,
    homepageRank: business.homepageRank,
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2 ?? undefined,
    city: business.city,
    state: business.state,
    postalCode: business.postalCode,
    latitude:
      business.latitude == null ? undefined : toNumber(business.latitude),
    longitude:
      business.longitude == null ? undefined : toNumber(business.longitude),
    rating: business.rating,
    reviewCount: business.reviewCount,
    heroImage: business.heroImage ?? business.images[0]?.url ?? '',
    description: business.description ?? '',
    services: business.services
      .map((service) => toOwnerServiceSummary(service))
      .sort((left, right) => Number(right.isActive) - Number(left.isActive)),
    galleryImages: business.images
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((image) => image.url),
    videoUrl: business.videoUrl ?? undefined,
    staff: business.staff
      .map((staff) => toStaffSummary(staff))
      .sort((left, right) => Number(right.isActive) - Number(left.isActive)),
    promotion:
      business.promotionTitle && business.promotionDiscountPercent != null
        ? {
            title: business.promotionTitle,
            description: business.promotionDescription ?? undefined,
            discountPercent: business.promotionDiscountPercent,
            code: business.promotionCode ?? undefined,
            expiresAt: business.promotionExpiresAt?.toISOString(),
          }
        : undefined,
  };
}

export function getPublicBusinessInclude() {
  return {
    services: { where: { isActive: true } },
    images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
    staff: true,
  };
}

export function getPublicBusinessOrderBy() {
  return [
    { featuredOnHomepage: 'desc' as const },
    { homepageRank: 'asc' as const },
    { rating: 'desc' as const },
    { reviewCount: 'desc' as const },
    { name: 'asc' as const },
  ];
}

export function normalizeBusinessFilters(filters: {
  category?: string;
  city?: string;
  search?: string;
}) {
  const rawCategory = sanitizeString(filters.category)?.toLowerCase();
  const category =
    rawCategory && isBusinessCategory(rawCategory) ? rawCategory : undefined;
  const city = sanitizeString(filters.city)?.toLowerCase();
  const search = sanitizeString(filters.search)?.toLowerCase();
  const searchTerms = search?.split(/\s+/).filter(Boolean) ?? [];

  return {
    category,
    city,
    search,
    searchTerms,
  };
}

export function buildBusinessSearchWhere(filters: {
  category?: string;
  city?: string;
  search?: string;
}): Prisma.BusinessWhereInput {
  const normalized = normalizeBusinessFilters(filters);

  return {
    status: BusinessStatus.APPROVED,
    ...(normalized.category
      ? { category: toBusinessCategory(normalized.category) }
      : {}),
    ...(normalized.city
      ? {
          city: {
            equals: normalized.city,
            mode: 'insensitive',
          },
        }
      : {}),
    ...(normalized.searchTerms.length > 0
      ? {
          AND: normalized.searchTerms.map((term) => ({
            OR: [
              {
                name: {
                  contains: term,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: term,
                  mode: 'insensitive',
                },
              },
              {
                city: {
                  contains: term,
                  mode: 'insensitive',
                },
              },
              {
                addressLine1: {
                  contains: term,
                  mode: 'insensitive',
                },
              },
              {
                services: {
                  some: {
                    isActive: true,
                    OR: [
                      {
                        name: {
                          contains: term,
                          mode: 'insensitive',
                        },
                      },
                      {
                        description: {
                          contains: term,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          })),
        }
      : {}),
  };
}

export function sortBusinessesForHomepage(businesses: BusinessSummary[]) {
  return [...businesses].sort((left, right) => {
    if (left.featuredOnHomepage !== right.featuredOnHomepage) {
      return left.featuredOnHomepage ? -1 : 1;
    }

    if (left.homepageRank !== right.homepageRank) {
      return left.homepageRank - right.homepageRank;
    }

    if (left.rating !== right.rating) {
      return right.rating - left.rating;
    }

    if (left.reviewCount !== right.reviewCount) {
      return right.reviewCount - left.reviewCount;
    }

    return left.name.localeCompare(right.name);
  });
}

export function toBookingRecord(
  appointment: Prisma.AppointmentGetPayload<{ include: { service: true } }>,
): BookingRecord {
  return {
    id: appointment.id,
    customerId: appointment.customerId,
    ownerId: appointment.ownerId,
    businessId: appointment.businessId,
    serviceId: appointment.serviceId,
    serviceName: appointment.service.name,
    status: appointment.status.toLowerCase() as BookingRecord['status'],
    startAt: appointment.startTime.toISOString(),
    endAt: appointment.endTime.toISOString(),
    note: appointment.notes ?? undefined,
  };
}

export function toMessageRecord(message: {
  id: string;
  conversationId: string;
  senderUserId: string;
  content: string;
  createdAt: Date;
}): MessageRecord {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderUserId,
    body: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toNotificationRecord(notification: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  createdAt: Date;
  readAt: Date | null;
}): NotificationRecord {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type as NotificationRecord['type'],
    title: notification.title,
    body: notification.body ?? '',
    createdAt: notification.createdAt.toISOString(),
    read: Boolean(notification.readAt),
  };
}

export function toNotificationPreferenceRecord(preference: {
  userId: string;
  bookingCreated: boolean;
  bookingConfirmed: boolean;
  messageReceived: boolean;
  paymentReceipt: boolean;
  reviewReceived: boolean;
  system: boolean;
  updatedAt: Date;
}): NotificationPreferenceRecord {
  return {
    userId: preference.userId,
    bookingCreated: preference.bookingCreated,
    bookingConfirmed: preference.bookingConfirmed,
    messageReceived: preference.messageReceived,
    paymentReceipt: preference.paymentReceipt,
    reviewReceived: preference.reviewReceived,
    system: preference.system,
    updatedAt: preference.updatedAt.toISOString(),
  };
}

export function toPaymentRecord(payment: PaymentWithRelations): PaymentRecord {
  return {
    id: payment.id,
    bookingId: payment.appointmentId,
    customerId: payment.appointment.customerId,
    ownerId: payment.appointment.ownerId,
    businessId: payment.appointment.businessId,
    serviceId: payment.appointment.serviceId,
    method: fromPaymentMethod(payment.method),
    status: fromPaymentStatus(payment.status),
    subtotal: toNumber(payment.subtotalAmount),
    discount: toNumber(payment.discountAmount),
    tax: toNumber(payment.taxAmount),
    tip: toNumber(payment.tipAmount),
    total: toNumber(payment.totalAmount),
    currency: payment.currency,
    receiptNumber: payment.receiptNumber,
    cardBrand: payment.cardBrand ?? undefined,
    cardLast4: payment.cardLast4 ?? undefined,
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  };
}

export function toAdminBusinessQueueItem(
  business: BusinessWithOwner,
): AdminBusinessQueueItem {
  return {
    id: business.id,
    ownerId: business.ownerUserId,
    ownerName: business.owner.fullName,
    ownerEmail: business.owner.email,
    category: business.category.toLowerCase() as AdminBusinessQueueItem['category'],
    name: business.name,
    status: fromBusinessStatus(business.status),
    featuredOnHomepage: business.featuredOnHomepage,
    homepageRank: business.homepageRank,
    city: business.city,
    state: business.state,
    createdAt: business.createdAt.toISOString(),
  };
}

export function toAdminReviewQueueItem(review: ReviewWithRelations) {
  return {
    id: review.id,
    appointmentId: review.appointmentId ?? undefined,
    businessId: review.businessId,
    businessName: review.business.name,
    customerId: review.customerId,
    customerName: review.customer.fullName,
    rating: review.rating,
    comment: review.comment ?? '',
    status: fromReviewStatus(review.status),
    createdAt: review.createdAt.toISOString(),
  };
}

export function toAdminActionRecord(
  action: AdminActionWithAdmin,
): AdminActionRecord {
  return {
    id: action.id,
    adminUserId: action.adminUserId,
    adminName: action.admin.fullName,
    targetType: action.targetType,
    targetId: action.targetId,
    action: action.action,
    metadata: action.metadata ?? undefined,
    createdAt: action.createdAt.toISOString(),
  };
}

export function serializeAdminMetadata(
  note?: string,
  extra?: Record<string, unknown>,
) {
  if (!note && !extra) {
    return undefined;
  }

  return JSON.stringify({
    ...(note ? { note } : {}),
    ...(extra ?? {}),
  });
}

export function getConversationPriority(
  lastMessage: string,
  bookingId?: string,
): AdminConversationCase['priority'] {
  if (
    /(refund|dispute|chargeback|complaint|angry|reschedule|cancel)/i.test(
      lastMessage,
    ) ||
    bookingId
  ) {
    return 'high';
  }

  return 'normal';
}

export function getConversationCaseStatus(
  action?: string,
): AdminConversationCase['caseStatus'] {
  if (action === 'watch_conversation') {
    return 'watched';
  }

  if (action === 'resolve_conversation') {
    return 'resolved';
  }

  return 'open';
}
