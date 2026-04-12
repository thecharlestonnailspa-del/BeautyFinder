import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AdPlacement,
  AdPricingRecord,
  AdminActionRecord,
  AdminAccountSummary,
  AdminAccountUpdateInput,
  AdminBusinessQueueItem,
  AdminConversationCase,
  AdminOverview,
  AvailabilitySlotSummary,
  BookingRecord,
  BusinessModerationStatus,
  CheckoutPaymentInput,
  CreateReviewInput,
    CustomerPreferenceReportRecord,
    CreatePrivateTechnicianAdInput,
    OwnerBusinessProfile,
    OwnerAudienceReportRecord,
    OwnerBusinessUpdateInput,
    OwnerServiceSummary,
    OwnerTechnicianInput,
    OwnerTechnicianProfile,
    PrivateTechnicianAdRecord,
    PrivateTechnicianProfileRecord,
    PrivateTechnicianProfileStatus,
    BusinessSummary,
    CategorySummary,
    ConversationRecord,
    MessageRecord,
    NotificationPreferenceInput,
  NotificationPreferenceRecord,
  NotificationRecord,
  PaymentRecord,
  RecordBusinessPageViewInput,
    RegisterPrivateTechnicianInput,
    Role,
    ReviewRecord,
    ReviewModerationStatus,
    SessionPayload,
    StaffSummary,
    UpdateAdPricingInput,
    UpdatePrivateTechnicianAdInput,
    UpdatePrivateTechnicianProfileInput,
    UserStatus,
    UserSummary,
  } from '@beauty-finder/types';
import {
    BusinessCategory,
    BusinessStatus,
    PrivateTechnicianAdStatus,
    PrivateTechnicianProfileStatus as PrismaPrivateTechnicianProfileStatus,
    Prisma,
    ProfessionalAccountType,
    RoleName,
    ReviewStatus,
    UserStatus as PrismaUserStatus,
    VerificationStatus,
  } from '@prisma/client';
import { createHash } from 'crypto';
import { extname } from 'node:path';
import { getJwtSecret, getJwtTtlSeconds } from './auth.config';
import type { AccessTokenClaims } from './marketplace/marketplace-auth.helpers';
import * as adminDomain from './marketplace/marketplace-admin.domain';
import * as authHelpers from './marketplace/marketplace-auth.helpers';
import * as bookingsDomain from './marketplace/marketplace-bookings.domain';
import * as marketplaceHelpers from './marketplace/marketplace-mappers.helpers';
import * as messagingDomain from './marketplace/marketplace-messaging.domain';
import * as notificationsDomain from './marketplace/marketplace-notifications.domain';
import * as paymentsDomain from './marketplace/marketplace-payments.domain';
import type {
    AdminActionWithAdmin,
    BusinessWithOwner,
    BusinessWithRelations,
    PaymentWithRelations,
    PrivateTechnicianProfileWithRelations,
    ReviewWithRelations,
    UserWithRoles,
  } from './marketplace/marketplace.types';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { OwnerMediaStorageService } from './owner-media-storage.service';

type PrismaAdPlacementValue =
  | 'HOMEPAGE_SPOTLIGHT'
  | 'CATEGORY_BOOST'
  | 'CITY_BOOST';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService = new RedisService(),
    private readonly ownerMediaStorage: OwnerMediaStorageService = new OwnerMediaStorageService(),
  ) {}

  private readonly categoryLabels: Record<BusinessSummary['category'], string> =
    {
      nail: 'Nail',
      hair: 'Hair',
    };

  private readonly businessStatusOrder: Record<
    BusinessModerationStatus,
    number
  > = {
    pending_review: 0,
    approved: 1,
    suspended: 2,
    rejected: 3,
    draft: 4,
  };

  private readonly conversationCaseStatusOrder: Record<
    AdminConversationCase['caseStatus'],
    number
  > = {
    open: 0,
    watched: 1,
    resolved: 2,
  };

  private readonly accessTokenIssuer = 'beauty-finder-api';
  private readonly catalogCacheNamespace = 'catalog';
  private readonly availabilityCacheNamespace = 'availability';
  private readonly catalogCacheTtlSeconds = 60;
  private readonly categoryCacheTtlSeconds = 300;
  private readonly businessDetailCacheTtlSeconds = 120;
  private readonly availabilityCacheTtlSeconds = 30;
  private readonly paymentCurrency = 'USD';
  private readonly defaultPaymentTaxRate = 0.08;
  private readonly defaultAdPricingCatalog: ReadonlyArray<AdPricingRecord> = [
    {
      placement: 'homepage_spotlight',
      label: 'Homepage Spotlight',
      dailyPrice: 79,
      monthlyPrice: 1990,
      currency: 'USD',
      note: 'Prime homepage inventory for the highest-visibility salons.',
      updatedAt: '2026-03-20T12:00:00.000Z',
    },
    {
      placement: 'category_boost',
      label: 'Category Boost',
      dailyPrice: 45,
      monthlyPrice: 1190,
      currency: 'USD',
      note: 'Raises salon visibility inside category browsing results.',
      updatedAt: '2026-03-20T12:00:00.000Z',
    },
    {
      placement: 'city_boost',
      label: 'City Boost',
      dailyPrice: 52,
      monthlyPrice: 1390,
      currency: 'USD',
      note: 'Adds extra local discovery weight inside a selected city.',
      updatedAt: '2026-03-20T12:00:00.000Z',
    },
  ];
  private readonly adPlacementOrder: Record<AdPlacement, number> = {
    homepage_spotlight: 0,
    category_boost: 1,
    city_boost: 2,
  };

  private toBase64Url(input: string | Buffer) {
    return authHelpers.toBase64Url(input);
  }

  private signAccessTokenValue(value: string) {
    return authHelpers.signAccessTokenValue(value, getJwtSecret());
  }

  private parseAccessToken(token: string): AccessTokenClaims | undefined {
    return authHelpers.parseAccessToken(token, {
      issuer: this.accessTokenIssuer,
      secret: getJwtSecret(),
    });
  }

  private toRoleName(role: Role): RoleName {
    return authHelpers.toRoleName(role);
  }

  private fromRoleName(role: RoleName): Role {
    return authHelpers.fromRoleName(role);
  }

  private toAdPlacement(placement: AdPlacement): PrismaAdPlacementValue {
    return placement.toUpperCase() as PrismaAdPlacementValue;
  }

  private fromAdPlacement(placement: PrismaAdPlacementValue): AdPlacement {
    return placement.toLowerCase() as AdPlacement;
  }

  private toAdPricingRecord(pricing: {
    placement: PrismaAdPlacementValue;
    label: string;
    dailyPrice: Prisma.Decimal | number;
    monthlyPrice: Prisma.Decimal | number;
    currency: string;
    note: string | null;
    updatedAt: Date;
    updatedByUserId: string | null;
  }): AdPricingRecord {
    return {
      placement: this.fromAdPlacement(pricing.placement),
      label: pricing.label,
      dailyPrice: this.toNumber(pricing.dailyPrice),
      monthlyPrice: this.toNumber(pricing.monthlyPrice),
      currency: pricing.currency,
      note: pricing.note ?? undefined,
      updatedAt: pricing.updatedAt.toISOString(),
      updatedByUserId: pricing.updatedByUserId ?? undefined,
    };
  }

  private async ensureAdPricingCatalog() {
    await Promise.all(
      this.defaultAdPricingCatalog.map((pricing) =>
        this.prisma.adPricing.upsert({
          where: {
            placement: this.toAdPlacement(pricing.placement),
          },
          update: {},
          create: {
            placement: this.toAdPlacement(pricing.placement),
            label: pricing.label,
            dailyPrice: pricing.dailyPrice,
            monthlyPrice: pricing.monthlyPrice,
            currency: pricing.currency,
            note: pricing.note ?? null,
            updatedAt: new Date(pricing.updatedAt),
          },
        }),
      ),
    );
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    return marketplaceHelpers.toNumber(value);
  }

  private roundCurrency(amount: number) {
    return marketplaceHelpers.roundCurrency(amount);
  }

  private getPaymentTaxRate() {
    return marketplaceHelpers.getPaymentTaxRate(
      process.env.PAYMENT_TAX_RATE,
      this.defaultPaymentTaxRate,
    );
  }

  private toPaymentMethod(method: 'card' | 'cash') {
    return marketplaceHelpers.toPaymentMethod(method);
  }

  private fromPaymentMethod(method: PaymentWithRelations['method']) {
    return marketplaceHelpers.fromPaymentMethod(method);
  }

  private fromPaymentStatus(status: PaymentWithRelations['status']) {
    return marketplaceHelpers.fromPaymentStatus(status);
  }

  private getDefaultNotificationPreferenceValues() {
    return marketplaceHelpers.getDefaultNotificationPreferenceValues();
  }

  private getNotificationPreferenceKey(type: NotificationRecord['type']) {
    return marketplaceHelpers.getNotificationPreferenceKey(type);
  }

  private isPromotionActive(business: {
    promotionDiscountPercent: number | null;
    promotionExpiresAt: Date | null;
  }) {
    return marketplaceHelpers.isPromotionActive(business);
  }

  private createReceiptNumber() {
    return marketplaceHelpers.createReceiptNumber();
  }

  private fromBusinessStatus(status: BusinessStatus): BusinessModerationStatus {
    return marketplaceHelpers.fromBusinessStatus(status);
  }

  private toBusinessStatus(status: BusinessModerationStatus): BusinessStatus {
    return marketplaceHelpers.toBusinessStatus(status);
  }

  private fromReviewStatus(status: ReviewStatus): ReviewModerationStatus {
    return marketplaceHelpers.fromReviewStatus(status);
  }

  private toReviewStatus(status: ReviewModerationStatus): ReviewStatus {
    return marketplaceHelpers.toReviewStatus(status);
  }

  private toUserSummary(user: UserWithRoles): UserSummary {
    return authHelpers.toUserSummary(user);
  }

  private toBusinessSummary(business: BusinessWithRelations): BusinessSummary {
    return marketplaceHelpers.toBusinessSummary(business);
  }

  private toOwnerServiceSummary(
    service: BusinessWithRelations['services'][number],
  ): OwnerServiceSummary {
    return marketplaceHelpers.toOwnerServiceSummary(service);
  }

  private toStaffSummary(
    staff: BusinessWithRelations['staff'][number],
  ): StaffSummary {
    return marketplaceHelpers.toStaffSummary(staff);
  }

  private toPrivateTechnicianProfileRecord(
    profile: PrivateTechnicianProfileWithRelations,
  ): PrivateTechnicianProfileRecord {
    return marketplaceHelpers.toPrivateTechnicianProfileRecord(profile);
  }

  private toPrivateTechnicianAdRecord(
    ad: PrivateTechnicianProfileWithRelations['ads'][number],
  ): PrivateTechnicianAdRecord {
    return marketplaceHelpers.toPrivateTechnicianAdRecord(ad);
  }

  private toPrivateTechnicianAdStatus(
    status: UpdatePrivateTechnicianAdInput['status'],
  ) {
    if (!status) {
      return undefined;
    }

    return marketplaceHelpers.toPrivateTechnicianAdStatus(status);
  }

  private toPrivateTechnicianProfileStatus(
    status: PrivateTechnicianProfileStatus,
  ): PrismaPrivateTechnicianProfileStatus {
    return marketplaceHelpers.toPrivateTechnicianProfileStatus(status);
  }

  private toOwnerBusinessProfile(
    business: BusinessWithRelations,
  ): OwnerBusinessProfile {
    return marketplaceHelpers.toOwnerBusinessProfile(business);
  }

  private sanitizeString(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalizeColorSignals(input?: string[] | null) {
    return (input ?? [])
      .map((color) => this.sanitizeString(color)?.toLowerCase())
      .filter((color): color is string => Boolean(color));
  }

  private serializeColorSignals(input?: string[] | null) {
    const normalized = this.normalizeColorSignals(input);
    return normalized.length > 0 ? JSON.stringify(normalized) : null;
  }

  private parseColorSignals(value?: string | null) {
    const normalized = this.sanitizeString(value);

    if (!normalized) {
      return [];
    }

    try {
      const parsed = JSON.parse(normalized);

      if (Array.isArray(parsed)) {
        return this.normalizeColorSignals(
          parsed.filter((item): item is string => typeof item === 'string'),
        );
      }
    } catch {
      // Fall through to legacy plain-text parsing.
    }

    return this.normalizeColorSignals(normalized.split(','));
  }

  private normalizeUploadBase64(value: string) {
    const trimmed = value.trim();
    const normalized = trimmed.includes(',')
      ? trimmed.slice(trimmed.indexOf(',') + 1)
      : trimmed;

    if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
      throw new BadRequestException('Uploaded file body is not valid base64');
    }

    return normalized;
  }

  private resolveImageUploadType(filename?: string, contentType?: string) {
    const normalizedContentType =
      this.sanitizeString(contentType)?.toLowerCase();
    const normalizedExtension = extname(filename ?? '').toLowerCase();
    const supportedTypes = {
      '.avif': { contentType: 'image/avif', extension: 'avif' },
      '.gif': { contentType: 'image/gif', extension: 'gif' },
      '.heic': { contentType: 'image/heic', extension: 'heic' },
      '.heif': { contentType: 'image/heif', extension: 'heif' },
      '.jpeg': { contentType: 'image/jpeg', extension: 'jpg' },
      '.jpg': { contentType: 'image/jpeg', extension: 'jpg' },
      '.png': { contentType: 'image/png', extension: 'png' },
      '.webp': { contentType: 'image/webp', extension: 'webp' },
      'image/avif': { contentType: 'image/avif', extension: 'avif' },
      'image/gif': { contentType: 'image/gif', extension: 'gif' },
      'image/heic': { contentType: 'image/heic', extension: 'heic' },
      'image/heif': { contentType: 'image/heif', extension: 'heif' },
      'image/jpeg': { contentType: 'image/jpeg', extension: 'jpg' },
      'image/jpg': { contentType: 'image/jpeg', extension: 'jpg' },
      'image/png': { contentType: 'image/png', extension: 'png' },
      'image/webp': { contentType: 'image/webp', extension: 'webp' },
    } as const;

    const resolvedFromContentType = normalizedContentType
      ? supportedTypes[normalizedContentType as keyof typeof supportedTypes]
      : undefined;
    const resolvedFromExtension = normalizedExtension
      ? supportedTypes[normalizedExtension as keyof typeof supportedTypes]
      : undefined;

    const resolvedType = resolvedFromContentType ?? resolvedFromExtension;

    if (!resolvedType) {
      throw new BadRequestException(
        'Only PNG, JPG, WEBP, GIF, AVIF, HEIC, and HEIF images can be uploaded',
      );
    }

    return resolvedType;
  }

  private normalizeEmail(value?: string | null) {
    return marketplaceHelpers.normalizeEmail(value);
  }

  private hashLegacyPassword(password: string) {
    return authHelpers.hashLegacyPassword(password);
  }

  private hashPassword(password: string) {
    return authHelpers.hashPassword(password);
  }

  private verifyPassword(password: string, passwordHash: string) {
    return authHelpers.verifyPassword(password, passwordHash);
  }

  private needsPasswordRehash(passwordHash: string) {
    return authHelpers.needsPasswordRehash(passwordHash);
  }

  private buildSessionPayload(
    user: UserWithRoles,
    issuedToken?: string,
    expiresAt?: string,
  ): SessionPayload {
    return authHelpers.buildSessionPayload(user, {
      issuer: this.accessTokenIssuer,
      secret: getJwtSecret(),
      ttlSeconds: getJwtTtlSeconds(),
      issuedToken,
      expiresAt,
    });
  }

  private toBusinessCategory(category: 'nail' | 'hair'): BusinessCategory {
    return marketplaceHelpers.toBusinessCategory(category);
  }

  private isBusinessCategory(value: string): value is 'nail' | 'hair' {
    return marketplaceHelpers.isBusinessCategory(value);
  }

  private getPublicBusinessInclude() {
    return marketplaceHelpers.getPublicBusinessInclude();
  }

  private getPublicBusinessOrderBy() {
    return marketplaceHelpers.getPublicBusinessOrderBy();
  }

  private normalizeBusinessFilters(filters: {
    category?: string;
    city?: string;
    search?: string;
  }) {
    return marketplaceHelpers.normalizeBusinessFilters(filters);
  }

  private buildBusinessSearchWhere(filters: {
    category?: string;
    city?: string;
    search?: string;
  }): Prisma.BusinessWhereInput {
    return marketplaceHelpers.buildBusinessSearchWhere(filters);
  }

  private async rememberNamespacedValue<T>(
    namespace: string,
    scope: string,
    input: unknown,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ) {
    const version = await this.redis.getNamespaceVersion(namespace);
    const digest = createHash('sha256')
      .update(JSON.stringify({ scope, input }))
      .digest('hex');

    return this.redis.rememberJson(
      `beauty-finder:${namespace}:${scope}:v${version}:${digest}`,
      ttlSeconds,
      loader,
    );
  }

  private rememberCatalogValue<T>(
    scope: string,
    input: unknown,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ) {
    return this.rememberNamespacedValue(
      this.catalogCacheNamespace,
      scope,
      input,
      ttlSeconds,
      loader,
    );
  }

  private rememberAvailabilityValue<T>(
    scope: string,
    input: unknown,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ) {
    return this.rememberNamespacedValue(
      this.availabilityCacheNamespace,
      scope,
      input,
      ttlSeconds,
      loader,
    );
  }

  private async invalidateCatalogCache() {
    await this.redis.bumpNamespaceVersion(this.catalogCacheNamespace);
  }

  private async invalidateAvailabilityCache() {
    await this.redis.bumpNamespaceVersion(this.availabilityCacheNamespace);
  }

  private async invalidatePublicBusinessCaches() {
    await Promise.all([
      this.invalidateCatalogCache(),
      this.invalidateAvailabilityCache(),
    ]);
  }

  private resolveScopedUserId(actor: UserSummary, requestedUserId?: string) {
    if (actor.role === 'admin') {
      return requestedUserId ?? actor.id;
    }

    if (!requestedUserId || requestedUserId === actor.id) {
      return actor.id;
    }

    throw new ForbiddenException(
      'You can only access data inside your own account scope',
    );
  }

  private resolveScopedBookingRole(
    actor: UserSummary,
    requestedRole?: Role,
  ): Role {
    if (actor.role === 'admin') {
      return requestedRole ?? 'admin';
    }

    if (!requestedRole || requestedRole === actor.role) {
      return actor.role;
    }

    throw new ForbiddenException(
      'You can only view bookings inside your own role scope',
    );
  }

  private sortBusinessesForHomepage(businesses: BusinessSummary[]) {
    return marketplaceHelpers.sortBusinessesForHomepage(businesses);
  }

  private toNotificationRecord(notification: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string | null;
    createdAt: Date;
    readAt: Date | null;
  }): NotificationRecord {
    return marketplaceHelpers.toNotificationRecord(notification);
  }

  private toNotificationPreferenceRecord(preference: {
    userId: string;
    bookingCreated: boolean;
    bookingConfirmed: boolean;
    messageReceived: boolean;
    paymentReceipt: boolean;
    reviewReceived: boolean;
    system: boolean;
    updatedAt: Date;
  }): NotificationPreferenceRecord {
    return marketplaceHelpers.toNotificationPreferenceRecord(preference);
  }

  private toPaymentRecord(payment: PaymentWithRelations): PaymentRecord {
    return marketplaceHelpers.toPaymentRecord(payment);
  }

  private toAdminBusinessQueueItem(
    business: BusinessWithOwner,
  ): AdminBusinessQueueItem {
    return marketplaceHelpers.toAdminBusinessQueueItem(business);
  }

  private toAdminReviewQueueItem(review: ReviewWithRelations) {
    return marketplaceHelpers.toAdminReviewQueueItem(review);
  }

  private toAdminActionRecord(action: AdminActionWithAdmin): AdminActionRecord {
    return marketplaceHelpers.toAdminActionRecord(action);
  }

  private fromUserStatus(status: PrismaUserStatus): UserStatus {
    return status.toLowerCase() as UserStatus;
  }

  private toUserStatus(status: UserStatus): PrismaUserStatus {
    return status.toUpperCase() as PrismaUserStatus;
  }

  private getRolePriority(role: Role) {
    switch (role) {
      case 'admin':
        return 0;
      case 'owner':
        return 1;
      case 'technician':
        return 2;
      case 'customer':
      default:
        return 3;
    }
  }

  private getPrimaryRole(roles: { role: RoleName }[]): Role {
    return (
      roles
        .map((entry) => this.fromRoleName(entry.role))
        .sort((left, right) => this.getRolePriority(left) - this.getRolePriority(right))[0] ??
      'customer'
    );
  }

  private toAdminAccountSummary(
    user: Prisma.UserGetPayload<{
      include: {
        roles: true;
        _count: { select: { ownedBusinesses: true } };
      };
    }>,
  ): AdminAccountSummary {
    const roles = user.roles.map((entry) => this.fromRoleName(entry.role));
    const primaryRole = this.getPrimaryRole(user.roles);

    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone: user.phone ?? undefined,
      status: this.fromUserStatus(user.status),
      roles,
      primaryRole,
      accountType:
        primaryRole === 'owner'
          ? 'salon_owner'
          : primaryRole === 'technician'
            ? 'private_technician'
            : undefined,
      businessCount: user._count.ownedBusinesses,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private toReviewRecord(
    review: Prisma.ReviewGetPayload<{ include: { customer: true; images: true } }>,
  ): ReviewRecord {
    return {
      id: review.id,
      appointmentId: review.appointmentId ?? undefined,
      businessId: review.businessId,
      customerId: review.customerId,
      customerName: review.customer.fullName,
      customerAvatarUrl: review.customerAvatarUrl ?? undefined,
      rating: review.rating,
      comment: review.comment ?? '',
      imageUrls: review.images
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((image) => image.url),
      createdAt: review.createdAt.toISOString(),
    };
  }

  private getTopScores(map: Map<string, number>, limit = 5) {
    return [...map.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit)
      .map(([label, score]) => ({ label, score }));
  }

  private addScore(
    map: Map<string, number>,
    label?: string | null,
    amount = 1,
  ) {
    const normalized = this.sanitizeString(label);

    if (!normalized) {
      return;
    }

    map.set(normalized, (map.get(normalized) ?? 0) + amount);
  }

  private getNotificationDomainDependencies(): notificationsDomain.NotificationDomainDependencies {
    return {
      prisma: this.prisma,
      resolveScopedUserId: (actor, requestedUserId) =>
        this.resolveScopedUserId(actor, requestedUserId),
      getDefaultNotificationPreferenceValues: () =>
        this.getDefaultNotificationPreferenceValues(),
      getNotificationPreferenceKey: (type) =>
        this.getNotificationPreferenceKey(type),
      toNotificationRecord: (notification) =>
        this.toNotificationRecord(notification),
      toNotificationPreferenceRecord: (preference) =>
        this.toNotificationPreferenceRecord(preference),
    };
  }

  private getAdminDomainDependencies(): adminDomain.AdminDomainDependencies {
    return {
      prisma: this.prisma,
      businessStatusOrder: this.businessStatusOrder,
      conversationCaseStatusOrder: this.conversationCaseStatusOrder,
      toBusinessStatus: (value) => this.toBusinessStatus(value),
      fromBusinessStatus: (value) => this.fromBusinessStatus(value),
      toReviewStatus: (value) => this.toReviewStatus(value),
      fromReviewStatus: (value) => this.fromReviewStatus(value),
      toAdminBusinessQueueItem: (business) =>
        this.toAdminBusinessQueueItem(business),
      toAdminReviewQueueItem: (review) => this.toAdminReviewQueueItem(review),
      toAdminActionRecord: (action) => this.toAdminActionRecord(action),
      getConversationPriority: (lastMessage, bookingId) =>
        this.getConversationPriority(lastMessage, bookingId),
      getConversationCaseStatus: (action) =>
        this.getConversationCaseStatus(action),
      createNotification: (client, notification) =>
        notificationsDomain.createNotificationFlow(
          this.getNotificationDomainDependencies(),
          client,
          notification,
        ),
      invalidateCatalogCache: () => this.invalidateCatalogCache(),
      getPublicBusinessInclude: () => this.getPublicBusinessInclude(),
    };
  }

  private getBookingsDomainDependencies(): bookingsDomain.BookingsDomainDependencies {
    return {
      prisma: this.prisma,
      resolveScopedUserId: (actor, requestedUserId) =>
        this.resolveScopedUserId(actor, requestedUserId),
      resolveScopedBookingRole: (actor, requestedRole) =>
        this.resolveScopedBookingRole(actor, requestedRole),
      createNotification: (client, notification) =>
        notificationsDomain.createNotificationFlow(
          this.getNotificationDomainDependencies(),
          client,
          notification,
        ),
      invalidateAvailabilityCache: () => this.invalidateAvailabilityCache(),
    };
  }

  private getMessagingDomainDependencies(): messagingDomain.MessagingDomainDependencies {
    return {
      prisma: this.prisma,
      resolveScopedUserId: (actor, requestedUserId) =>
        this.resolveScopedUserId(actor, requestedUserId),
      createNotification: (client, notification) =>
        notificationsDomain.createNotificationFlow(
          this.getNotificationDomainDependencies(),
          client,
          notification,
        ),
    };
  }

  private getConversationPriority(
    lastMessage: string,
    bookingId?: string,
  ): AdminConversationCase['priority'] {
    return marketplaceHelpers.getConversationPriority(lastMessage, bookingId);
  }

  private getConversationCaseStatus(
    action?: string,
  ): AdminConversationCase['caseStatus'] {
    return marketplaceHelpers.getConversationCaseStatus(action);
  }

  async getSession(role: Role): Promise<SessionPayload> {
    const roleRecord = await this.prisma.userRole.findFirst({
      where: { role: this.toRoleName(role) },
      include: {
        user: {
          include: {
            roles: true,
          },
        },
      },
    });

    const user = roleRecord?.user;
    if (!user) {
      throw new Error(`No seeded user found for role ${role}`);
    }

    return this.buildSessionPayload(user);
  }

  async login(input: {
    email?: string;
    password?: string;
  }): Promise<SessionPayload> {
    const normalizedEmail = this.normalizeEmail(input.email);

    if (!normalizedEmail) {
      throw new BadRequestException('Email is required when signing in');
    }

    if (!input.password) {
      throw new BadRequestException('Password is required when signing in');
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { roles: true },
    });

    if (
      !byEmail ||
      !this.verifyPassword(input.password, byEmail.passwordHash)
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (this.needsPasswordRehash(byEmail.passwordHash)) {
      await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          passwordHash: this.hashPassword(input.password),
        },
      });
    }

    return this.buildSessionPayload(byEmail);
  }

  async registerCustomer(input: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<SessionPayload> {
    const fullName = this.sanitizeString(input.fullName);
    const email = this.normalizeEmail(input.email);

    if (!fullName || !email) {
      throw new BadRequestException('Full name and email are required');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('That email is already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: this.hashPassword(input.password),
        fullName,
        phone: this.sanitizeString(input.phone) ?? null,
        avatarUrl: this.sanitizeString(input.avatarUrl) ?? null,
        roles: {
          create: {
            role: RoleName.CUSTOMER,
          },
        },
      },
      include: { roles: true },
    });

    await notificationsDomain.createNotificationFlow(
      this.getNotificationDomainDependencies(),
      this.prisma,
      {
        userId: user.id,
        type: 'system',
        title: 'Welcome to Beauty Finder',
        body: 'Your customer account is ready. Save favorites and book your next appointment.',
      },
    );

    return this.buildSessionPayload(user);
  }

  async registerBusinessOwner(input: {
    ownerName: string;
    ownerEmail: string;
    password: string;
    ownerPhone?: string;
    businessName: string;
    category: 'nail' | 'hair';
    description?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    businessPhone?: string;
    businessEmail?: string;
    salonLicenseNumber: string;
    businessLicenseNumber: string;
    einNumber: string;
  }): Promise<SessionPayload> {
    const ownerName = this.sanitizeString(input.ownerName);
    const ownerEmail = this.normalizeEmail(input.ownerEmail);
    const businessName = this.sanitizeString(input.businessName);
    const addressLine1 = this.sanitizeString(input.addressLine1);
    const city = this.sanitizeString(input.city);
    const state = this.sanitizeString(input.state);
    const postalCode = this.sanitizeString(input.postalCode);
    const salonLicenseNumber = this.sanitizeString(input.salonLicenseNumber);
    const businessLicenseNumber = this.sanitizeString(input.businessLicenseNumber);
    const einNumber = this.sanitizeString(input.einNumber);

    if (
      !ownerName ||
      !ownerEmail ||
      !businessName ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode ||
      !salonLicenseNumber ||
      !businessLicenseNumber ||
      !einNumber
    ) {
      throw new BadRequestException(
        'Owner, business, and compliance fields are required',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('That owner email is already registered');
    }

    const owner = await this.prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: this.hashPassword(input.password),
        fullName: ownerName,
        phone: this.sanitizeString(input.ownerPhone) ?? null,
        roles: {
          create: {
            role: RoleName.OWNER,
          },
        },
        ownedBusinesses: {
          create: {
            name: businessName,
            category: this.toBusinessCategory(input.category),
            description: this.sanitizeString(input.description) ?? null,
            phone: this.sanitizeString(input.businessPhone) ?? null,
            email: this.normalizeEmail(input.businessEmail) ?? ownerEmail,
            addressLine1,
            addressLine2: this.sanitizeString(input.addressLine2) ?? null,
            city,
            state,
            postalCode,
            status: BusinessStatus.PENDING_REVIEW,
            compliance: {
              create: {
                salonLicenseNumber,
                businessLicenseNumber,
                einNumber,
              },
            },
          },
        },
      },
      include: { roles: true },
    });

    await notificationsDomain.createNotificationFlow(
      this.getNotificationDomainDependencies(),
      this.prisma,
      {
        userId: owner.id,
        type: 'system',
        title: 'Business registration submitted',
        body: `${businessName} was created and sent for admin review. You can keep editing services, pricing, and media while it is pending.`,
      },
    );

    return this.buildSessionPayload(owner);
  }

  async registerTechnician(
    input: RegisterPrivateTechnicianInput,
  ): Promise<SessionPayload> {
    const fullName = this.sanitizeString(input.fullName);
    const email = this.normalizeEmail(input.email);
    const category = input.category === 'hair' ? 'hair' : 'nail';
    const identityCardNumber = this.sanitizeString(input.identityCardNumber);
    const ssaNumber = this.sanitizeString(input.ssaNumber);
    const licenseNumber = this.sanitizeString(input.licenseNumber);
    const licenseState = this.sanitizeString(input.licenseState);

    if (
      !fullName ||
      !email ||
      !identityCardNumber ||
      !ssaNumber ||
      !licenseNumber ||
      !licenseState
    ) {
      throw new BadRequestException('Technician profile fields are required');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('That technician email is already registered');
    }

    const technician = await this.prisma.user.create({
      data: {
        email,
        passwordHash: this.hashPassword(input.password),
        fullName,
        phone: this.sanitizeString(input.phone) ?? null,
        roles: {
          create: {
            role: RoleName.TECHNICIAN,
          },
        },
        professionalRegistration: {
          create: {
            accountType: ProfessionalAccountType.PRIVATE_TECHNICIAN,
            verificationStatus: VerificationStatus.PENDING_REVIEW,
            identityCardNumber,
            ssaNumber,
            licenseNumber,
            licenseState,
          },
        },
        privateTechnicianProfile: {
          create: {
            status: PrismaPrivateTechnicianProfileStatus.DRAFT,
            category: this.toBusinessCategory(category),
            displayName: fullName,
            headline: this.sanitizeString(input.headline) ?? null,
            bio: this.sanitizeString(input.bio) ?? null,
            city: this.sanitizeString(input.city) ?? null,
            state: this.sanitizeString(input.state) ?? null,
            postalCode: this.sanitizeString(input.postalCode) ?? null,
            heroImage: this.sanitizeString(input.heroImage) ?? null,
          },
        },
      },
      include: { roles: true },
    });

    await notificationsDomain.createNotificationFlow(
      this.getNotificationDomainDependencies(),
      this.prisma,
      {
        userId: technician.id,
        type: 'system',
        title: 'Private technician account created',
        body: 'Your private technician profile is ready. You can manage your own services, pricing, and advertising separately from salon owner tools.',
      },
    );

    return this.buildSessionPayload(technician);
  }

  async getUserById(userId: string): Promise<UserSummary | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    return user ? this.toUserSummary(user) : undefined;
  }

  async getPrivateTechnicianProfile(
    actor: UserSummary,
  ): Promise<PrivateTechnicianProfileRecord> {
    if (actor.role !== 'technician') {
      throw new ForbiddenException(
        'Only private technician accounts can access this profile',
      );
    }

    const profile = await this.prisma.privateTechnicianProfile.findUnique({
      where: { userId: actor.id },
      include: {
        user: { include: { professionalRegistration: true } },
        services: { orderBy: { createdAt: 'asc' } },
        ads: { orderBy: { updatedAt: 'desc' } },
      },
    });

    if (!profile) {
      throw new NotFoundException('Private technician profile was not found');
    }

    return this.toPrivateTechnicianProfileRecord(profile);
  }

  async updatePrivateTechnicianProfile(
    input: UpdatePrivateTechnicianProfileInput,
    actor: UserSummary,
  ): Promise<PrivateTechnicianProfileRecord> {
    if (actor.role !== 'technician') {
      throw new ForbiddenException(
        'Only private technician accounts can update this profile',
      );
    }

    const existingProfile = await this.prisma.privateTechnicianProfile.findUnique({
      where: { userId: actor.id },
      include: {
        user: { include: { professionalRegistration: true } },
        services: { orderBy: { createdAt: 'asc' } },
        ads: { orderBy: { updatedAt: 'desc' } },
      },
    });

    if (!existingProfile) {
      throw new NotFoundException('Private technician profile was not found');
    }

    const normalizedServices =
      input.services?.map((service) => ({
        id: service.id,
        name: this.sanitizeString(service.name),
        description: this.sanitizeString(service.description),
        durationMinutes: service.durationMinutes,
        price: service.price,
        isActive: service.isActive,
      })) ?? undefined;

    if (
      normalizedServices?.some(
        (service) =>
          !service.name ||
          !Number.isFinite(service.durationMinutes) ||
          service.durationMinutes <= 0 ||
          !Number.isFinite(service.price) ||
          service.price <= 0,
      )
    ) {
      throw new BadRequestException(
        'Each private technician service requires a name, duration, and price greater than 0',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const profileUpdateData: Prisma.PrivateTechnicianProfileUpdateInput = {
        ...(input.displayName !== undefined
          ? {
              displayName:
                this.sanitizeString(input.displayName) ?? existingProfile.displayName,
            }
          : {}),
        ...(input.category !== undefined
          ? { category: this.toBusinessCategory(input.category) }
          : {}),
        ...(input.headline !== undefined
          ? { headline: this.sanitizeString(input.headline) ?? null }
          : {}),
        ...(input.bio !== undefined
          ? { bio: this.sanitizeString(input.bio) ?? null }
          : {}),
        ...(input.city !== undefined
          ? { city: this.sanitizeString(input.city) ?? null }
          : {}),
        ...(input.state !== undefined
          ? { state: this.sanitizeString(input.state) ?? null }
          : {}),
        ...(input.postalCode !== undefined
          ? { postalCode: this.sanitizeString(input.postalCode) ?? null }
          : {}),
        ...(input.heroImage !== undefined
          ? { heroImage: this.sanitizeString(input.heroImage) ?? null }
          : {}),
        ...(input.featuredOnHomepage !== undefined
          ? { featuredOnHomepage: input.featuredOnHomepage }
          : {}),
        ...(input.homepageRank !== undefined
          ? { homepageRank: input.homepageRank }
          : {}),
      };

      if (Object.keys(profileUpdateData).length > 0) {
        await tx.privateTechnicianProfile.update({
          where: { userId: actor.id },
          data: profileUpdateData,
        });
      }

      if (!normalizedServices) {
        return;
      }

      const preservedIds = new Set<string>();

      for (const service of normalizedServices) {
        const serviceData = {
          name: service.name!,
          description: service.description ?? null,
          durationMinutes: service.durationMinutes,
          price: service.price,
          isActive: service.isActive,
        };

        if (service.id) {
          const existingService = await tx.privateTechnicianService.findFirst({
            where: { id: service.id, profileUserId: actor.id },
            select: { id: true },
          });

          if (existingService) {
            await tx.privateTechnicianService.update({
              where: { id: service.id },
              data: serviceData,
            });
            preservedIds.add(service.id);
            continue;
          }
        }

        const createdService = await tx.privateTechnicianService.create({
          data: {
            profileUserId: actor.id,
            ...serviceData,
          },
        });
        preservedIds.add(createdService.id);
      }

      const staleServiceIds = existingProfile.services
        .map((service) => service.id)
        .filter((id) => !preservedIds.has(id));

      if (staleServiceIds.length > 0) {
        await tx.privateTechnicianService.updateMany({
          where: { id: { in: staleServiceIds } },
          data: { isActive: false },
        });
      }
    });

    return this.getPrivateTechnicianProfile(actor);
  }

  async createPrivateTechnicianAd(
    input: CreatePrivateTechnicianAdInput,
    actor: UserSummary,
  ): Promise<PrivateTechnicianAdRecord> {
    if (actor.role !== 'technician') {
      throw new ForbiddenException(
        'Only private technician accounts can create ads',
      );
    }

    const profile = await this.prisma.privateTechnicianProfile.findUnique({
      where: { userId: actor.id },
      select: { userId: true },
    });

    if (!profile) {
      throw new NotFoundException('Private technician profile was not found');
    }

    const campaignName = this.sanitizeString(input.campaignName);
    const headline = this.sanitizeString(input.headline);

    if (!campaignName || !headline || !Number.isFinite(input.budget) || input.budget <= 0) {
      throw new BadRequestException(
        'Ad campaigns require a name, headline, and budget greater than 0',
      );
    }

    const ad = await this.prisma.privateTechnicianAd.create({
      data: {
        profileUserId: actor.id,
        campaignName,
        placement: this.toAdPlacement(input.placement),
        headline,
        description: this.sanitizeString(input.description) ?? null,
        destinationUrl: this.sanitizeString(input.destinationUrl) ?? null,
        budgetAmount: input.budget,
        status:
          this.toPrivateTechnicianAdStatus(input.status) ??
          PrivateTechnicianAdStatus.DRAFT,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      },
    });

    return this.toPrivateTechnicianAdRecord(ad);
  }

  async updatePrivateTechnicianAd(
    adId: string,
    input: UpdatePrivateTechnicianAdInput,
    actor: UserSummary,
  ): Promise<PrivateTechnicianAdRecord> {
    if (actor.role !== 'technician') {
      throw new ForbiddenException(
        'Only private technician accounts can update ads',
      );
    }

    const existingAd = await this.prisma.privateTechnicianAd.findFirst({
      where: { id: adId, profileUserId: actor.id },
    });

    if (!existingAd) {
      throw new NotFoundException('Private technician ad was not found');
    }

    const updated = await this.prisma.privateTechnicianAd.update({
      where: { id: adId },
      data: {
        ...(input.campaignName !== undefined
          ? { campaignName: this.sanitizeString(input.campaignName) ?? existingAd.campaignName }
          : {}),
        ...(input.headline !== undefined
          ? { headline: this.sanitizeString(input.headline) ?? existingAd.headline }
          : {}),
        ...(input.description !== undefined
          ? { description: this.sanitizeString(input.description) ?? null }
          : {}),
        ...(input.destinationUrl !== undefined
          ? { destinationUrl: this.sanitizeString(input.destinationUrl) ?? null }
          : {}),
        ...(input.budget !== undefined ? { budgetAmount: input.budget } : {}),
        ...(input.startsAt !== undefined
          ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
          : {}),
        ...(input.endsAt !== undefined
          ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
          : {}),
        ...(input.status !== undefined
          ? { status: this.toPrivateTechnicianAdStatus(input.status) }
          : {}),
      },
    });

    return this.toPrivateTechnicianAdRecord(updated);
  }

  async verifyAccessToken(token: string): Promise<SessionPayload | undefined> {
    const claims = this.parseAccessToken(token);

    if (!claims) {
      return undefined;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: { roles: true },
    });

    if (
      !user ||
      !user.roles.some(
        (userRole) => this.fromRoleName(userRole.role) === claims.role,
      )
    ) {
      return undefined;
    }

    return this.buildSessionPayload(
      user,
      token,
      new Date(claims.exp * 1000).toISOString(),
    );
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      include: { roles: true },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((user) => this.toUserSummary(user));
  }

  async getCategories(): Promise<CategorySummary[]> {
    return this.rememberCatalogValue(
      'categories',
      { status: BusinessStatus.APPROVED },
      this.categoryCacheTtlSeconds,
      async () => {
        const counts = await this.prisma.business.groupBy({
          by: ['category'],
          where: { status: BusinessStatus.APPROVED },
          _count: { _all: true },
        });
        const countsByCategory = new Map(
          counts.map((entry) => [entry.category, entry._count._all]),
        );

        return (
          Object.entries(this.categoryLabels) as [
            BusinessSummary['category'],
            string,
          ][]
        ).map(([id, label]) => ({
          id,
          label,
          businessCount: countsByCategory.get(this.toBusinessCategory(id)) ?? 0,
        }));
      },
    );
  }

  async getBusinesses(filters: {
    category?: string;
    city?: string;
    search?: string;
  }): Promise<BusinessSummary[]> {
    const normalizedFilters = this.normalizeBusinessFilters(filters);

    return this.rememberCatalogValue(
      'business-search',
      normalizedFilters,
      this.catalogCacheTtlSeconds,
      async () => {
        const businesses = await this.prisma.business.findMany({
          where: this.buildBusinessSearchWhere(normalizedFilters),
          include: this.getPublicBusinessInclude(),
          orderBy: this.getPublicBusinessOrderBy(),
        });

        return this.sortBusinessesForHomepage(
          businesses.map((business) => this.toBusinessSummary(business)),
        );
      },
    );
  }

  async getBusiness(id: string): Promise<BusinessSummary | undefined> {
    return this.rememberCatalogValue(
      'business-detail',
      { id },
      this.businessDetailCacheTtlSeconds,
      async () => {
        const business = await this.prisma.business.findUnique({
          where: { id },
          include: this.getPublicBusinessInclude(),
        });

        return business ? this.toBusinessSummary(business) : undefined;
      },
    );
  }

  async getOwnerBusinesses(
    ownerId: string,
    actor: UserSummary,
  ): Promise<OwnerBusinessProfile[]> {
    if (actor.role !== 'owner' && actor.role !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to manage businesses',
      );
    }

    if (actor.role === 'owner' && actor.id !== ownerId) {
      throw new ForbiddenException(
        'Owners can only manage their own businesses',
      );
    }

    const businesses = await this.prisma.business.findMany({
      where: { ownerUserId: ownerId },
      include: {
        services: { orderBy: { createdAt: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        staff: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return businesses.map((business) => this.toOwnerBusinessProfile(business));
  }

  async getOwnerTechnicians(
    businessId: string,
    actor: UserSummary,
  ): Promise<OwnerTechnicianProfile[]> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        staff: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (
      actor.role !== 'admin' &&
      (actor.role !== 'owner' || business.ownerUserId !== actor.id)
    ) {
      throw new ForbiddenException(
        'You do not have permission to manage technicians for this business',
      );
    }

    return business.staff.map((staff) => ({
      id: staff.id,
      businessId: staff.businessId,
      userId: staff.userId ?? undefined,
      name: staff.name,
      title: staff.title ?? undefined,
      avatarUrl: staff.avatarUrl ?? undefined,
      isActive: staff.isActive,
      businessName: business.name,
      businessCategory: business.category.toLowerCase() as OwnerTechnicianProfile['businessCategory'],
      businessStatus: this.fromBusinessStatus(business.status),
    }));
  }

  async updateOwnerTechnicians(
    businessId: string,
    technicians: OwnerTechnicianInput[],
    actor: UserSummary,
  ): Promise<OwnerTechnicianProfile[]> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        staff: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (
      actor.role !== 'admin' &&
      (actor.role !== 'owner' || business.ownerUserId !== actor.id)
    ) {
      throw new ForbiddenException(
        'You do not have permission to manage technicians for this business',
      );
    }

    const normalizedTechnicians = technicians
      .map((technician) => ({
        id: technician.id,
        userId: this.sanitizeString(technician.userId),
        name: this.sanitizeString(technician.name),
        title: this.sanitizeString(technician.title),
        avatarUrl: this.sanitizeString(technician.avatarUrl),
        isActive: technician.isActive,
      }))
      .filter((technician) => technician.name);

    const linkedUserIds = normalizedTechnicians
      .map((technician) => technician.userId)
      .filter((userId): userId is string => Boolean(userId));

    if (new Set(linkedUserIds).size !== linkedUserIds.length) {
      throw new BadRequestException(
        'A technician account can only be linked once inside the same roster update',
      );
    }

    const technicianUsers = linkedUserIds.length
      ? await this.prisma.user.findMany({
          where: {
            id: { in: linkedUserIds },
            roles: {
              some: {
                role: RoleName.TECHNICIAN,
              },
            },
          },
          select: { id: true },
        })
      : [];

    if (technicianUsers.length !== linkedUserIds.length) {
      throw new BadRequestException(
        'Every linked technician user must exist and have the TECHNICIAN role',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const preservedIds = new Set<string>();

      for (const technician of normalizedTechnicians) {
        const staffData = {
          ...(technician.userId !== undefined ? { userId: technician.userId } : {}),
          name: technician.name!,
          title: technician.title ?? null,
          ...(technician.avatarUrl !== undefined
            ? { avatarUrl: technician.avatarUrl ?? null }
            : {}),
          isActive: technician.isActive,
        };

        if (technician.id) {
          const existingStaff = await tx.staff.findFirst({
            where: { id: technician.id, businessId },
            select: { id: true, userId: true },
          });

          if (existingStaff) {
            if (technician.userId) {
              const conflictingStaff = await tx.staff.findFirst({
                where: {
                  businessId,
                  userId: technician.userId,
                  NOT: { id: technician.id },
                },
                select: { id: true },
              });

              if (conflictingStaff) {
                throw new ConflictException(
                  'That technician account is already linked to another staff profile in this business',
                );
              }
            }

            await tx.staff.update({
              where: { id: technician.id },
              data: staffData,
            });
            preservedIds.add(technician.id);

            continue;
          }
        }

        if (technician.userId) {
          const conflictingStaff = await tx.staff.findFirst({
            where: {
              businessId,
              userId: technician.userId,
            },
            select: { id: true },
          });

          if (conflictingStaff) {
            throw new ConflictException(
              'That technician account is already linked to another staff profile in this business',
            );
          }
        }

        const createdStaff = await tx.staff.create({
          data: {
            businessId,
            ...staffData,
          },
        });
        preservedIds.add(createdStaff.id);
      }

      const staleStaffIds = business.staff
        .map((member) => member.id)
        .filter((id) => !preservedIds.has(id));

      if (staleStaffIds.length > 0) {
        await tx.staff.updateMany({
          where: { id: { in: staleStaffIds } },
          data: { isActive: false },
        });
      }
    });

    return this.getOwnerTechnicians(businessId, actor);
  }

  async uploadOwnerBusinessImage(
    businessId: string,
    input: { filename?: string; contentType?: string; base64: string },
    actor: UserSummary,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, ownerUserId: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (actor.role !== 'owner' || business.ownerUserId !== actor.id) {
      throw new ForbiddenException(
        'You do not have permission to upload media for this business',
      );
    }

    const normalizedBase64 = this.normalizeUploadBase64(input.base64);
    const imageType = this.resolveImageUploadType(
      input.filename,
      input.contentType,
    );
    const buffer = Buffer.from(normalizedBase64, 'base64');
    const maxUploadSizeBytes = 5 * 1024 * 1024;

    if (!buffer.byteLength) {
      throw new BadRequestException('Uploaded file is empty');
    }

    if (buffer.byteLength > maxUploadSizeBytes) {
      throw new BadRequestException('Uploaded file must be 5 MB or smaller');
    }

    return this.ownerMediaStorage.uploadBusinessImage({
      ownerId: actor.id,
      businessId: business.id,
      buffer,
      contentType: imageType.contentType,
      extension: imageType.extension,
    });
  }

  async updateOwnerBusiness(
    businessId: string,
    input: OwnerBusinessUpdateInput,
    actor: UserSummary,
  ): Promise<OwnerBusinessProfile> {
    const existingBusiness = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        services: { orderBy: { createdAt: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        staff: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!existingBusiness) {
      throw new NotFoundException('Business not found');
    }

    if (actor.role !== 'owner' || existingBusiness.ownerUserId !== actor.id) {
      throw new ForbiddenException(
        'You do not have permission to update this business',
      );
    }

    const normalizedGalleryImages =
      input.galleryImages
        ?.map((url) => this.sanitizeString(url))
        .filter((url): url is string => Boolean(url)) ?? undefined;
    const normalizedServices = input.services?.map((service) => ({
      id: service.id,
      name: this.sanitizeString(service.name),
      description: this.sanitizeString(service.description),
      durationMinutes: service.durationMinutes,
      price: service.price,
      isActive: service.isActive,
    }));

    if (
      normalizedServices?.some(
        (service) =>
          !service.name ||
          !service.description ||
          !Number.isFinite(service.price) ||
          service.price <= 0,
      )
    ) {
      throw new BadRequestException(
        'Each service requires a name, description, and price greater than 0',
      );
    }
    const normalizedStaff =
      input.staff
        ?.map((member) => ({
          id: member.id,
          name: this.sanitizeString(member.name),
          title: this.sanitizeString(member.title),
          avatarUrl: this.sanitizeString(member.avatarUrl),
          isActive: member.isActive,
        }))
        .filter((member) => member.name) ?? undefined;
    const normalizedPromotion =
      input.promotion === undefined
        ? undefined
        : input.promotion === null
          ? null
          : {
              title: this.sanitizeString(input.promotion.title),
              description: this.sanitizeString(input.promotion.description),
              discountPercent: input.promotion.discountPercent,
              code: this.sanitizeString(input.promotion.code),
              expiresAt: input.promotion.expiresAt,
            };
    const nextHeroImage =
      input.heroImage !== undefined
        ? this.sanitizeString(input.heroImage)
        : normalizedGalleryImages !== undefined
          ? normalizedGalleryImages[0]
          : undefined;

    await this.prisma.$transaction(async (tx) => {
      const businessUpdateData: Prisma.BusinessUpdateInput = {
        ...(input.name !== undefined
          ? { name: this.sanitizeString(input.name) ?? existingBusiness.name }
          : {}),
        ...(input.description !== undefined
          ? { description: this.sanitizeString(input.description) ?? null }
          : {}),
        ...(nextHeroImage !== undefined ? { heroImage: nextHeroImage } : {}),
        ...(input.businessLogo !== undefined
          ? { businessLogo: this.sanitizeString(input.businessLogo) ?? null }
          : {}),
        ...(input.businessBanner !== undefined
          ? { businessBanner: this.sanitizeString(input.businessBanner) ?? null }
          : {}),
        ...(input.ownerAvatar !== undefined
          ? { ownerAvatarUrl: this.sanitizeString(input.ownerAvatar) ?? null }
          : {}),
        ...(input.videoUrl !== undefined
          ? { videoUrl: this.sanitizeString(input.videoUrl) ?? null }
          : {}),
      };

      if (normalizedPromotion !== undefined) {
        Object.assign(businessUpdateData, {
          promotionTitle: normalizedPromotion?.title ?? null,
          promotionDescription: normalizedPromotion?.description ?? null,
          promotionDiscountPercent:
            normalizedPromotion?.discountPercent ?? null,
          promotionCode: normalizedPromotion?.code ?? null,
          promotionExpiresAt: normalizedPromotion?.expiresAt
            ? new Date(normalizedPromotion.expiresAt)
            : null,
        });
      }

      await tx.business.update({
        where: { id: businessId },
        data: businessUpdateData,
      });

      if (normalizedGalleryImages !== undefined) {
        await tx.businessImage.deleteMany({
          where: { businessId },
        });

        if (normalizedGalleryImages.length > 0) {
          await tx.businessImage.createMany({
            data: normalizedGalleryImages.map((url, index) => ({
              businessId,
              url,
              sortOrder: index,
            })),
          });
        }
      }

      if (normalizedServices) {
        for (const service of normalizedServices) {
          const serviceData = {
            name: service.name!,
            description: service.description ?? null,
            durationMinutes: service.durationMinutes,
            price: service.price,
            isActive: service.isActive,
          };

          if (service.id) {
            const existingService = await tx.service.findFirst({
              where: { id: service.id, businessId },
              select: { id: true },
            });

            if (existingService) {
              await tx.service.update({
                where: { id: service.id },
                data: serviceData,
              });
              continue;
            }
          }

          await tx.service.create({
            data: {
              businessId,
              ...serviceData,
            },
          });
        }
      }

      if (normalizedStaff) {
        for (const staff of normalizedStaff) {
          const staffData = {
            name: staff.name!,
            title: staff.title ?? null,
            ...(staff.avatarUrl !== undefined
              ? { avatarUrl: staff.avatarUrl ?? null }
              : {}),
            isActive: staff.isActive,
          };

          if (staff.id) {
            const existingStaff = await tx.staff.findFirst({
              where: { id: staff.id, businessId },
              select: { id: true },
            });

            if (existingStaff) {
              await tx.staff.update({
                where: { id: staff.id },
                data: staffData,
              });
              continue;
            }
          }

          await tx.staff.create({
            data: {
              businessId,
              ...staffData,
            },
          });
        }
      }

      await notificationsDomain.createNotificationFlow(
        this.getNotificationDomainDependencies(),
        tx,
        {
          userId: existingBusiness.ownerUserId,
          type: 'system',
          title: 'Owner dashboard updated',
          body: `${existingBusiness.name} profile, pricing, team, or promotion details were updated.`,
        },
      );
    });

    const updatedBusiness = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        services: { orderBy: { createdAt: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        staff: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!updatedBusiness) {
      throw new NotFoundException('Business not found after update');
    }

    await this.invalidatePublicBusinessCaches();

    return this.toOwnerBusinessProfile(updatedBusiness);
  }

  async getHomepageBusinesses(): Promise<BusinessSummary[]> {
    return this.rememberCatalogValue(
      'homepage-businesses',
      { status: BusinessStatus.APPROVED },
      this.catalogCacheTtlSeconds,
      async () => {
        const businesses = await this.prisma.business.findMany({
          where: { status: BusinessStatus.APPROVED },
          include: this.getPublicBusinessInclude(),
          orderBy: this.getPublicBusinessOrderBy(),
        });

        return this.sortBusinessesForHomepage(
          businesses.map((business) => this.toBusinessSummary(business)),
        );
      },
    );
  }

  async getAdminBusinesses(
    status?: BusinessModerationStatus,
  ): Promise<AdminBusinessQueueItem[]> {
    return adminDomain.getAdminBusinessesFlow(
      this.getAdminDomainDependencies(),
      status,
    );
  }

  async updateHomepagePlacement(
    businessId: string,
    input: { featuredOnHomepage: boolean; homepageRank: number },
  ): Promise<BusinessSummary> {
    return adminDomain.updateHomepagePlacementFlow(
      this.getAdminDomainDependencies(),
      businessId,
      input,
    );
  }

  async updateBusinessStatus(
    businessId: string,
    input: { status: BusinessModerationStatus; note?: string },
    adminUserId: string,
  ): Promise<AdminBusinessQueueItem> {
    return adminDomain.updateBusinessStatusFlow(
      this.getAdminDomainDependencies(),
      businessId,
      input,
      adminUserId,
    );
  }

  async getServices(businessId?: string) {
    return this.rememberCatalogValue(
      'services',
      { businessId: businessId ?? null },
      this.catalogCacheTtlSeconds,
      async () => {
        const services = await this.prisma.service.findMany({
          where: {
            isActive: true,
            ...(businessId ? { businessId } : {}),
          },
          include: {
            business: true,
          },
          orderBy: [{ businessId: 'asc' }, { createdAt: 'asc' }],
        });

        return services.map((service) => ({
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price: this.toNumber(service.price),
          businessId: service.businessId,
          businessName: service.business.name,
        }));
      },
    );
  }

  async getAvailability(
    businessId?: string,
    serviceId?: string,
  ): Promise<AvailabilitySlotSummary[]> {
    return this.rememberAvailabilityValue(
      'availability',
      {
        businessId: businessId ?? null,
        serviceId: serviceId ?? null,
      },
      this.availabilityCacheTtlSeconds,
      async () => {
        const slots = await this.prisma.availabilitySlot.findMany({
          where: {
            ...(businessId ? { businessId } : {}),
            ...(serviceId ? { serviceId } : {}),
          },
          include: {
            staff: true,
          },
          orderBy: { startTime: 'asc' },
        });

        return slots.map((slot) => ({
          id: slot.id,
          businessId: slot.businessId,
          serviceId: slot.serviceId ?? '',
          staffName: slot.staff?.name ?? 'Team Member',
          startAt: slot.startTime.toISOString(),
          endAt: slot.endTime.toISOString(),
          isBooked: slot.isBooked,
        }));
      },
    );
  }

  async getBookings(
    actor: UserSummary,
    requestedUserId?: string,
    requestedRole?: Role,
  ): Promise<BookingRecord[]> {
    return bookingsDomain.getBookingsFlow(
      this.getBookingsDomainDependencies(),
      actor,
      requestedUserId,
      requestedRole,
    );
  }

  async getPayments(
    actor: UserSummary,
    requestedUserId?: string,
    requestedRole?: Role,
  ): Promise<PaymentRecord[]> {
    return paymentsDomain.getPaymentsFlow(
      {
        prisma: this.prisma,
        resolveScopedUserId: (activeActor, userId) =>
          this.resolveScopedUserId(activeActor, userId),
        resolveScopedBookingRole: (activeActor, role) =>
          this.resolveScopedBookingRole(activeActor, role),
        toPaymentRecord: (payment) => this.toPaymentRecord(payment),
        toNumber: (value) => this.toNumber(value as Prisma.Decimal | number | null | undefined),
        roundCurrency: (amount) => this.roundCurrency(amount),
        getPaymentTaxRate: () => this.getPaymentTaxRate(),
        isPromotionActive: (business) => this.isPromotionActive(business),
        createReceiptNumber: () => this.createReceiptNumber(),
        toPaymentMethod: (method) => this.toPaymentMethod(method),
        sanitizeString: (value) => this.sanitizeString(value),
        createNotification: (client, input) =>
          notificationsDomain.createNotificationFlow(
            this.getNotificationDomainDependencies(),
            client,
            input,
          ),
        paymentCurrency: this.paymentCurrency,
      },
      actor,
      requestedUserId,
      requestedRole,
    );
  }

  async checkoutPayment(
    input: CheckoutPaymentInput,
    actor: UserSummary,
  ): Promise<PaymentRecord> {
    return paymentsDomain.checkoutPaymentFlow(
      {
        prisma: this.prisma,
        resolveScopedUserId: (activeActor, userId) =>
          this.resolveScopedUserId(activeActor, userId),
        resolveScopedBookingRole: (activeActor, role) =>
          this.resolveScopedBookingRole(activeActor, role),
        toPaymentRecord: (payment) => this.toPaymentRecord(payment),
        toNumber: (value) => this.toNumber(value as Prisma.Decimal | number | null | undefined),
        roundCurrency: (amount) => this.roundCurrency(amount),
        getPaymentTaxRate: () => this.getPaymentTaxRate(),
        isPromotionActive: (business) => this.isPromotionActive(business),
        createReceiptNumber: () => this.createReceiptNumber(),
        toPaymentMethod: (method) => this.toPaymentMethod(method),
        sanitizeString: (value) => this.sanitizeString(value),
        createNotification: (client, notification) =>
          notificationsDomain.createNotificationFlow(
            this.getNotificationDomainDependencies(),
            client,
            notification,
          ),
        paymentCurrency: this.paymentCurrency,
      },
      input,
      actor,
    );
  }

  async createBooking(
    input: Omit<BookingRecord, 'id' | 'status'> & {
      status?: BookingRecord['status'];
    },
    actor: UserSummary,
  ): Promise<BookingRecord> {
    return bookingsDomain.createBookingFlow(
      this.getBookingsDomainDependencies(),
      input,
      actor,
    );
  }

  async getConversations(
    actor: UserSummary,
    requestedUserId?: string,
  ): Promise<ConversationRecord[]> {
    return messagingDomain.getConversationsFlow(
      this.getMessagingDomainDependencies(),
      actor,
      requestedUserId,
    );
  }

  async getMessages(
    conversationId: string,
    actor: UserSummary,
  ): Promise<MessageRecord[]> {
    return messagingDomain.getMessagesFlow(
      this.getMessagingDomainDependencies(),
      conversationId,
      actor,
    );
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    body: string,
    actor: UserSummary,
  ): Promise<MessageRecord> {
    return messagingDomain.createMessageFlow(
      this.getMessagingDomainDependencies(),
      conversationId,
      senderId,
      body,
      actor,
    );
  }

  async getNotifications(
    actor: UserSummary,
    requestedUserId?: string,
  ): Promise<NotificationRecord[]> {
    return notificationsDomain.getNotificationsFlow(
      this.getNotificationDomainDependencies(),
      actor,
      requestedUserId,
    );
  }

  async getNotificationPreferences(
    actor: UserSummary,
    requestedUserId?: string,
  ): Promise<NotificationPreferenceRecord> {
    return notificationsDomain.getNotificationPreferencesFlow(
      this.getNotificationDomainDependencies(),
      actor,
      requestedUserId,
    );
  }

  async updateNotificationPreferences(
    actor: UserSummary,
    input: NotificationPreferenceInput,
    requestedUserId?: string,
  ): Promise<NotificationPreferenceRecord> {
    return notificationsDomain.updateNotificationPreferencesFlow(
      this.getNotificationDomainDependencies(),
      actor,
      input,
      requestedUserId,
    );
  }

  async markNotificationsRead(
    actor: UserSummary,
    input: {
      notificationIds?: string[];
      markAll?: boolean;
    },
    requestedUserId?: string,
  ): Promise<NotificationRecord[]> {
    return notificationsDomain.markNotificationsReadFlow(
      this.getNotificationDomainDependencies(),
      actor,
      input,
      requestedUserId,
    );
  }

  async getFavorites(actor: UserSummary, requestedUserId?: string) {
    const userId = this.resolveScopedUserId(actor, requestedUserId);

    const favorites = await this.prisma.favorite.findMany({
      where: { customerId: userId },
      include: {
        business: {
          include: {
            services: { where: { isActive: true } },
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
            staff: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((favorite) => ({
      userId: favorite.customerId,
      businessId: favorite.businessId,
      createdAt: favorite.createdAt.toISOString(),
      business: this.toBusinessSummary(favorite.business),
    }));
  }

  async addFavorite(
    actor: UserSummary,
    businessId: string,
    requestedUserId?: string,
  ) {
    const userId = this.resolveScopedUserId(actor, requestedUserId);

    await this.prisma.favorite.upsert({
      where: {
        customerId_businessId: {
          customerId: userId,
          businessId,
        },
      },
      update: {},
      create: {
        customerId: userId,
        businessId,
      },
    });

    return this.getFavorites(actor, userId);
  }

  async removeFavorite(
    actor: UserSummary,
    businessId: string,
    requestedUserId?: string,
  ) {
    const userId = this.resolveScopedUserId(actor, requestedUserId);

    await this.prisma.favorite.deleteMany({
      where: {
        customerId: userId,
        businessId,
      },
    });

    return this.getFavorites(actor, userId);
  }

  async getReviews(businessId: string): Promise<ReviewRecord[]> {
    const reviews = await this.prisma.review.findMany({
      where: {
        businessId,
        status: ReviewStatus.PUBLISHED,
      },
      include: {
        customer: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) => this.toReviewRecord(review));
  }

  async createReview(
    input: CreateReviewInput,
    actor: UserSummary,
  ): Promise<ReviewRecord> {
    if (actor.role !== 'customer') {
      throw new ForbiddenException('Only customers can publish reviews');
    }

    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('Rating must be an integer between 1 and 5');
    }

    const comment = this.sanitizeString(input.comment);
    const imageUrls = (input.imageUrls ?? [])
      .map((url) => this.sanitizeString(url))
      .filter((url): url is string => Boolean(url));

    if (!comment && imageUrls.length === 0) {
      throw new BadRequestException('A review needs a comment or at least one image URL');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: input.businessId },
      select: { id: true, ownerUserId: true, name: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (input.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        select: {
          id: true,
          customerId: true,
          businessId: true,
        },
      });

      if (!appointment || appointment.businessId !== input.businessId) {
        throw new BadRequestException('Appointment does not belong to this business');
      }

      if (appointment.customerId !== actor.id) {
        throw new ForbiddenException('You can only review your own appointments');
      }

      const existingReview = await this.prisma.review.findUnique({
        where: { appointmentId: input.appointmentId },
        select: { id: true },
      });

      if (existingReview) {
        throw new ConflictException('This appointment already has a review');
      }
    }

    const createdReview = await this.prisma.review.create({
      data: {
        appointmentId: input.appointmentId ?? null,
        businessId: input.businessId,
        customerId: actor.id,
        rating: input.rating,
        comment: comment ?? null,
        customerAvatarUrl: this.sanitizeString(input.customerAvatarUrl) ?? null,
        images: imageUrls.length
          ? {
              create: imageUrls.map((url, index) => ({
                url,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        customer: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const aggregate = await this.prisma.review.aggregate({
      where: {
        businessId: input.businessId,
        status: ReviewStatus.PUBLISHED,
      },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await this.prisma.business.update({
      where: { id: input.businessId },
      data: {
        rating: aggregate._avg.rating ?? 0,
        reviewCount: aggregate._count._all,
      },
    });

    await notificationsDomain.createNotificationFlow(
      this.getNotificationDomainDependencies(),
      this.prisma,
      {
        userId: business.ownerUserId,
        type: 'review_received',
        title: 'New review received',
        body: `${createdReview.customer.fullName} left a ${createdReview.rating}-star review for ${business.name}.`,
      },
    );

    await this.invalidateCatalogCache();

    return this.toReviewRecord(createdReview);
  }

  async recordBusinessPageView(
    businessId: string,
    input: RecordBusinessPageViewInput,
    actor: UserSummary,
  ) {
    if (actor.role !== 'customer') {
      throw new ForbiddenException('Only customers can record business page views');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    await this.prisma.businessPageView.create({
      data: {
        businessId,
        customerId: actor.id,
        selectedServiceId: this.sanitizeString(input.selectedServiceId) ?? null,
        selectedServiceName: this.sanitizeString(input.selectedServiceName) ?? null,
        note: this.sanitizeString(input.note) ?? null,
        dwellSeconds: input.dwellSeconds,
        colorSignals: this.serializeColorSignals(input.colorSignals),
        source: this.sanitizeString(input.source) ?? 'mobile_salon_detail',
      },
    });

    return {
      recorded: true,
    };
  }

  async getOwnerAudienceReport(
    ownerId: string,
    actor: UserSummary,
  ): Promise<OwnerAudienceReportRecord> {
    if (actor.role !== 'admin' && (actor.role !== 'owner' || actor.id !== ownerId)) {
      throw new ForbiddenException('You do not have permission to view this owner report');
    }

    const businesses = await this.prisma.business.findMany({
      where: { ownerUserId: ownerId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
    const businessIds = businesses.map((business) => business.id);
    const relevantViews =
      businessIds.length > 0
        ? await this.prisma.businessPageView.findMany({
            where: {
              businessId: {
                in: businessIds,
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];
    const uniqueViewers = new Set(relevantViews.map((entry) => entry.customerId));

    return {
      generatedAt: new Date().toISOString(),
      totalUniqueViewers: uniqueViewers.size,
      totalPageViews: relevantViews.length,
      businessesWithViews: businesses.filter((business) =>
        relevantViews.some((entry) => entry.businessId === business.id),
      ).length,
      businesses: businesses.map((business) => {
        const views = relevantViews.filter((entry) => entry.businessId === business.id);
        const viewers = new Set(views.map((entry) => entry.customerId));
        const lastViewedAt = views
          .map((entry) => entry.createdAt.toISOString())
          .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
        const averageDwellSeconds =
          views.length > 0
            ? Math.round(
                views.reduce((sum, entry) => sum + entry.dwellSeconds, 0) /
                  views.length,
              )
            : 0;

        return {
          businessId: business.id,
          businessName: business.name,
          uniqueViewers: viewers.size,
          totalPageViews: views.length,
          averageDwellSeconds,
          lastViewedAt,
        };
      }),
    };
  }

  async getCustomerPreferenceReport(): Promise<CustomerPreferenceReportRecord> {
    const customers = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: RoleName.CUSTOMER,
          },
        },
      },
      include: {
        businessPageViews: {
          orderBy: { createdAt: 'desc' },
        },
        favorites: {
          include: {
            business: true,
          },
        },
        customerAppointments: {
          include: {
            business: true,
            service: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const globalColorCounts = new Map<string, number>();
    const globalServiceCounts = new Map<string, number>();
    const globalExperienceCounts = new Map<string, number>();

    const customerReports = customers.map((customer) => {
      const pageViews = customer.businessPageViews;
      const favoriteColors = new Map<string, number>();
      const topServices = new Map<string, number>();
      const topCategories = new Map<string, number>();
      const experienceCounts = new Map<string, number>();

      for (const pageView of pageViews) {
        for (const color of this.parseColorSignals(pageView.colorSignals)) {
          this.addScore(favoriteColors, color);
          this.addScore(globalColorCounts, color);
        }

        this.addScore(topServices, pageView.selectedServiceName);
        this.addScore(globalServiceCounts, pageView.selectedServiceName);

        if (pageView.source === 'mobile_salon_detail') {
          this.addScore(experienceCounts, 'Mobile salon detail');
          this.addScore(globalExperienceCounts, 'Mobile salon detail');
        }
      }

      for (const favorite of customer.favorites) {
        this.addScore(
          topCategories,
          this.categoryLabels[
            favorite.business.category.toLowerCase() as BusinessSummary['category']
          ],
        );
      }

      for (const appointment of customer.customerAppointments) {
        this.addScore(topServices, appointment.service.name, 2);
        this.addScore(globalServiceCounts, appointment.service.name, 2);
        this.addScore(
          topCategories,
          this.categoryLabels[
            appointment.business.category.toLowerCase() as BusinessSummary['category']
          ],
        );
      }

      const averageBusinessPageDwellSeconds =
        pageViews.length > 0
          ? Math.round(
              pageViews.reduce((sum, entry) => sum + entry.dwellSeconds, 0) /
                pageViews.length,
            )
          : 0;
      const preferredExperience =
        averageBusinessPageDwellSeconds >= 90
          ? 'High-intent beauty planning'
          : customer.customerAppointments.length > 0
            ? 'Book-now convenience'
            : pageViews.length > 0
              ? 'Discovery-first browsing'
              : 'Light platform exploration';
      this.addScore(globalExperienceCounts, preferredExperience);

      return {
        customerId: customer.id,
        customerName: customer.fullName,
        customerEmail: customer.email,
        favoriteColors: this.getTopScores(favoriteColors),
        topServices: this.getTopScores(topServices),
        topCategories: this.getTopScores(topCategories),
        preferredExperience,
        averageBusinessPageDwellSeconds,
        totalBusinessPageViews: pageViews.length,
        totalFavoriteBusinesses: customer.favorites.length,
        totalBookings: customer.customerAppointments.length,
        engagementScore:
          pageViews.length * 2 +
          customer.favorites.length * 3 +
          customer.customerAppointments.length * 5,
        lastSeenAt: pageViews
          .map((entry) => entry.createdAt.toISOString())
          .sort((left, right) => Date.parse(right) - Date.parse(left))[0],
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      totalCustomers: customerReports.length,
      totalTrackedPageViews: customerReports.reduce(
        (sum, customer) => sum + customer.totalBusinessPageViews,
        0,
      ),
      colorTrends: this.getTopScores(globalColorCounts),
      serviceTrends: this.getTopScores(globalServiceCounts),
      experienceTrends: this.getTopScores(globalExperienceCounts),
      customers: customerReports,
    };
  }

  async getAdPricing(): Promise<AdPricingRecord[]> {
    await this.ensureAdPricingCatalog();

    const pricing = await this.prisma.adPricing.findMany();

    return pricing
      .map((entry) => this.toAdPricingRecord(entry))
      .sort(
        (left, right) =>
          this.adPlacementOrder[left.placement] -
          this.adPlacementOrder[right.placement],
      );
  }

  async updateAdPricing(
    placement: AdPlacement,
    input: UpdateAdPricingInput,
    adminUserId: string,
  ): Promise<AdPricingRecord> {
    await this.ensureAdPricingCatalog();

    const existing = await this.prisma.adPricing.findUnique({
      where: {
        placement: this.toAdPlacement(placement),
      },
    });

    if (!existing) {
      throw new NotFoundException('Ad placement was not found');
    }

    const updated = await this.prisma.adPricing.update({
      where: {
        placement: this.toAdPlacement(placement),
      },
      data: {
        dailyPrice: input.dailyPrice,
        monthlyPrice: input.monthlyPrice,
        note: this.sanitizeString(input.note) ?? null,
        updatedByUserId: adminUserId,
      },
    });

    await this.prisma.adminAction.create({
      data: {
        adminUserId,
        targetType: 'ad_pricing',
        targetId: placement,
        action: 'update_ad_pricing',
        metadata: JSON.stringify({
          dailyPrice: this.toNumber(updated.dailyPrice),
          monthlyPrice: this.toNumber(updated.monthlyPrice),
          note: updated.note ?? undefined,
        }),
      },
    });

    return this.toAdPricingRecord(updated);
  }

  async getAdminAccounts(
    search?: string,
    role?: Role,
  ): Promise<AdminAccountSummary[]> {
    const normalizedSearch = this.sanitizeString(search)?.toLowerCase();
    const users = await this.prisma.user.findMany({
      include: {
        roles: true,
        _count: {
          select: { ownedBusinesses: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return users
      .map((user) => this.toAdminAccountSummary(user))
      .filter((user) => (role ? user.roles.includes(role) : true))
      .filter((user) => {
        if (!normalizedSearch) {
          return true;
        }

        return [user.id, user.name, user.email, user.phone]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));
      });
  }

  async getAdminAccount(accountId: string): Promise<AdminAccountSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: accountId },
      include: {
        roles: true,
        _count: {
          select: { ownedBusinesses: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    return this.toAdminAccountSummary(user);
  }

  async updateAdminAccount(
    accountId: string,
    input: AdminAccountUpdateInput,
    adminUserId: string,
  ): Promise<AdminAccountSummary> {
    const nextEmail = this.normalizeEmail(input.email);
    const nextName = this.sanitizeString(input.name);

    if (nextEmail) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          email: nextEmail,
          NOT: { id: accountId },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('That email is already in use by another account');
      }
    }

    await this.prisma.user.update({
      where: { id: accountId },
      data: {
        ...(nextName ? { fullName: nextName } : {}),
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(input.phone !== undefined
          ? { phone: this.sanitizeString(input.phone) ?? null }
          : {}),
        ...(input.status ? { status: this.toUserStatus(input.status) } : {}),
      },
    });

    await this.prisma.adminAction.create({
      data: {
        adminUserId,
        targetType: 'account',
        targetId: accountId,
        action: 'update_account',
        metadata: JSON.stringify({
          name: nextName,
          email: nextEmail,
          phone: input.phone,
          status: input.status,
        }),
      },
    });

    return this.getAdminAccount(accountId);
  }

  async createAdminAccessSession(
    accountId: string,
    adminUserId: string,
    note?: string,
  ): Promise<SessionPayload> {
    const [adminUser, targetUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: adminUserId },
        include: { roles: true },
      }),
      this.prisma.user.findUnique({
        where: { id: accountId },
        include: { roles: true },
      }),
    ]);

    if (!adminUser || !adminUser.roles.some((entry) => entry.role === RoleName.ADMIN)) {
      throw new ForbiddenException('Only admins can start account access sessions');
    }

    if (!targetUser) {
      throw new NotFoundException('Target account not found');
    }

    await this.prisma.adminAction.create({
      data: {
        adminUserId,
        targetType: 'account',
        targetId: accountId,
        action: 'start_account_access_session',
        metadata: JSON.stringify({ note: this.sanitizeString(note) }),
      },
    });

    const session = this.buildSessionPayload(targetUser);

    return {
      ...session,
      adminAccess: {
        adminUserId,
        adminName: adminUser.fullName,
        startedAt: new Date().toISOString(),
        note: this.sanitizeString(note),
      },
    };
  }

  async getAdminReviews(status?: ReviewModerationStatus) {
    return adminDomain.getAdminReviewsFlow(
      this.getAdminDomainDependencies(),
      status,
    );
  }

  async updateReviewStatus(
    reviewId: string,
    input: { status: ReviewModerationStatus; note?: string },
    adminUserId: string,
  ) {
    return adminDomain.updateReviewStatusFlow(
      this.getAdminDomainDependencies(),
      reviewId,
      input,
      adminUserId,
    );
  }

  async getAdminConversationCases(): Promise<AdminConversationCase[]> {
    return adminDomain.getAdminConversationCasesFlow(
      this.getAdminDomainDependencies(),
    );
  }

  async updateConversationCaseStatus(
    conversationId: string,
    input: { status: AdminConversationCase['caseStatus']; note?: string },
    adminUserId: string,
  ) {
    return adminDomain.updateConversationCaseStatusFlow(
      this.getAdminDomainDependencies(),
      conversationId,
      input,
      adminUserId,
    );
  }

  async getAdminAuditActions() {
    return adminDomain.getAdminAuditActionsFlow(
      this.getAdminDomainDependencies(),
    );
  }

  async getAdminOverview(): Promise<AdminOverview> {
    return adminDomain.getAdminOverviewFlow(this.getAdminDomainDependencies());
  }
}

export { MarketplaceService as MockMarketplaceService };
