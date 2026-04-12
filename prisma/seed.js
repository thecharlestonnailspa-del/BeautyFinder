const { loadAppEnv } = require('../scripts/load-app-env.cjs');
const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');

loadAppEnv();

const appEnv = (process.env.APP_ENV ?? 'local').trim().toLowerCase();
const shouldSeedSampleData = ['1', 'true', 'yes'].includes(
  (process.env.SEED_SAMPLE_DATA ?? '').trim().toLowerCase(),
);

if (!shouldSeedSampleData) {
  console.log('[seed] Skipping sample data because SEED_SAMPLE_DATA is not true.');
  process.exit(0);
}

if (appEnv === 'production') {
  console.error('[seed] Refusing to seed sample data when APP_ENV=production.');
  process.exit(1);
}

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

async function seedUsers() {
  const users = [
    {
      id: 'user-customer-1',
      email: 'ava@beautyfinder.app',
      passwordHash: hashPassword('mock-password'),
      fullName: 'Ava Tran',
      phone: '555-0101',
      avatarUrl: 'https://images.example.com/users/ava-tran.jpg',
    },
    {
      id: 'user-owner-1',
      email: 'lina@polishedstudio.app',
      passwordHash: hashPassword('mock-password'),
      fullName: 'Lina Nguyen',
      phone: '555-0102',
      avatarUrl: 'https://images.example.com/users/lina-nguyen.jpg',
    },
    {
      id: 'user-owner-2',
      email: 'nora@northstrandhair.app',
      passwordHash: hashPassword('mock-password'),
      fullName: 'Nora Bennett',
      phone: '555-0104',
      avatarUrl: 'https://images.example.com/users/nora-bennett.jpg',
    },
    {
      id: 'user-owner-3',
      email: 'mia@lowcountryglossbar.app',
      passwordHash: hashPassword('mock-password'),
      fullName: 'Mia Carter',
      phone: '555-0105',
      avatarUrl: 'https://images.example.com/users/mia-carter.jpg',
    },
    {
      id: 'user-owner-4',
      email: 'jade@ashleyriverblowout.app',
      passwordHash: hashPassword('mock-password'),
      fullName: 'Jade Brooks',
      phone: '555-0106',
      avatarUrl: 'https://images.example.com/users/jade-brooks.jpg',
    },
    {
      id: 'user-owner-5',
      email: 'selena@lunalashatelier.app',
      passwordHash: hashPassword('mock-password'),
      fullName: 'Selena Park',
      phone: '555-0107',
      avatarUrl: 'https://images.example.com/users/selena-park.jpg',
    },
    {
      id: 'user-owner-6',
      email: 'tessa@velvettintstudio.app',
      passwordHash: hashPassword('mock-password'),
      fullName: 'Tessa Quinn',
      phone: '555-0108',
      avatarUrl: 'https://images.example.com/users/tessa-quinn.jpg',
    },
    {
      id: 'user-technician-1',
      email: 'mila@polishedstudio.app',
      passwordHash: hashPassword('mock-password'),
      fullName: 'Mila Tran',
      phone: '555-0111',
      avatarUrl: 'https://images.example.com/users/mila-tran.jpg',
    },
    {
      id: 'user-admin-1',
      email: 'admin@beautyfinder.app',
      passwordHash: hashPassword('mock-password'),
      fullName: 'Mason Lee',
      phone: '555-0103',
      avatarUrl: 'https://images.example.com/users/mason-lee.jpg',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user,
      create: user,
    });
  }

  const roles = [
    { userId: 'user-customer-1', role: 'CUSTOMER' },
    { userId: 'user-owner-1', role: 'OWNER' },
    { userId: 'user-owner-2', role: 'OWNER' },
    { userId: 'user-owner-3', role: 'OWNER' },
    { userId: 'user-owner-4', role: 'OWNER' },
    { userId: 'user-owner-5', role: 'OWNER' },
    { userId: 'user-owner-6', role: 'OWNER' },
    { userId: 'user-technician-1', role: 'TECHNICIAN' },
    { userId: 'user-admin-1', role: 'ADMIN' },
  ];

  for (const role of roles) {
    await prisma.userRole.upsert({
      where: {
        userId_role: {
          userId: role.userId,
          role: role.role,
        },
      },
      update: {},
      create: role,
    });
  }

  const technicianCredentials = [
    {
      userId: 'user-technician-1',
      accountType: 'PRIVATE_TECHNICIAN',
      verificationStatus: 'APPROVED',
      identityCardNumber: 'ID-NY-7741',
      ssaNumber: '***-**-1188',
      licenseNumber: 'NY-TECH-5521',
      licenseState: 'NY',
    },
  ];

  for (const credential of technicianCredentials) {
    await prisma.professionalRegistration.upsert({
      where: { userId: credential.userId },
      update: credential,
      create: credential,
    });
  }
}

async function seedNotificationPreferences() {
  const userIds = [
    'user-customer-1',
    'user-owner-1',
    'user-owner-2',
    'user-owner-3',
    'user-owner-4',
    'user-owner-5',
    'user-owner-6',
    'user-technician-1',
    'user-admin-1',
  ];

  for (const userId of userIds) {
    await prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });
  }
}

async function seedMarketplace() {
  const businesses = [
    {
      id: 'biz-1',
      ownerUserId: 'user-owner-1',
      name: 'Polished Studio',
      description:
        'Gel, acrylic, and minimalist nail art for busy city clients.',
      category: 'NAIL',
      phone: '555-0201',
      email: 'hello@polishedstudio.app',
      addressLine1: '101 Gloss Ave',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      latitude: 40.7506,
      longitude: -73.9971,
      featuredOnHomepage: true,
      homepageRank: 3,
      heroImage: 'https://images.example.com/polished-studio.jpg',
      businessLogo: 'https://images.example.com/businesses/polished-studio-logo.png',
      businessBanner: 'https://images.example.com/businesses/polished-studio-banner.jpg',
      ownerAvatarUrl: 'https://images.example.com/users/lina-nguyen.jpg',
      videoUrl: 'https://videos.example.com/polished-studio-tour.mp4',
      promotionTitle: 'Spring gloss refresh',
      promotionDescription:
        'Book any gel service this week and bundle nail art at a lighter rate.',
      promotionDiscountPercent: 15,
      promotionCode: 'GLOSS15',
      promotionExpiresAt: new Date('2026-04-12T23:59:59.000Z'),
      rating: 4.8,
      reviewCount: 124,
      status: 'APPROVED',
    },
    {
      id: 'biz-2',
      ownerUserId: 'user-owner-2',
      name: 'North Strand Hair',
      description: 'Color, silk press, and precision cuts with online booking.',
      category: 'HAIR',
      phone: '555-0202',
      email: 'hello@northstrandhair.app',
      addressLine1: '22 Ribbon Street',
      city: 'Brooklyn',
      state: 'NY',
      postalCode: '11201',
      latitude: 40.6939,
      longitude: -73.9859,
      featuredOnHomepage: false,
      homepageRank: 999,
      heroImage: 'https://images.example.com/north-strand-hair.jpg',
      businessLogo: 'https://images.example.com/businesses/north-strand-hair-logo.png',
      businessBanner: 'https://images.example.com/businesses/north-strand-hair-banner.jpg',
      ownerAvatarUrl: 'https://images.example.com/users/nora-bennett.jpg',
      promotionTitle: 'Blowout weekday drop',
      promotionDescription:
        'Midweek styling promo to keep chairs filled before the weekend rush.',
      promotionDiscountPercent: 10,
      promotionCode: 'MIDWEEK10',
      promotionExpiresAt: new Date('2026-04-05T23:59:59.000Z'),
      rating: 4.7,
      reviewCount: 88,
      status: 'APPROVED',
    },
    {
      id: 'biz-3',
      ownerUserId: 'user-owner-3',
      name: 'Lowcountry Gloss Bar',
      description:
        'Soft gel sets, glossy pedicures, and quick polish refreshes near West Ashley.',
      category: 'NAIL',
      phone: '555-0203',
      email: 'hello@lowcountryglossbar.app',
      addressLine1: '1662 Savannah Hwy',
      city: 'Charleston',
      state: 'SC',
      postalCode: '29407',
      latitude: 32.7969,
      longitude: -80.0337,
      featuredOnHomepage: true,
      homepageRank: 2,
      heroImage: 'https://images.example.com/lowcountry-gloss-bar.jpg',
      businessLogo: 'https://images.example.com/businesses/lowcountry-gloss-bar-logo.png',
      businessBanner: 'https://images.example.com/businesses/lowcountry-gloss-bar-banner.jpg',
      ownerAvatarUrl: 'https://images.example.com/users/mia-carter.jpg',
      videoUrl: 'https://videos.example.com/lowcountry-gloss-bar-reel.mp4',
      rating: 4.9,
      reviewCount: 62,
      status: 'APPROVED',
    },
    {
      id: 'biz-4',
      ownerUserId: 'user-owner-4',
      name: 'Ashley River Blowout Club',
      description:
        'Blowouts, silk press styling, and polished trims close to your side of town.',
      category: 'HAIR',
      phone: '555-0204',
      email: 'hello@ashleyriverblowout.app',
      addressLine1: '1401 Sam Rittenberg Blvd',
      city: 'Charleston',
      state: 'SC',
      postalCode: '29407',
      latitude: 32.8149,
      longitude: -80.0644,
      featuredOnHomepage: true,
      homepageRank: 1,
      heroImage: 'https://images.example.com/ashley-river-blowout.jpg',
      businessLogo: 'https://images.example.com/businesses/ashley-river-blowout-logo.png',
      businessBanner: 'https://images.example.com/businesses/ashley-river-blowout-banner.jpg',
      ownerAvatarUrl: 'https://images.example.com/users/jade-brooks.jpg',
      rating: 4.8,
      reviewCount: 47,
      status: 'APPROVED',
    },
    {
      id: 'biz-5',
      ownerUserId: 'user-owner-5',
      name: 'Luna Lash Atelier',
      description:
        'New lash and brow concept pending trust review before launch.',
      category: 'HAIR',
      phone: '555-0205',
      email: 'hello@lunalashatelier.app',
      addressLine1: '88 King Street',
      city: 'Charleston',
      state: 'SC',
      postalCode: '29401',
      latitude: 32.7801,
      longitude: -79.9365,
      featuredOnHomepage: false,
      homepageRank: 999,
      heroImage: 'https://images.example.com/luna-lash-atelier.jpg',
      businessLogo: 'https://images.example.com/businesses/luna-lash-atelier-logo.png',
      ownerAvatarUrl: 'https://images.example.com/users/selena-park.jpg',
      rating: 0,
      reviewCount: 0,
      status: 'PENDING_REVIEW',
    },
    {
      id: 'biz-6',
      ownerUserId: 'user-owner-6',
      name: 'Velvet Tint Studio',
      description:
        'Temporarily suspended while the admin team reviews profile details.',
      category: 'HAIR',
      phone: '555-0206',
      email: 'hello@velvettintstudio.app',
      addressLine1: '17 Orchard Lane',
      city: 'Brooklyn',
      state: 'NY',
      postalCode: '11211',
      latitude: 40.7173,
      longitude: -73.9557,
      featuredOnHomepage: false,
      homepageRank: 999,
      heroImage: 'https://images.example.com/velvet-tint-studio.jpg',
      businessLogo: 'https://images.example.com/businesses/velvet-tint-studio-logo.png',
      ownerAvatarUrl: 'https://images.example.com/users/tessa-quinn.jpg',
      rating: 4.2,
      reviewCount: 8,
      status: 'SUSPENDED',
    },
  ];

  for (const business of businesses) {
    await prisma.business.upsert({
      where: { id: business.id },
      update: business,
      create: business,
    });
  }

  const businessComplianceProfiles = [
    {
      businessId: 'biz-1',
      salonLicenseNumber: 'SALON-NY-2044',
      businessLicenseNumber: 'BIZ-NY-8841',
      einNumber: '13-4128841',
    },
    {
      businessId: 'biz-2',
      salonLicenseNumber: 'SALON-NY-3180',
      businessLicenseNumber: 'BIZ-NY-9024',
      einNumber: '13-5129024',
    },
    {
      businessId: 'biz-3',
      salonLicenseNumber: 'SALON-SC-1408',
      businessLicenseNumber: 'BIZ-SC-6602',
      einNumber: '57-4466602',
    },
    {
      businessId: 'biz-4',
      salonLicenseNumber: 'SALON-SC-2091',
      businessLicenseNumber: 'BIZ-SC-7714',
      einNumber: '57-5177714',
    },
  ];

  for (const compliance of businessComplianceProfiles) {
    await prisma.businessCompliance.upsert({
      where: { businessId: compliance.businessId },
      update: compliance,
      create: compliance,
    });
  }

  const images = [
    {
      id: 'img-1',
      businessId: 'biz-1',
      url: 'https://images.example.com/polished-studio.jpg',
      sortOrder: 0,
    },
    {
      id: 'img-2',
      businessId: 'biz-2',
      url: 'https://images.example.com/north-strand-hair.jpg',
      sortOrder: 0,
    },
    {
      id: 'img-3',
      businessId: 'biz-3',
      url: 'https://images.example.com/lowcountry-gloss-bar.jpg',
      sortOrder: 0,
    },
    {
      id: 'img-4',
      businessId: 'biz-4',
      url: 'https://images.example.com/ashley-river-blowout.jpg',
      sortOrder: 0,
    },
    {
      id: 'img-5',
      businessId: 'biz-5',
      url: 'https://images.example.com/luna-lash-atelier.jpg',
      sortOrder: 0,
    },
    {
      id: 'img-6',
      businessId: 'biz-6',
      url: 'https://images.example.com/velvet-tint-studio.jpg',
      sortOrder: 0,
    },
  ];

  for (const image of images) {
    await prisma.businessImage.upsert({
      where: { id: image.id },
      update: image,
      create: image,
    });
  }

  const services = [
    {
      id: 'svc-1',
      businessId: 'biz-1',
      name: 'Gel Manicure',
      durationMinutes: 60,
      price: 55,
    },
    {
      id: 'svc-2',
      businessId: 'biz-1',
      name: 'Acrylic Full Set',
      durationMinutes: 90,
      price: 85,
    },
    {
      id: 'svc-3',
      businessId: 'biz-2',
      name: 'Silk Press',
      durationMinutes: 75,
      price: 95,
    },
    {
      id: 'svc-4',
      businessId: 'biz-2',
      name: 'Haircut + Blowout',
      durationMinutes: 60,
      price: 70,
    },
    {
      id: 'svc-5',
      businessId: 'biz-3',
      name: 'Soft Gel Overlay',
      durationMinutes: 60,
      price: 62,
    },
    {
      id: 'svc-6',
      businessId: 'biz-3',
      name: 'Pedicure + Gloss',
      durationMinutes: 75,
      price: 68,
    },
    {
      id: 'svc-7',
      businessId: 'biz-4',
      name: 'Silk Press + Trim',
      durationMinutes: 80,
      price: 98,
    },
    {
      id: 'svc-8',
      businessId: 'biz-4',
      name: 'Express Blowout',
      durationMinutes: 45,
      price: 52,
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: service,
      create: service,
    });
  }

  const staffMembers = [
    {
      id: 'staff-1',
      businessId: 'biz-1',
      name: 'Lina Nguyen',
      title: 'Lead Nail Artist',
      avatarUrl: 'https://images.example.com/staff/lina-nguyen.jpg',
    },
    {
      id: 'staff-1b',
      businessId: 'biz-1',
      name: 'Mila Tran',
      title: 'Junior Nail Tech',
      avatarUrl: 'https://images.example.com/staff/mila-tran.jpg',
    },
    {
      id: 'staff-2',
      businessId: 'biz-2',
      name: 'North Strand Team',
      title: 'Hair Team',
      avatarUrl: 'https://images.example.com/staff/north-strand-team.jpg',
    },
    {
      id: 'staff-3',
      businessId: 'biz-3',
      name: 'Mia Carter',
      title: 'Nail Artist',
      avatarUrl: 'https://images.example.com/staff/mia-carter.jpg',
    },
    {
      id: 'staff-3b',
      businessId: 'biz-3',
      name: 'Mila Tran',
      title: 'Guest Nail Tech',
      avatarUrl: 'https://images.example.com/staff/mila-tran-guest.jpg',
    },
    {
      id: 'staff-4',
      businessId: 'biz-4',
      name: 'Jade Brooks',
      title: 'Style Director',
      avatarUrl: 'https://images.example.com/staff/jade-brooks.jpg',
    },
  ];

  for (const staff of staffMembers) {
    await prisma.staff.upsert({
      where: { id: staff.id },
      update: staff,
      create: staff,
    });
  }

  const privateTechnicianProfiles = [
    {
      userId: 'user-technician-1',
      status: 'PUBLISHED',
      category: 'NAIL',
      displayName: 'Mila Tran',
      headline: 'Independent nail artist for chrome, gel, and minimalist sets.',
      bio: 'Private technician profile with flexible pricing, direct service packages, and paid ad campaigns managed separately from salon staff rosters.',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      heroImage: 'https://images.example.com/private-technicians/mila-tran-cover.jpg',
      featuredOnHomepage: true,
      homepageRank: 4,
    },
  ];

  for (const profile of privateTechnicianProfiles) {
    await prisma.privateTechnicianProfile.upsert({
      where: { userId: profile.userId },
      update: profile,
      create: profile,
    });
  }

  const privateTechnicianServices = [
    {
      id: 'pts-1',
      profileUserId: 'user-technician-1',
      name: 'Private Gel Manicure',
      description: 'Independent technician booking with custom chrome finish options.',
      durationMinutes: 60,
      price: 72,
      isActive: true,
    },
    {
      id: 'pts-2',
      profileUserId: 'user-technician-1',
      name: 'Soft Gel Rebalance',
      description: 'Maintenance appointment for returning private clients.',
      durationMinutes: 75,
      price: 88,
      isActive: true,
    },
  ];

  for (const service of privateTechnicianServices) {
    await prisma.privateTechnicianService.upsert({
      where: { id: service.id },
      update: service,
      create: service,
    });
  }

  const privateTechnicianAds = [
    {
      id: 'pta-1',
      profileUserId: 'user-technician-1',
      campaignName: 'Chrome Spring Drop',
      placement: 'CATEGORY_BOOST',
      headline: 'Private chrome sets with same-week availability',
      description: 'Independent technician ad campaign aimed at nail category discovery.',
      destinationUrl: 'https://beautyfinder.app/technicians/mila-tran',
      budgetAmount: 240,
      currency: 'USD',
      status: 'ACTIVE',
      startsAt: new Date('2026-04-01T00:00:00.000Z'),
      endsAt: new Date('2026-04-30T23:59:59.000Z'),
    },
  ];

  for (const ad of privateTechnicianAds) {
    await prisma.privateTechnicianAd.upsert({
      where: { id: ad.id },
      update: ad,
      create: ad,
    });
  }

  const slots = [
    {
      id: 'slot-1',
      businessId: 'biz-1',
      serviceId: 'svc-1',
      staffId: 'staff-1',
      startTime: new Date('2026-03-22T15:00:00.000Z'),
      endTime: new Date('2026-03-22T16:00:00.000Z'),
      isBooked: true,
    },
    {
      id: 'slot-2',
      businessId: 'biz-1',
      serviceId: 'svc-1',
      staffId: 'staff-1',
      startTime: new Date('2026-03-23T16:00:00.000Z'),
      endTime: new Date('2026-03-23T17:00:00.000Z'),
      isBooked: false,
    },
    {
      id: 'slot-3',
      businessId: 'biz-2',
      serviceId: 'svc-3',
      staffId: 'staff-2',
      startTime: new Date('2026-03-24T18:00:00.000Z'),
      endTime: new Date('2026-03-24T19:15:00.000Z'),
      isBooked: false,
    },
    {
      id: 'slot-4',
      businessId: 'biz-1',
      serviceId: 'svc-2',
      staffId: 'staff-1',
      startTime: new Date('2026-03-25T17:30:00.000Z'),
      endTime: new Date('2026-03-25T19:00:00.000Z'),
      isBooked: false,
    },
    {
      id: 'slot-5',
      businessId: 'biz-3',
      serviceId: 'svc-5',
      staffId: 'staff-3',
      startTime: new Date('2026-03-26T14:00:00.000Z'),
      endTime: new Date('2026-03-26T15:00:00.000Z'),
      isBooked: false,
    },
    {
      id: 'slot-6',
      businessId: 'biz-3',
      serviceId: 'svc-6',
      staffId: 'staff-3',
      startTime: new Date('2026-03-26T16:00:00.000Z'),
      endTime: new Date('2026-03-26T17:15:00.000Z'),
      isBooked: false,
    },
    {
      id: 'slot-7',
      businessId: 'biz-4',
      serviceId: 'svc-7',
      staffId: 'staff-4',
      startTime: new Date('2026-03-26T17:30:00.000Z'),
      endTime: new Date('2026-03-26T18:50:00.000Z'),
      isBooked: false,
    },
    {
      id: 'slot-8',
      businessId: 'biz-4',
      serviceId: 'svc-8',
      staffId: 'staff-4',
      startTime: new Date('2026-03-27T14:00:00.000Z'),
      endTime: new Date('2026-03-27T14:45:00.000Z'),
      isBooked: false,
    },
  ];

  for (const slot of slots) {
    await prisma.availabilitySlot.upsert({
      where: { id: slot.id },
      update: slot,
      create: slot,
    });
  }
}

async function seedBookingsAndMessages() {
  await prisma.appointment.upsert({
    where: { id: 'booking-1' },
    update: {
      customerId: 'user-customer-1',
      ownerId: 'user-owner-1',
      businessId: 'biz-1',
      serviceId: 'svc-1',
      staffId: 'staff-1',
      status: 'CONFIRMED',
      startTime: new Date('2026-03-22T15:00:00.000Z'),
      endTime: new Date('2026-03-22T16:00:00.000Z'),
      notes: 'Neutral nude palette',
    },
    create: {
      id: 'booking-1',
      customerId: 'user-customer-1',
      ownerId: 'user-owner-1',
      businessId: 'biz-1',
      serviceId: 'svc-1',
      staffId: 'staff-1',
      status: 'CONFIRMED',
      startTime: new Date('2026-03-22T15:00:00.000Z'),
      endTime: new Date('2026-03-22T16:00:00.000Z'),
      notes: 'Neutral nude palette',
    },
  });

  await prisma.appointmentStatusHistory.upsert({
    where: { id: 'status-history-1' },
    update: {
      appointmentId: 'booking-1',
      oldStatus: 'PENDING',
      newStatus: 'CONFIRMED',
      changedByUserId: 'user-owner-1',
    },
    create: {
      id: 'status-history-1',
      appointmentId: 'booking-1',
      oldStatus: 'PENDING',
      newStatus: 'CONFIRMED',
      changedByUserId: 'user-owner-1',
    },
  });

  await prisma.payment.upsert({
    where: { appointmentId: 'booking-1' },
    update: {
      method: 'CARD',
      status: 'PAID',
      subtotalAmount: 55,
      discountAmount: 8.25,
      taxAmount: 3.74,
      tipAmount: 0,
      totalAmount: 50.49,
      currency: 'USD',
      receiptNumber: 'BF-20260320-SEED0001',
      cardBrand: 'VISA',
      cardLast4: '4242',
      paidAt: new Date('2026-03-20T14:28:00.000Z'),
    },
    create: {
      appointmentId: 'booking-1',
      method: 'CARD',
      status: 'PAID',
      subtotalAmount: 55,
      discountAmount: 8.25,
      taxAmount: 3.74,
      tipAmount: 0,
      totalAmount: 50.49,
      currency: 'USD',
      receiptNumber: 'BF-20260320-SEED0001',
      cardBrand: 'VISA',
      cardLast4: '4242',
      paidAt: new Date('2026-03-20T14:28:00.000Z'),
    },
  });

  await prisma.conversation.upsert({
    where: { id: 'conv-1' },
    update: {
      businessId: 'biz-1',
      appointmentId: 'booking-1',
      lastMessage: 'Your appointment is confirmed for Sunday at 3 PM.',
      lastMessageAt: new Date('2026-03-20T14:30:00.000Z'),
    },
    create: {
      id: 'conv-1',
      businessId: 'biz-1',
      appointmentId: 'booking-1',
      lastMessage: 'Your appointment is confirmed for Sunday at 3 PM.',
      lastMessageAt: new Date('2026-03-20T14:30:00.000Z'),
    },
  });

  await prisma.conversation.upsert({
    where: { id: 'conv-2' },
    update: {
      businessId: 'biz-2',
      lastMessage: 'I need help with a refund after two reschedules.',
      lastMessageAt: new Date('2026-03-24T16:10:00.000Z'),
    },
    create: {
      id: 'conv-2',
      businessId: 'biz-2',
      lastMessage: 'I need help with a refund after two reschedules.',
      lastMessageAt: new Date('2026-03-24T16:10:00.000Z'),
    },
  });

  const participants = [
    { conversationId: 'conv-1', userId: 'user-customer-1' },
    { conversationId: 'conv-1', userId: 'user-owner-1' },
    { conversationId: 'conv-2', userId: 'user-customer-1' },
    { conversationId: 'conv-2', userId: 'user-owner-2' },
  ];

  for (const participant of participants) {
    await prisma.conversationParticipant.upsert({
      where: {
        conversationId_userId: {
          conversationId: participant.conversationId,
          userId: participant.userId,
        },
      },
      update: {},
      create: participant,
    });
  }

  await prisma.conversationParticipant.deleteMany({
    where: {
      OR: [
        {
          conversationId: 'conv-1',
          userId: { notIn: ['user-customer-1', 'user-owner-1'] },
        },
        {
          conversationId: 'conv-2',
          userId: { notIn: ['user-customer-1', 'user-owner-2'] },
        },
      ],
    },
  });

  const messages = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderUserId: 'user-owner-1',
      content: 'Your appointment is confirmed for Sunday at 3 PM.',
      createdAt: new Date('2026-03-20T14:30:00.000Z'),
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      senderUserId: 'user-customer-1',
      content: 'Perfect, thank you.',
      createdAt: new Date('2026-03-20T14:35:00.000Z'),
    },
    {
      id: 'msg-3',
      conversationId: 'conv-2',
      senderUserId: 'user-customer-1',
      content: 'I need help with a refund after two reschedules.',
      createdAt: new Date('2026-03-24T16:10:00.000Z'),
    },
    {
      id: 'msg-4',
      conversationId: 'conv-2',
      senderUserId: 'user-owner-2',
      content:
        'I understand. Let me know if the platform team needs context from us.',
      createdAt: new Date('2026-03-24T16:18:00.000Z'),
    },
  ];

  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: message.id },
      update: message,
      create: message,
    });
  }
}

async function seedNotificationsAndFavorites() {
  const notifications = [
    {
      id: 'notif-1',
      userId: 'user-customer-1',
      type: 'booking_confirmed',
      title: 'Booking confirmed',
      body: 'Polished Studio confirmed your gel manicure.',
      createdAt: new Date('2026-03-20T14:31:00.000Z'),
    },
    {
      id: 'notif-2',
      userId: 'user-owner-1',
      type: 'message_received',
      title: 'New customer message',
      body: 'Ava replied in your booking chat.',
      createdAt: new Date('2026-03-20T14:36:00.000Z'),
    },
    {
      id: 'notif-3',
      userId: 'user-customer-1',
      type: 'payment_receipt',
      title: 'Payment receipt',
      body: 'Your Polished Studio payment was processed successfully.',
      createdAt: new Date('2026-03-20T14:29:00.000Z'),
    },
  ];

  await prisma.notification.deleteMany({
    where: {
      userId: {
        in: [
          'user-customer-1',
          'user-owner-1',
          'user-owner-2',
          'user-owner-3',
          'user-owner-4',
          'user-owner-5',
          'user-owner-6',
          'user-admin-1',
        ],
      },
      id: {
        notIn: notifications.map((notification) => notification.id),
      },
    },
  });

  for (const notification of notifications) {
    await prisma.notification.upsert({
      where: { id: notification.id },
      update: notification,
      create: notification,
    });
  }

  await prisma.favorite.upsert({
    where: {
      customerId_businessId: {
        customerId: 'user-customer-1',
        businessId: 'biz-1',
      },
    },
    update: {
      createdAt: new Date('2026-03-20T12:00:00.000Z'),
    },
    create: {
      customerId: 'user-customer-1',
      businessId: 'biz-1',
      createdAt: new Date('2026-03-20T12:00:00.000Z'),
    },
  });

  const reviews = [
    {
      id: 'review-1',
      appointmentId: 'booking-1',
      businessId: 'biz-1',
      customerId: 'user-customer-1',
      rating: 5,
      comment: 'Perfect shape and shine.',
      customerAvatarUrl: 'https://images.example.com/customers/ava-tran.jpg',
      status: 'PUBLISHED',
    },
    {
      id: 'review-2',
      businessId: 'biz-1',
      customerId: 'user-customer-1',
      rating: 4,
      comment: 'Needs moderation review.',
      customerAvatarUrl: 'https://images.example.com/customers/ava-tran.jpg',
      status: 'FLAGGED',
    },
    {
      id: 'review-3',
      businessId: 'biz-2',
      customerId: 'user-customer-1',
      rating: 3,
      comment: 'Possible duplicate review.',
      customerAvatarUrl: 'https://images.example.com/customers/ava-tran.jpg',
      status: 'FLAGGED',
    },
    {
      id: 'review-4',
      businessId: 'biz-2',
      customerId: 'user-customer-1',
      rating: 2,
      comment: 'Escalated for policy check.',
      customerAvatarUrl: 'https://images.example.com/customers/ava-tran.jpg',
      status: 'FLAGGED',
    },
  ];

  for (const review of reviews) {
    await prisma.review.upsert({
      where: { id: review.id },
      update: review,
      create: review,
    });
  }

  const reviewImages = [
    {
      id: 'review-image-1',
      reviewId: 'review-1',
      url: 'https://images.example.com/reviews/review-1-photo-1.jpg',
      sortOrder: 0,
    },
    {
      id: 'review-image-2',
      reviewId: 'review-1',
      url: 'https://images.example.com/reviews/review-1-photo-2.jpg',
      sortOrder: 1,
    },
  ];

  for (const reviewImage of reviewImages) {
    await prisma.reviewImage.upsert({
      where: { id: reviewImage.id },
      update: reviewImage,
      create: reviewImage,
    });
  }

  const businessPageViews = [
    {
      id: 'page-view-1',
      businessId: 'biz-1',
      customerId: 'user-customer-1',
      selectedServiceId: 'svc-1',
      selectedServiceName: 'Gel Manicure',
      note: 'Checking evening availability before booking.',
      dwellSeconds: 142,
      colorSignals: '["pink","pearl"]',
      source: 'mobile_salon_detail',
      createdAt: new Date('2026-03-20T12:10:00.000Z'),
    },
    {
      id: 'page-view-2',
      businessId: 'biz-1',
      customerId: 'user-customer-1',
      selectedServiceId: 'svc-2',
      selectedServiceName: 'Nail Art Add-on',
      note: 'Comparing art options.',
      dwellSeconds: 88,
      colorSignals: '["chrome"]',
      source: 'mobile_salon_detail',
      createdAt: new Date('2026-03-21T16:42:00.000Z'),
    },
    {
      id: 'page-view-3',
      businessId: 'biz-2',
      customerId: 'user-customer-1',
      selectedServiceId: 'svc-4',
      selectedServiceName: 'Haircut + Blowout',
      note: 'Saved for later weekend plan.',
      dwellSeconds: 51,
      colorSignals: '["caramel"]',
      source: 'web_search',
      createdAt: new Date('2026-03-22T11:15:00.000Z'),
    },
  ];

  for (const pageView of businessPageViews) {
    await prisma.businessPageView.upsert({
      where: { id: pageView.id },
      update: pageView,
      create: pageView,
    });
  }
}

async function seedAdminActions() {
  const adminActions = [
    {
      id: 'admin-action-1',
      adminUserId: 'user-admin-1',
      targetType: 'business',
      targetId: 'biz-4',
      action: 'approved_business',
      metadata: JSON.stringify({ note: 'Launch checklist verified.' }),
      createdAt: new Date('2026-03-20T13:00:00.000Z'),
    },
    {
      id: 'admin-action-2',
      adminUserId: 'user-admin-1',
      targetType: 'review',
      targetId: 'review-2',
      action: 'flag_review',
      metadata: JSON.stringify({
        note: 'Kept in moderation queue for manual review.',
      }),
      createdAt: new Date('2026-03-22T11:15:00.000Z'),
    },
    {
      id: 'admin-action-3',
      adminUserId: 'user-admin-1',
      targetType: 'conversation',
      targetId: 'conv-2',
      action: 'watch_conversation',
      metadata: JSON.stringify({
        note: 'Refund language detected in customer message.',
      }),
      createdAt: new Date('2026-03-24T16:20:00.000Z'),
    },
  ];

  for (const action of adminActions) {
    await prisma.adminAction.upsert({
      where: { id: action.id },
      update: action,
      create: action,
    });
  }
}

async function seedAdPricing() {
  const pricingEntries = [
    {
      placement: 'HOMEPAGE_SPOTLIGHT',
      label: 'Homepage Spotlight',
      dailyPrice: 79,
      monthlyPrice: 1990,
      currency: 'USD',
      note: 'Prime homepage inventory for the highest-visibility salons.',
      updatedByUserId: 'user-admin-1',
    },
    {
      placement: 'CATEGORY_BOOST',
      label: 'Category Boost',
      dailyPrice: 45,
      monthlyPrice: 1190,
      currency: 'USD',
      note: 'Raises salon visibility inside category browsing results.',
      updatedByUserId: 'user-admin-1',
    },
    {
      placement: 'CITY_BOOST',
      label: 'City Boost',
      dailyPrice: 52,
      monthlyPrice: 1390,
      currency: 'USD',
      note: 'Adds extra local discovery weight inside a selected city.',
      updatedByUserId: 'user-admin-1',
    },
  ];

  for (const entry of pricingEntries) {
    await prisma.adPricing.upsert({
      where: { placement: entry.placement },
      update: entry,
      create: entry,
    });
  }
}

async function main() {
  await seedUsers();
  await seedNotificationPreferences();
  await seedMarketplace();
  await seedBookingsAndMessages();
  await seedNotificationsAndFavorites();
  await seedAdminActions();
  await seedAdPricing();
  console.log('Seeded Beauty Finder database');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
