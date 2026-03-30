import type {
  AvailabilitySlotSummary,
  BookingRecord,
  BusinessSummary,
  NotificationPreferenceRecord,
  NotificationRecord,
  PaymentRecord,
  ReviewRecord,
  SessionPayload,
} from '@beauty-finder/types';

const fallbackCustomerId = 'user-customer-1';

export type FavoriteWithBusiness = {
  userId: string;
  businessId: string;
  createdAt: string;
  business: BusinessSummary;
};

export type UserCoordinates = {
  latitude: number;
  longitude: number;
};

const businessHeroImages: Record<string, string> = {
  'biz-1':
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1600&q=80',
  'biz-2':
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1600&q=80',
  'biz-3':
    'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1600&q=80',
  'biz-4':
    'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1600&q=80',
};

const categoryHeroImages: Record<BusinessSummary['category'], string> = {
  nail: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=1600&q=80',
  hair: 'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=1600&q=80',
};

export const fallbackBusinesses: BusinessSummary[] = [
  {
    id: 'biz-1',
    ownerId: 'user-owner-1',
    category: 'nail',
    name: 'Polished Studio',
    featuredOnHomepage: true,
    homepageRank: 3,
    addressLine1: '101 Gloss Ave',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    latitude: 40.7506,
    longitude: -73.9971,
    rating: 4.8,
    reviewCount: 124,
    heroImage: businessHeroImages['biz-1'],
    description: 'Modern gel and acrylic work with fast online booking.',
    services: [
      { id: 'svc-1', name: 'Gel Manicure', durationMinutes: 60, price: 55 },
      { id: 'svc-2', name: 'Acrylic Full Set', durationMinutes: 90, price: 85 },
    ],
  },
  {
    id: 'biz-2',
    ownerId: 'user-owner-2',
    category: 'hair',
    name: 'North Strand Hair',
    featuredOnHomepage: false,
    homepageRank: 999,
    addressLine1: '22 Ribbon Street',
    city: 'Brooklyn',
    state: 'NY',
    postalCode: '11201',
    latitude: 40.6939,
    longitude: -73.9859,
    rating: 4.7,
    reviewCount: 88,
    heroImage: businessHeroImages['biz-2'],
    description: 'Cuts, color, and silk press appointments for busy schedules.',
    services: [
      { id: 'svc-3', name: 'Silk Press', durationMinutes: 75, price: 95 },
      {
        id: 'svc-4',
        name: 'Haircut + Blowout',
        durationMinutes: 60,
        price: 70,
      },
    ],
  },
  {
    id: 'biz-3',
    ownerId: 'user-owner-3',
    category: 'nail',
    name: 'Lowcountry Gloss Bar',
    featuredOnHomepage: true,
    homepageRank: 2,
    addressLine1: '1662 Savannah Hwy',
    city: 'Charleston',
    state: 'SC',
    postalCode: '29407',
    latitude: 32.7969,
    longitude: -80.0337,
    rating: 4.9,
    reviewCount: 62,
    heroImage: businessHeroImages['biz-3'],
    description:
      'Soft gel sets, glossy pedicures, and quick polish refreshes near West Ashley.',
    services: [
      { id: 'svc-5', name: 'Soft Gel Overlay', durationMinutes: 60, price: 62 },
      { id: 'svc-6', name: 'Pedicure + Gloss', durationMinutes: 75, price: 68 },
    ],
  },
  {
    id: 'biz-4',
    ownerId: 'user-owner-4',
    category: 'hair',
    name: 'Ashley River Blowout Club',
    featuredOnHomepage: true,
    homepageRank: 1,
    addressLine1: '1401 Sam Rittenberg Blvd',
    city: 'Charleston',
    state: 'SC',
    postalCode: '29407',
    latitude: 32.8149,
    longitude: -80.0644,
    rating: 4.8,
    reviewCount: 47,
    heroImage: businessHeroImages['biz-4'],
    description:
      'Blowouts, silk press styling, and polished trims close to your side of town.',
    services: [
      {
        id: 'svc-7',
        name: 'Silk Press + Trim',
        durationMinutes: 80,
        price: 98,
      },
      { id: 'svc-8', name: 'Express Blowout', durationMinutes: 45, price: 52 },
    ],
  },
];

export const fallbackBookings: BookingRecord[] = [
  {
    id: 'booking-1',
    customerId: fallbackCustomerId,
    ownerId: 'user-owner-1',
    businessId: 'biz-1',
    serviceId: 'svc-1',
    serviceName: 'Gel Manicure',
    status: 'confirmed',
    startAt: '2026-03-22T15:00:00.000Z',
    endAt: '2026-03-22T16:00:00.000Z',
    note: 'Neutral nude palette',
  },
];

export const fallbackNotifications: NotificationRecord[] = [
  {
    id: 'notif-1',
    userId: fallbackCustomerId,
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    body: 'Polished Studio confirmed your appointment.',
    createdAt: '2026-03-20T14:31:00.000Z',
    read: false,
  },
  {
    id: 'notif-2',
    userId: fallbackCustomerId,
    type: 'payment_receipt',
    title: 'Payment receipt',
    body: 'Your Beauty Finder demo payment was captured successfully.',
    createdAt: '2026-03-20T14:36:00.000Z',
    read: true,
  },
];

export const fallbackNotificationPreferences: NotificationPreferenceRecord = {
  userId: fallbackCustomerId,
  bookingCreated: true,
  bookingConfirmed: true,
  messageReceived: true,
  paymentReceipt: true,
  reviewReceived: true,
  system: true,
  updatedAt: '2026-03-20T14:00:00.000Z',
};

export const fallbackPayments: PaymentRecord[] = [
  {
    id: 'payment-1',
    bookingId: 'booking-1',
    customerId: fallbackCustomerId,
    ownerId: 'user-owner-1',
    businessId: 'biz-1',
    serviceId: 'svc-1',
    method: 'card',
    status: 'paid',
    subtotal: 55,
    discount: 8.25,
    tax: 3.74,
    tip: 5,
    total: 55.49,
    currency: 'USD',
    receiptNumber: 'BF-20260329-TEST0001',
    cardBrand: 'VISA',
    cardLast4: '4242',
    paidAt: '2026-03-29T18:00:00.000Z',
    createdAt: '2026-03-29T18:00:00.000Z',
  },
];

export const fallbackReviews: ReviewRecord[] = [
  {
    id: 'review-1',
    appointmentId: 'booking-1',
    businessId: 'biz-1',
    customerId: 'user-customer-1',
    customerName: 'Ava Tran',
    customerAvatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    rating: 5,
    comment:
      'Clean studio, quick check-in, and the nude-pink gel set looked exactly like the inspo photo.',
    imageUrls: [
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
    ],
    createdAt: '2026-03-24T18:45:00.000Z',
  },
  {
    id: 'review-2',
    businessId: 'biz-1',
    customerId: 'user-customer-2',
    customerName: 'Jenna Park',
    customerAvatarUrl:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
    rating: 4,
    comment:
      'Loved the shape and shine. I would book a slightly longer slot next time for detailed nail art.',
    imageUrls: [
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?auto=format&fit=crop&w=800&q=80',
    ],
    createdAt: '2026-03-19T16:20:00.000Z',
  },
];

export const fallbackAvailability: AvailabilitySlotSummary[] = [
  {
    id: 'slot-1',
    businessId: 'biz-1',
    serviceId: 'svc-1',
    staffName: 'Lina Nguyen',
    startAt: '2026-03-22T15:00:00.000Z',
    endAt: '2026-03-22T16:00:00.000Z',
    isBooked: true,
  },
  {
    id: 'slot-2',
    businessId: 'biz-1',
    serviceId: 'svc-1',
    staffName: 'Lina Nguyen',
    startAt: '2026-03-23T16:00:00.000Z',
    endAt: '2026-03-23T17:00:00.000Z',
    isBooked: false,
  },
  {
    id: 'slot-4',
    businessId: 'biz-1',
    serviceId: 'svc-2',
    staffName: 'Lina Nguyen',
    startAt: '2026-03-25T17:30:00.000Z',
    endAt: '2026-03-25T19:00:00.000Z',
    isBooked: false,
  },
  {
    id: 'slot-3',
    businessId: 'biz-2',
    serviceId: 'svc-3',
    staffName: 'North Strand Team',
    startAt: '2026-03-24T18:00:00.000Z',
    endAt: '2026-03-24T19:15:00.000Z',
    isBooked: false,
  },
  {
    id: 'slot-5',
    businessId: 'biz-3',
    serviceId: 'svc-5',
    staffName: 'Mia Carter',
    startAt: '2026-03-26T14:00:00.000Z',
    endAt: '2026-03-26T15:00:00.000Z',
    isBooked: false,
  },
  {
    id: 'slot-6',
    businessId: 'biz-3',
    serviceId: 'svc-6',
    staffName: 'Mia Carter',
    startAt: '2026-03-26T16:00:00.000Z',
    endAt: '2026-03-26T17:15:00.000Z',
    isBooked: false,
  },
  {
    id: 'slot-7',
    businessId: 'biz-4',
    serviceId: 'svc-7',
    staffName: 'Jade Brooks',
    startAt: '2026-03-26T17:30:00.000Z',
    endAt: '2026-03-26T18:50:00.000Z',
    isBooked: false,
  },
  {
    id: 'slot-8',
    businessId: 'biz-4',
    serviceId: 'svc-8',
    staffName: 'Jade Brooks',
    startAt: '2026-03-27T14:00:00.000Z',
    endAt: '2026-03-27T14:45:00.000Z',
    isBooked: false,
  },
];

export const fallbackFavoriteIds = ['biz-1'];
const customerSessionStorageKey = 'beauty-finder.customer-session';
let memorySession: SessionPayload | null = null;

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as SessionPayload;

  return Boolean(
    candidate.accessToken &&
    candidate.expiresAt &&
    candidate.user?.id &&
    candidate.user?.role &&
    candidate.user?.name &&
    candidate.user?.email,
  );
}

function isSessionExpired(session: SessionPayload) {
  const expiresAt = Date.parse(session.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

export function getStoredSession() {
  const storage = getBrowserStorage();

  if (storage) {
    try {
      const raw = storage.getItem(customerSessionStorageKey);

      if (raw) {
        const parsed = JSON.parse(raw) as unknown;

        if (isSessionPayload(parsed)) {
          if (isSessionExpired(parsed)) {
            storage.removeItem(customerSessionStorageKey);
            memorySession = null;
            return null;
          }

          memorySession = parsed;
          return parsed;
        }
      }
    } catch {
      // Ignore malformed session payloads and fall back to memory state.
    }
  }

  if (memorySession && isSessionExpired(memorySession)) {
    memorySession = null;
    return null;
  }

  return memorySession;
}

export function saveStoredSession(session: SessionPayload) {
  memorySession = session;

  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(customerSessionStorageKey, JSON.stringify(session));
  } catch {
    // Ignore storage failures and keep the in-memory session.
  }
}

export function clearStoredSession() {
  memorySession = null;

  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(customerSessionStorageKey);
  } catch {
    // Ignore storage failures.
  }
}

export function getCurrentCustomerId() {
  return getStoredSession()?.user.id ?? null;
}

export function getCurrentCustomerAvatarUrl() {
  return getStoredSession()?.user.avatarUrl ?? null;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

export function getApiBaseUrl() {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/$/, '');
  }

  if (
    typeof window !== 'undefined' &&
    !isLocalHostname(window.location.hostname)
  ) {
    return null;
  }

  return 'http://127.0.0.1:3000/api';
}

export function getApiUnavailableMessage() {
  return 'Live API is not configured for this deployment yet. Browse the showcase for now.';
}

export function getAuthHeaders(contentType = false): HeadersInit {
  const accessToken = getStoredSession()?.accessToken;

  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
  };
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, init);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function formatBusinessAddress(business: BusinessSummary) {
  return [
    business.addressLine1,
    business.addressLine2,
    `${business.city}, ${business.state} ${business.postalCode}`,
  ]
    .filter(Boolean)
    .join(', ');
}

function getBusinessMapQuery(business: BusinessSummary) {
  if (
    typeof business.latitude === 'number' &&
    typeof business.longitude === 'number'
  ) {
    return `${business.latitude},${business.longitude}`;
  }

  return formatBusinessAddress(business);
}

export function getBusinessMapEmbedUrl(business: BusinessSummary) {
  const query = encodeURIComponent(getBusinessMapQuery(business));
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;

  if (apiKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${query}`;
  }

  return `https://maps.google.com/maps?q=${query}&z=15&output=embed`;
}

export function getBusinessGoogleMapsUrl(business: BusinessSummary) {
  const query = encodeURIComponent(
    `${business.name}, ${formatBusinessAddress(business)}`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function getBusinessById(businessId: string) {
  return (
    fallbackBusinesses.find((business) => business.id === businessId) ?? null
  );
}

export function getBusinessHeroImage(business: BusinessSummary) {
  if (business.heroImage && !business.heroImage.includes('example.com')) {
    return business.heroImage;
  }

  return (
    businessHeroImages[business.id] ?? categoryHeroImages[business.category]
  );
}

export function getFallbackAvailabilityForBusiness(
  businessId: string,
  serviceId?: string,
) {
  return fallbackAvailability.filter(
    (slot) =>
      slot.businessId === businessId &&
      (!serviceId || slot.serviceId === serviceId),
  );
}

export function getFallbackReviewsForBusiness(businessId: string) {
  return fallbackReviews.filter((review) => review.businessId === businessId);
}

export function businessMatchesSearch(
  business: BusinessSummary,
  searchText: string,
) {
  const query = searchText.trim().toLowerCase();

  if (!query) {
    return true;
  }

  const haystack = [
    business.name,
    business.category,
    business.city,
    business.state,
    business.description,
    ...business.services.map((service) => service.name),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getBusinessDistanceKm(
  business: BusinessSummary,
  userCoordinates: UserCoordinates,
) {
  if (
    typeof business.latitude !== 'number' ||
    typeof business.longitude !== 'number'
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(business.latitude - userCoordinates.latitude);
  const deltaLongitude = toRadians(
    business.longitude - userCoordinates.longitude,
  );
  const startLatitude = toRadians(userCoordinates.latitude);
  const endLatitude = toRadians(business.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function formatDistanceKm(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
}
