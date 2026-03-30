import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AdminActionRecord,
  AdminBusinessQueueItem,
  AdminConversationCase,
  AdminOverview,
  AvailabilitySlotSummary,
  BookingRecord,
  BusinessModerationStatus,
  CheckoutPaymentInput,
  OwnerBusinessProfile,
  OwnerBusinessUpdateInput,
  OwnerServiceSummary,
  BusinessSummary,
  CategorySummary,
  ConversationRecord,
  MessageRecord,
  NotificationPreferenceInput,
  NotificationPreferenceRecord,
  NotificationRecord,
  PaymentRecord,
  Role,
  ReviewModerationStatus,
  SessionPayload,
  StaffSummary,
  UserSummary,
} from '@beauty-finder/types';
import {
  BusinessCategory,
  BusinessStatus,
  Prisma,
  RoleName,
  ReviewStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
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
  ReviewWithRelations,
  UserWithRoles,
} from './marketplace/marketplace.types';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService = new RedisService(),
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

  private toOwnerBusinessProfile(
    business: BusinessWithRelations,
  ): OwnerBusinessProfile {
    return marketplaceHelpers.toOwnerBusinessProfile(business);
  }

  private sanitizeString(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private getOwnerMediaUploadsDirectory() {
    const configuredDirectory = this.sanitizeString(
      process.env.OWNER_MEDIA_UPLOAD_DIR,
    );

    if (configuredDirectory) {
      return configuredDirectory;
    }

    return join(__dirname, '../../uploads');
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
  }): Promise<SessionPayload> {
    const ownerName = this.sanitizeString(input.ownerName);
    const ownerEmail = this.normalizeEmail(input.ownerEmail);
    const businessName = this.sanitizeString(input.businessName);
    const addressLine1 = this.sanitizeString(input.addressLine1);
    const city = this.sanitizeString(input.city);
    const state = this.sanitizeString(input.state);
    const postalCode = this.sanitizeString(input.postalCode);

    if (
      !ownerName ||
      !ownerEmail ||
      !businessName ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode
    ) {
      throw new BadRequestException(
        'Owner and business profile fields are required',
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

  async getUserById(userId: string): Promise<UserSummary | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    return user ? this.toUserSummary(user) : undefined;
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

    const uploadsDirectory = this.getOwnerMediaUploadsDirectory();
    const relativeDirectory = join('owners', actor.id, business.id);
    const targetDirectory = join(uploadsDirectory, relativeDirectory);
    const storedFilename = `${Date.now()}-${randomUUID()}.${imageType.extension}`;

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(join(targetDirectory, storedFilename), buffer);

    return {
      contentType: imageType.contentType,
      path: `/uploads/${relativeDirectory.replaceAll('\\', '/')}/${storedFilename}`,
      size: buffer.byteLength,
    };
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
