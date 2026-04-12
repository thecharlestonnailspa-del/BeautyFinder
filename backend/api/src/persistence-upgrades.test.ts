import assert from 'node:assert/strict';
import { BusinessStatus, RoleName } from '@prisma/client';
import { describe, it } from 'vitest';
import type { PrismaService } from './common/prisma.service';
import type { RedisService } from './common/redis.service';
import { MarketplaceService } from './common/marketplace.service';

process.env.JWT_SECRET = 'beauty-finder-test-jwt-secret';

describe('Persistence upgrades', () => {
  it('stores compliance data when registering a business owner', async () => {
    const creates: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          creates.push({ data });
          return {
            id: 'user-owner-9',
            email: 'owner@example.com',
            passwordHash: 'hash',
            fullName: 'Owner Example',
            phone: null,
            createdAt: new Date('2026-04-01T12:00:00.000Z'),
            updatedAt: new Date('2026-04-01T12:00:00.000Z'),
            roles: [{ role: RoleName.OWNER }],
          };
        },
      },
      notificationPreference: {
        findUnique: async () => null,
      },
      notification: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'notif-1',
          ...data,
          body: data.body ?? null,
          payload: null,
          createdAt: new Date('2026-04-01T12:00:00.000Z'),
          readAt: null,
        }),
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    await service.registerBusinessOwner({
      ownerName: 'Owner Example',
      ownerEmail: 'owner@example.com',
      password: 'Beauty123',
      businessName: 'Gloss House',
      category: 'nail',
      addressLine1: '1 Main Street',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      salonLicenseNumber: 'SALON-NY-1111',
      businessLicenseNumber: 'BIZ-NY-2222',
      einNumber: '13-1234567',
    });

    assert.deepEqual(
      creates[0]?.data.ownedBusinesses,
      {
        create: {
          name: 'Gloss House',
          category: 'NAIL',
          description: null,
          phone: null,
          email: 'owner@example.com',
          addressLine1: '1 Main Street',
          addressLine2: null,
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          status: BusinessStatus.PENDING_REVIEW,
          compliance: {
            create: {
              salonLicenseNumber: 'SALON-NY-1111',
              businessLicenseNumber: 'BIZ-NY-2222',
              einNumber: '13-1234567',
            },
          },
        },
      },
    );
  });

  it('stores private technician registration data and returns private account access', async () => {
    const creates: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          creates.push({ data });
          return {
            id: 'user-technician-9',
            email: 'tech@example.com',
            passwordHash: 'hash',
            fullName: 'Tech Example',
            phone: null,
            createdAt: new Date('2026-04-01T12:00:00.000Z'),
            updatedAt: new Date('2026-04-01T12:00:00.000Z'),
            roles: [{ role: RoleName.TECHNICIAN }],
          };
        },
      },
      notificationPreference: {
        findUnique: async () => null,
      },
      notification: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'notif-1',
          ...data,
          body: data.body ?? null,
          payload: null,
          createdAt: new Date('2026-04-01T12:00:00.000Z'),
          readAt: null,
        }),
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const session = await service.registerTechnician({
      fullName: 'Tech Example',
      email: 'tech@example.com',
      password: 'Beauty123',
      category: 'hair',
      headline: 'Independent styling specialist',
      identityCardNumber: 'ID-9988',
      ssaNumber: '***-**-9988',
      licenseNumber: 'TECH-9988',
      licenseState: 'NY',
    });

    assert.deepEqual(creates[0]?.data.professionalRegistration, {
      create: {
        accountType: 'PRIVATE_TECHNICIAN',
        verificationStatus: 'PENDING_REVIEW',
        identityCardNumber: 'ID-9988',
        ssaNumber: '***-**-9988',
        licenseNumber: 'TECH-9988',
        licenseState: 'NY',
      },
    });
    assert.deepEqual(creates[0]?.data.privateTechnicianProfile, {
      create: {
        status: 'DRAFT',
        category: 'HAIR',
        displayName: 'Tech Example',
        headline: 'Independent styling specialist',
        bio: null,
        city: null,
        state: null,
        postalCode: null,
        heroImage: null,
      },
    });
    assert.equal(session.user.accountType, 'private_technician');
    assert.deepEqual(session.permissions, [
      'manage:profile',
      'manage:services',
      'manage:ads',
    ]);
  });

  it('stores and returns customer avatar URLs in session payloads', async () => {
    const creates: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          creates.push({ data });
          return {
            id: 'user-customer-9',
            email: 'customer@example.com',
            passwordHash: 'hash',
            fullName: 'Customer Example',
            phone: null,
            avatarUrl: 'https://images.example.com/users/customer-example.jpg',
            createdAt: new Date('2026-04-01T12:00:00.000Z'),
            updatedAt: new Date('2026-04-01T12:00:00.000Z'),
            roles: [{ role: RoleName.CUSTOMER }],
          };
        },
      },
      notificationPreference: {
        findUnique: async () => null,
      },
      notification: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'notif-1',
          ...data,
          body: data.body ?? null,
          payload: null,
          createdAt: new Date('2026-04-01T12:00:00.000Z'),
          readAt: null,
        }),
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const session = await service.registerCustomer({
      fullName: 'Customer Example',
      email: 'customer@example.com',
      password: 'Beauty123',
      avatarUrl: 'https://images.example.com/users/customer-example.jpg',
    });

    assert.equal(
      creates[0]?.data.avatarUrl,
      'https://images.example.com/users/customer-example.jpg',
    );
    assert.equal(
      session.user.avatarUrl,
      'https://images.example.com/users/customer-example.jpg',
    );
  });

  it('persists business page views in Prisma instead of memory', async () => {
    const calls: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      business: {
        findUnique: async () => ({ id: 'biz-1' }),
      },
      businessPageView: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push({ data });
          return {
            id: 'page-view-1',
            ...data,
            createdAt: new Date('2026-04-01T12:00:00.000Z'),
          };
        },
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const result = await service.recordBusinessPageView(
      'biz-1',
      {
        selectedServiceId: 'svc-1',
        selectedServiceName: 'Gel Manicure',
        note: '  Checking evening slots  ',
        dwellSeconds: 91,
        colorSignals: [' Pink ', '', 'Chrome'],
        source: 'mobile_salon_detail',
      },
      {
        id: 'user-customer-1',
        role: 'customer',
        name: 'Ava Tran',
        email: 'ava@beautyfinder.app',
      },
    );

    assert.deepEqual(result, { recorded: true });
    assert.deepEqual(calls[0]?.data, {
      businessId: 'biz-1',
      customerId: 'user-customer-1',
      selectedServiceId: 'svc-1',
      selectedServiceName: 'Gel Manicure',
      note: 'Checking evening slots',
      dwellSeconds: 91,
      colorSignals: '["pink","chrome"]',
      source: 'mobile_salon_detail',
    });
  });

  it('parses serialized page-view color signals in customer reports', async () => {
    const prisma = {
      user: {
        findMany: async () => [
          {
            id: 'user-customer-1',
            email: 'ava@beautyfinder.app',
            fullName: 'Ava Tran',
            businessPageViews: [
              {
                customerId: 'user-customer-1',
                businessId: 'biz-1',
                selectedServiceName: 'Gel Manicure',
                dwellSeconds: 90,
                colorSignals: '["pink","chrome"]',
                source: 'mobile_salon_detail',
                createdAt: new Date('2026-04-01T12:00:00.000Z'),
              },
            ],
            favorites: [],
            customerAppointments: [],
          },
        ],
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const report = await service.getCustomerPreferenceReport();

    assert.deepEqual(report.colorTrends, [
      { label: 'chrome', score: 1 },
      { label: 'pink', score: 1 },
    ]);
    assert.deepEqual(report.customers[0]?.favoriteColors, [
      { label: 'chrome', score: 1 },
      { label: 'pink', score: 1 },
    ]);
  });

  it('returns persisted review media from Prisma', async () => {
    const prisma = {
      review: {
        findMany: async () => [
          {
            id: 'review-1',
            appointmentId: 'booking-1',
            businessId: 'biz-1',
            customerId: 'user-customer-1',
            rating: 5,
            comment: 'Perfect shape and shine.',
            customerAvatarUrl: 'https://images.example.com/customers/ava-tran.jpg',
            status: 'PUBLISHED',
            createdAt: new Date('2026-04-01T12:00:00.000Z'),
            updatedAt: new Date('2026-04-01T12:00:00.000Z'),
            customer: {
              id: 'user-customer-1',
              fullName: 'Ava Tran',
            },
            images: [
              {
                id: 'review-image-2',
                reviewId: 'review-1',
                url: 'https://images.example.com/reviews/review-1-photo-2.jpg',
                sortOrder: 1,
                createdAt: new Date('2026-04-01T12:00:00.000Z'),
              },
              {
                id: 'review-image-1',
                reviewId: 'review-1',
                url: 'https://images.example.com/reviews/review-1-photo-1.jpg',
                sortOrder: 0,
                createdAt: new Date('2026-04-01T12:00:00.000Z'),
              },
            ],
          },
        ],
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const reviews = await service.getReviews('biz-1');

    assert.equal(reviews[0]?.customerAvatarUrl, 'https://images.example.com/customers/ava-tran.jpg');
    assert.deepEqual(reviews[0]?.imageUrls, [
      'https://images.example.com/reviews/review-1-photo-1.jpg',
      'https://images.example.com/reviews/review-1-photo-2.jpg',
    ]);
  });

  it('returns staff avatars from persisted staff rows', async () => {
    const prisma = {
      business: {
        findUnique: async () => ({
          id: 'biz-1',
          name: 'Polished Studio',
          ownerUserId: 'user-owner-1',
          category: 'NAIL',
          status: BusinessStatus.APPROVED,
          staff: [
            {
              id: 'staff-1b',
              businessId: 'biz-1',
              name: 'Mila Tran',
              title: 'Junior Nail Tech',
              avatarUrl: 'https://images.example.com/staff/mila-tran.jpg',
              isActive: true,
              createdAt: new Date('2026-04-01T12:00:00.000Z'),
              updatedAt: new Date('2026-04-01T12:00:00.000Z'),
            },
          ],
        }),
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const technicians = await service.getOwnerTechnicians('biz-1', {
      id: 'user-owner-1',
      role: 'owner',
      name: 'Lina Nguyen',
      email: 'lina@polishedstudio.app',
    });

    assert.equal(
      technicians[0]?.avatarUrl,
      'https://images.example.com/staff/mila-tran.jpg',
    );
  });

  it('updates private technician services and pricing through the profile flow', async () => {
    const profileUpdates: Array<{ data: Record<string, unknown> }> = [];
    const serviceCreates: Array<{ data: Record<string, unknown> }> = [];
    let findUniqueCalls = 0;
    const existingProfile = {
      userId: 'user-technician-1',
      status: 'DRAFT',
      category: 'NAIL',
      displayName: 'Mila Tran',
      headline: null,
      bio: null,
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      heroImage: null,
      featuredOnHomepage: false,
      homepageRank: 999,
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      updatedAt: new Date('2026-04-01T12:00:00.000Z'),
      user: {
        id: 'user-technician-1',
        fullName: 'Mila Tran',
        email: 'mila@privatebeauty.app',
        phone: '555-0111',
        avatarUrl: 'https://images.example.com/users/mila-tran.jpg',
        professionalRegistration: {
          verificationStatus: 'APPROVED',
        },
      },
      services: [],
      ads: [],
    };
    const updatedProfile = {
      ...existingProfile,
      displayName: 'Mila Tran Studio',
      headline: 'Independent chrome specialist',
      featuredOnHomepage: true,
      homepageRank: 8,
      services: [
        {
          id: 'pts-1',
          profileUserId: 'user-technician-1',
          name: 'Private Gel Manicure',
          description: 'Independent service with custom pricing.',
          durationMinutes: 60,
          price: 72,
          isActive: true,
          createdAt: new Date('2026-04-01T12:00:00.000Z'),
          updatedAt: new Date('2026-04-01T12:00:00.000Z'),
        },
      ],
    };
    const tx = {
      privateTechnicianProfile: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          profileUpdates.push({ data });
          return updatedProfile;
        },
      },
      privateTechnicianService: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          serviceCreates.push({ data });
          return {
            id: 'pts-1',
            ...data,
            createdAt: new Date('2026-04-01T12:00:00.000Z'),
            updatedAt: new Date('2026-04-01T12:00:00.000Z'),
          };
        },
        findFirst: async () => null,
        updateMany: async () => ({ count: 0 }),
      },
    };
    const prisma = {
      privateTechnicianProfile: {
        findUnique: async () => {
          findUniqueCalls += 1;
          return findUniqueCalls === 1 ? existingProfile : updatedProfile;
        },
      },
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const profile = await service.updatePrivateTechnicianProfile(
      {
        displayName: 'Mila Tran Studio',
        headline: 'Independent chrome specialist',
        featuredOnHomepage: true,
        homepageRank: 8,
        services: [
          {
            name: 'Private Gel Manicure',
            description: 'Independent service with custom pricing.',
            durationMinutes: 60,
            price: 72,
            isActive: true,
          },
        ],
      },
      {
        id: 'user-technician-1',
        role: 'technician',
        name: 'Mila Tran',
        email: 'mila@privatebeauty.app',
        accountType: 'private_technician',
      },
    );

    assert.deepEqual(profileUpdates[0]?.data, {
      displayName: 'Mila Tran Studio',
      headline: 'Independent chrome specialist',
      featuredOnHomepage: true,
      homepageRank: 8,
    });
    assert.deepEqual(serviceCreates[0]?.data, {
      profileUserId: 'user-technician-1',
      name: 'Private Gel Manicure',
      description: 'Independent service with custom pricing.',
      durationMinutes: 60,
      price: 72,
      isActive: true,
    });
    assert.equal(profile.services[0]?.price, 72);
    assert.equal(profile.accountType, 'private_technician');
  });

  it('creates private technician ad campaigns from the private profile', async () => {
    const createCalls: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      privateTechnicianProfile: {
        findUnique: async () => ({ userId: 'user-technician-1' }),
      },
      privateTechnicianAd: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createCalls.push({ data });
          return {
            id: 'pta-1',
            profileUserId: 'user-technician-1',
            campaignName: 'Chrome Spring Drop',
            placement: 'CATEGORY_BOOST',
            headline: 'Private chrome sets with same-week availability',
            description: 'Independent technician ad campaign aimed at category discovery.',
            destinationUrl: 'https://beautyfinder.app/technicians/mila-tran',
            budgetAmount: 240,
            currency: 'USD',
            status: 'ACTIVE',
            startsAt: new Date('2026-04-01T00:00:00.000Z'),
            endsAt: new Date('2026-04-30T23:59:59.000Z'),
            createdAt: new Date('2026-04-01T12:00:00.000Z'),
            updatedAt: new Date('2026-04-01T12:00:00.000Z'),
          };
        },
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const ad = await service.createPrivateTechnicianAd(
      {
        campaignName: 'Chrome Spring Drop',
        placement: 'category_boost',
        headline: 'Private chrome sets with same-week availability',
        description: 'Independent technician ad campaign aimed at category discovery.',
        destinationUrl: 'https://beautyfinder.app/technicians/mila-tran',
        budget: 240,
        status: 'active',
        startsAt: '2026-04-01T00:00:00.000Z',
        endsAt: '2026-04-30T23:59:59.000Z',
      },
      {
        id: 'user-technician-1',
        role: 'technician',
        name: 'Mila Tran',
        email: 'mila@privatebeauty.app',
        accountType: 'private_technician',
      },
    );

    assert.deepEqual(createCalls[0]?.data, {
      profileUserId: 'user-technician-1',
      campaignName: 'Chrome Spring Drop',
      placement: 'CATEGORY_BOOST',
      headline: 'Private chrome sets with same-week availability',
      description: 'Independent technician ad campaign aimed at category discovery.',
      destinationUrl: 'https://beautyfinder.app/technicians/mila-tran',
      budgetAmount: 240,
      status: 'ACTIVE',
      startsAt: new Date('2026-04-01T00:00:00.000Z'),
      endsAt: new Date('2026-04-30T23:59:59.000Z'),
    });
    assert.equal(ad.status, 'active');
    assert.equal(ad.budget, 240);
  });

  it('persists owner business media fields through the owner update flow', async () => {
    const businessUpdates: Array<{ data: Record<string, unknown> }> = [];
    const cacheInvalidations: string[] = [];
    let findUniqueCalls = 0;
    const existingBusiness = {
      id: 'biz-1',
      ownerUserId: 'user-owner-1',
      name: 'Polished Studio',
      description: 'Existing description',
      category: 'NAIL',
      phone: '555-0201',
      email: 'hello@polishedstudio.app',
      addressLine1: '101 Gloss Ave',
      addressLine2: null,
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      latitude: 40.7506,
      longitude: -73.9971,
      featuredOnHomepage: true,
      homepageRank: 3,
      heroImage: 'https://images.example.com/polished-studio.jpg',
      businessLogo: null,
      businessBanner: null,
      ownerAvatarUrl: null,
      videoUrl: null,
      promotionTitle: null,
      promotionDescription: null,
      promotionDiscountPercent: null,
      promotionCode: null,
      promotionExpiresAt: null,
      rating: 4.8,
      reviewCount: 124,
      status: BusinessStatus.APPROVED,
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      updatedAt: new Date('2026-04-01T12:00:00.000Z'),
      services: [],
      images: [],
      staff: [],
    };
    const updatedBusiness = {
      ...existingBusiness,
      businessLogo: 'https://images.example.com/businesses/polished-studio-logo.png',
      businessBanner: 'https://images.example.com/businesses/polished-studio-banner.jpg',
      ownerAvatarUrl: 'https://images.example.com/users/lina-nguyen.jpg',
    };
    const tx = {
      business: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          businessUpdates.push({ data });
          return updatedBusiness;
        },
      },
      notificationPreference: {
        findUnique: async () => null,
      },
      notification: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'notif-1',
          ...data,
          body: data.body ?? null,
          payload: null,
          createdAt: new Date('2026-04-01T12:00:00.000Z'),
          readAt: null,
        }),
      },
    };
    const prisma = {
      business: {
        findUnique: async () => {
          findUniqueCalls += 1;
          return findUniqueCalls === 1 ? existingBusiness : updatedBusiness;
        },
      },
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
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
    const profile = await service.updateOwnerBusiness(
      'biz-1',
      {
        businessLogo: 'https://images.example.com/businesses/polished-studio-logo.png',
        businessBanner: 'https://images.example.com/businesses/polished-studio-banner.jpg',
        ownerAvatar: 'https://images.example.com/users/lina-nguyen.jpg',
      },
      {
        id: 'user-owner-1',
        role: 'owner',
        name: 'Lina Nguyen',
        email: 'lina@polishedstudio.app',
      },
    );

    assert.deepEqual(businessUpdates[0]?.data, {
      businessLogo: 'https://images.example.com/businesses/polished-studio-logo.png',
      businessBanner: 'https://images.example.com/businesses/polished-studio-banner.jpg',
      ownerAvatarUrl: 'https://images.example.com/users/lina-nguyen.jpg',
    });
    assert.equal(profile.businessLogo, updatedBusiness.businessLogo);
    assert.equal(profile.businessBanner, updatedBusiness.businessBanner);
    assert.equal(profile.ownerAvatar, updatedBusiness.ownerAvatarUrl);
    assert.deepEqual(cacheInvalidations, ['catalog', 'availability']);
  });

  it('persists ad pricing in Prisma and returns stable API records', async () => {
    const upserts: Array<{ where: Record<string, unknown> }> = [];
    const updates: Array<{ data: Record<string, unknown> }> = [];
    const adminActions: Array<{ data: Record<string, unknown> }> = [];
    const prisma = {
      adPricing: {
        upsert: async ({ where }: { where: Record<string, unknown> }) => {
          upserts.push({ where });
          return undefined;
        },
        findMany: async () => [
          {
            placement: 'CITY_BOOST',
            label: 'City Boost',
            dailyPrice: 52,
            monthlyPrice: 1390,
            currency: 'USD',
            note: 'Adds extra local discovery weight inside a selected city.',
            updatedAt: new Date('2026-03-20T12:00:00.000Z'),
            updatedByUserId: null,
          },
          {
            placement: 'HOMEPAGE_SPOTLIGHT',
            label: 'Homepage Spotlight',
            dailyPrice: 79,
            monthlyPrice: 1990,
            currency: 'USD',
            note: 'Prime homepage inventory for the highest-visibility salons.',
            updatedAt: new Date('2026-03-20T12:00:00.000Z'),
            updatedByUserId: null,
          },
          {
            placement: 'CATEGORY_BOOST',
            label: 'Category Boost',
            dailyPrice: 45,
            monthlyPrice: 1190,
            currency: 'USD',
            note: 'Raises salon visibility inside category browsing results.',
            updatedAt: new Date('2026-03-20T12:00:00.000Z'),
            updatedByUserId: null,
          },
        ],
        findUnique: async () => ({
          placement: 'CATEGORY_BOOST',
          label: 'Category Boost',
          dailyPrice: 45,
          monthlyPrice: 1190,
          currency: 'USD',
          note: 'Raises salon visibility inside category browsing results.',
          updatedAt: new Date('2026-03-20T12:00:00.000Z'),
          updatedByUserId: null,
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updates.push({ data });
          return {
            placement: 'CATEGORY_BOOST',
            label: 'Category Boost',
            dailyPrice: 61,
            monthlyPrice: 1490,
            currency: 'USD',
            note: 'Spring promo pricing.',
            updatedAt: new Date('2026-04-01T12:00:00.000Z'),
            updatedByUserId: 'user-admin-1',
          };
        },
      },
      adminAction: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          adminActions.push({ data });
          return { id: 'admin-action-99', ...data };
        },
      },
    };

    const service = new MarketplaceService(prisma as unknown as PrismaService);
    const pricing = await service.getAdPricing();
    const updated = await service.updateAdPricing(
      'category_boost',
      {
        dailyPrice: 61,
        monthlyPrice: 1490,
        note: 'Spring promo pricing.',
      },
      'user-admin-1',
    );

    assert.deepEqual(
      pricing.map((entry) => entry.placement),
      ['homepage_spotlight', 'category_boost', 'city_boost'],
    );
    assert.equal(upserts.length, 6);
    assert.deepEqual(updates[0]?.data, {
      dailyPrice: 61,
      monthlyPrice: 1490,
      note: 'Spring promo pricing.',
      updatedByUserId: 'user-admin-1',
    });
    assert.equal(updated.updatedByUserId, 'user-admin-1');
    assert.equal(updated.dailyPrice, 61);
    assert.equal(updated.monthlyPrice, 1490);
    assert.equal(adminActions[0]?.data.targetId, 'category_boost');
  });
});
