import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type {
  BookingRecord,
  NotificationRecord,
  OwnerAudienceReportRecord,
  OwnerBusinessProfile,
} from '@beauty-finder/types';
import {
  OwnerMotionIcon,
  type OwnerMotionIconName,
} from '../components/owner-motion-icon';
import { OwnerBusinessWorkspace } from '../components/owner-operations-studio';
import { OwnerSessionControls } from '../components/owner-session-controls';
import { OwnerTechnicianDesk } from '../components/owner-technician-desk';
import {
  fetchAuthenticatedUser,
  fetchOwnerJson,
  isPreviewOwnerToken,
  ownerSessionCookieName,
  previewOwnerUser,
} from '../lib/owner-api';

const ribbons = ['Business edits', 'Media refresh', 'Promotion control'];
const workspaceAnchors = [
  { label: 'Overview', href: '#overview' },
  { label: 'Operations', href: '#operations' },
  { label: 'Audience', href: '#audience' },
  { label: 'Business', href: '#business-workspace' },
  { label: 'Technicians', href: '#technician-desk' },
] as const;
const fallbackOwnerId = 'user-owner-1';

const businessStatusLabels = {
  draft: 'Draft',
  pending_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
} as const;

const businessStatusStyles = {
  draft: { background: '#f6ece7', color: '#7d5f57' },
  pending_review: { background: '#fff3d7', color: '#8f6a1f' },
  approved: { background: '#e8f5ee', color: '#256448' },
  rejected: { background: '#fde7e2', color: '#a03f34' },
  suspended: { background: '#ececef', color: '#5f6470' },
} as const;

const shellCardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(113, 70, 90, 0.14)',
  borderRadius: 28,
  boxShadow: '0 24px 60px rgba(51, 36, 41, 0.08)',
} as const;

const sectionEyebrowStyle = {
  margin: 0,
  color: '#9e5870',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
} as const;

const sectionTitleStyle = {
  margin: '8px 0 0',
  color: '#24171b',
  fontSize: 30,
  lineHeight: 1.12,
} as const;

const mutedTextStyle = {
  color: '#6f5961',
  lineHeight: 1.7,
} as const;

const fallbackBookings: BookingRecord[] = [
  {
    id: 'booking-1',
    customerId: 'user-customer-1',
    ownerId: fallbackOwnerId,
    businessId: 'biz-1',
    serviceId: 'svc-1',
    serviceName: 'Gel Manicure',
    status: 'confirmed',
    startAt: '2026-03-22T15:00:00.000Z',
    endAt: '2026-03-22T16:00:00.000Z',
  },
];

const fallbackOwnerBusinesses: OwnerBusinessProfile[] = [
  {
    id: 'biz-1',
    ownerId: fallbackOwnerId,
    category: 'nail',
    status: 'approved',
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
    heroImage: 'https://images.example.com/polished-studio.jpg',
    description: 'Gel, acrylic, and minimalist nail art for busy city clients.',
    galleryImages: [
      'https://images.example.com/polished-studio.jpg',
      'https://images.example.com/polished-studio-detail-1.jpg',
      'https://images.example.com/polished-studio-detail-2.jpg',
    ],
    videoUrl: 'https://videos.example.com/polished-studio-tour.mp4',
    services: [
      {
        id: 'svc-1',
        businessId: 'biz-1',
        name: 'Gel Manicure',
        durationMinutes: 60,
        price: 55,
        isActive: true,
      },
      {
        id: 'svc-2',
        businessId: 'biz-1',
        name: 'Acrylic Full Set',
        durationMinutes: 90,
        price: 85,
        isActive: true,
      },
    ],
    staff: [
      {
        id: 'staff-1',
        businessId: 'biz-1',
        name: 'Lina Nguyen',
        title: 'Lead Nail Artist',
        isActive: true,
      },
      {
        id: 'staff-1b',
        businessId: 'biz-1',
        name: 'Mila Tran',
        title: 'Junior Nail Tech',
        isActive: true,
      },
    ],
    promotion: {
      title: 'Spring gloss refresh',
      description: 'Bundle nail art with any gel appointment this week.',
      discountPercent: 15,
      code: 'GLOSS15',
      expiresAt: '2026-04-12T23:59:59.000Z',
    },
  },
];

const fallbackNotifications: NotificationRecord[] = [
  {
    id: 'notif-2',
    userId: fallbackOwnerId,
    type: 'message_received',
    title: 'New customer message',
    body: 'Ava replied in your booking chat.',
    createdAt: '2026-03-20T14:36:00.000Z',
    read: false,
  },
];

const fallbackOwnerAudienceReport: OwnerAudienceReportRecord = {
  generatedAt: '2026-03-30T00:00:00.000Z',
  totalUniqueViewers: 28,
  totalPageViews: 64,
  businessesWithViews: 1,
  businesses: [
    {
      businessId: 'biz-1',
      businessName: 'Polished Studio',
      uniqueViewers: 28,
      totalPageViews: 64,
      averageDwellSeconds: 82,
      lastViewedAt: '2026-03-30T15:45:00.000Z',
    },
  ],
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api'}${path}`,
      {
        ...init,
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'No activity yet';
  }

  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeRange(startAt: string, endAt: string) {
  return `${new Date(startAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })} - ${new Date(endAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export default async function OwnerDashboardPage() {
  const cookieStore = await cookies();
  const activeOwnerToken = cookieStore.get(ownerSessionCookieName)?.value;

  if (!activeOwnerToken) {
    redirect('/auth?mode=login');
  }

  const previewMode = isPreviewOwnerToken(activeOwnerToken);
  const ownerUser = previewMode
    ? previewOwnerUser
    : await fetchAuthenticatedUser(activeOwnerToken);

  if (!ownerUser || ownerUser.role !== 'owner') {
    redirect('/auth?mode=login');
  }

  const activeOwnerId = ownerUser.id;
  const usingSeededOwner = activeOwnerId === fallbackOwnerId;

  const [bookings, ownerProfiles, notifications, ownerAudienceReport] = await Promise.all([
    previewMode
      ? Promise.resolve(null)
      : fetchJson<BookingRecord[]>('/bookings', {
          headers: { Authorization: `Bearer ${activeOwnerToken}` },
        }),
    previewMode
      ? Promise.resolve(null)
      : fetchOwnerJson<OwnerBusinessProfile[]>('/businesses/owner/manage', activeOwnerToken),
    previewMode
      ? Promise.resolve(null)
      : fetchJson<NotificationRecord[]>('/notifications', {
          headers: { Authorization: `Bearer ${activeOwnerToken}` },
        }),
    previewMode
      ? Promise.resolve(null)
      : fetchOwnerJson<OwnerAudienceReportRecord>(
          '/customer-insights/owner/report',
          activeOwnerToken,
        ),
  ]);

  const ownerBusinesses =
    previewMode || usingSeededOwner
      ? ownerProfiles ?? fallbackOwnerBusinesses
      : ownerProfiles ?? [];
  const ownerBookings =
    previewMode || usingSeededOwner ? bookings ?? fallbackBookings : bookings ?? [];
  const ownerNotifications =
    previewMode || usingSeededOwner
      ? notifications ?? fallbackNotifications
      : notifications ?? [];
  const ownerAudience =
    previewMode || usingSeededOwner
      ? ownerAudienceReport ?? fallbackOwnerAudienceReport
      : ownerAudienceReport ?? {
          generatedAt: new Date().toISOString(),
          totalUniqueViewers: 0,
          totalPageViews: 0,
          businessesWithViews: 0,
          businesses: [],
        };

  const pendingReviewCount = ownerBusinesses.filter(
    (business) => business.status === 'pending_review',
  ).length;
  const approvedBusinesses = ownerBusinesses.filter((business) => business.status === 'approved');
  const featuredBusinesses = ownerBusinesses.filter((business) => business.featuredOnHomepage);
  const totalActiveServices = ownerBusinesses.reduce(
    (sum, business) => sum + business.services.filter((service) => service.isActive).length,
    0,
  );
  const totalActiveStaff = ownerBusinesses.reduce(
    (sum, business) => sum + business.staff.filter((member) => member.isActive).length,
    0,
  );
  const averageRating =
    ownerBusinesses.length > 0
      ? (
          ownerBusinesses.reduce((sum, business) => sum + business.rating, 0) /
          ownerBusinesses.length
        ).toFixed(1)
      : '0.0';
  const topService =
    ownerBusinesses
      .flatMap((business) => business.services)
      .filter((service) => service.isActive)
      .sort((left, right) => right.price - left.price)[0]?.name ?? 'Gel Manicure';
  const recentNotifications = ownerNotifications.slice(0, 3);
  const primaryBusiness = ownerBusinesses[0];
  const latestAudienceActivity =
    ownerAudience.businesses
      .map((business) => business.lastViewedAt)
      .filter(Boolean)
      .sort((left, right) => new Date(right ?? '').getTime() - new Date(left ?? '').getTime())[0] ??
    null;

  const appointments = ownerBookings.slice(0, 4).map((booking) => ({
    id: booking.id,
    client:
      booking.customerId === 'user-customer-1'
        ? 'Ava Tran'
        : booking.customerId.replace('user-', '').replaceAll('-', ' '),
    service: booking.serviceName,
    timeRange: formatTimeRange(booking.startAt, booking.endAt),
    dayLabel: new Date(booking.startAt).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    }),
    status: booking.status[0].toUpperCase() + booking.status.slice(1),
  }));

  const metrics = [
    {
      icon: 'bookings' as OwnerMotionIconName,
      label: 'Today bookings',
      value: String(ownerBookings.length),
      detail: 'Appointments linked to this owner account',
    },
    {
      icon: 'inbox' as OwnerMotionIconName,
      label: 'Unread messages',
      value: String(ownerNotifications.filter((notification) => !notification.read).length),
      detail: 'Customer updates still waiting on you',
    },
    {
      icon: 'audience' as OwnerMotionIconName,
      label: 'Customers viewed',
      value: String(ownerAudience.totalUniqueViewers),
      detail: 'Unique customers who opened your pages',
    },
    {
      icon: 'review' as OwnerMotionIconName,
      label: 'Pending review',
      value: String(pendingReviewCount),
      detail: 'Listings still in moderation',
    },
    {
      icon: 'rating' as OwnerMotionIconName,
      label: 'Average rating',
      value: averageRating,
      detail: 'Across your current business portfolio',
    },
  ];

  const ownerNote =
    recentNotifications[0]?.body ??
    (previewMode
      ? 'Preview mode is active. Changes save locally on this device until the API is reachable again.'
      : 'Business profile controls and technician roster now live in separate sections below.');

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(255, 233, 223, 0.9), transparent 26%), linear-gradient(180deg, #f5f0ea 0%, #fbf7f4 35%, #f4eeea 100%)',
        padding: '32px 20px 56px',
        fontFamily: '"Avenir Next", "Helvetica Neue", "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gap: 24,
        }}
      >
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 36,
            padding: 32,
            background:
              'radial-gradient(circle at top right, rgba(255, 221, 201, 0.38), transparent 20%), linear-gradient(135deg, #23181d 0%, #4d3039 42%, #8e5b5f 100%)',
            color: '#fff8f5',
            boxShadow: '0 30px 80px rgba(38, 25, 31, 0.22)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 'auto -80px -110px auto',
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'rgba(255, 227, 207, 0.14)',
              filter: 'blur(8px)',
            }}
          />

          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.65fr) minmax(300px, 0.95fr)',
              gap: 24,
            }}
          >
            <div style={{ display: 'grid', gap: 18 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255, 248, 245, 0.12)',
                  border: '1px solid rgba(255, 248, 245, 0.16)',
                  borderRadius: 999,
                  padding: '8px 14px',
                  width: 'fit-content',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: previewMode ? '#ffd38a' : '#9ce1ba',
                    boxShadow: `0 0 0 6px ${previewMode ? 'rgba(255, 211, 138, 0.18)' : 'rgba(156, 225, 186, 0.18)'}`,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 1.1,
                    textTransform: 'uppercase',
                  }}
                >
                  {previewMode ? 'Preview owner workspace' : 'Owner operations workspace'}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <h1
                  style={{
                    margin: 0,
                    maxWidth: 760,
                    fontSize: 50,
                    lineHeight: 1.02,
                    letterSpacing: '-0.04em',
                  }}
                >
                  A cleaner command center for salon operations, traffic, and listing updates.
                </h1>
                <p
                  style={{
                    margin: 0,
                    maxWidth: 760,
                    color: 'rgba(255, 244, 240, 0.82)',
                    fontSize: 17,
                    lineHeight: 1.75,
                  }}
                >
                  Track bookings, review recent customer activity, and keep your salon profile sharp
                  without bouncing between separate tools.
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {workspaceAnchors.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    style={{
                      textDecoration: 'none',
                      borderRadius: 999,
                      padding: '10px 14px',
                      background: 'rgba(255, 248, 245, 0.12)',
                      border: '1px solid rgba(255, 248, 245, 0.16)',
                      color: '#fff8f5',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {item.label}
                  </a>
                ))}
                <a
                  href="/auth?mode=register"
                  style={{
                    textDecoration: 'none',
                    borderRadius: 999,
                    padding: '10px 14px',
                    background: '#f7d9a5',
                    border: '1px solid rgba(247, 217, 165, 0.5)',
                    color: '#5c4010',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  Register business
                </a>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {ribbons.map((item) => (
                  <span
                    key={item}
                    style={{
                      borderRadius: 999,
                      padding: '9px 13px',
                      background: 'rgba(255, 248, 245, 0.08)',
                      border: '1px solid rgba(255, 248, 245, 0.12)',
                      color: 'rgba(255, 248, 245, 0.9)',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <aside
              style={{
                background: 'rgba(255, 252, 250, 0.1)',
                border: '1px solid rgba(255, 248, 245, 0.14)',
                borderRadius: 28,
                padding: 22,
                backdropFilter: 'blur(14px)',
                display: 'grid',
                gap: 18,
                alignContent: 'start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 14,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'grid', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                      color: 'rgba(255, 244, 240, 0.75)',
                    }}
                  >
                    Portfolio snapshot
                  </span>
                  <strong style={{ fontSize: 24, lineHeight: 1.15 }}>
                    {primaryBusiness?.name ?? 'No salon yet'}
                  </strong>
                  <span style={{ color: 'rgba(255, 244, 240, 0.76)' }}>
                    {primaryBusiness
                      ? `${primaryBusiness.city}, ${primaryBusiness.state}`
                      : 'Connect your first business to start using the workspace'}
                  </span>
                </div>
                <OwnerSessionControls ownerName={ownerUser.name} />
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                }}
              >
                {[
                  {
                    icon: 'listings' as OwnerMotionIconName,
                    label: 'Live salons',
                    value: String(approvedBusinesses.length),
                  },
                  {
                    icon: 'traffic' as OwnerMotionIconName,
                    label: 'Featured',
                    value: String(featuredBusinesses.length),
                  },
                  {
                    icon: 'services' as OwnerMotionIconName,
                    label: 'Active services',
                    value: String(totalActiveServices),
                  },
                  {
                    icon: 'team' as OwnerMotionIconName,
                    label: 'Team members',
                    value: String(totalActiveStaff),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      background: 'rgba(255, 248, 245, 0.08)',
                      border: '1px solid rgba(255, 248, 245, 0.12)',
                      borderRadius: 20,
                      padding: 16,
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ color: 'rgba(255, 244, 240, 0.7)', fontSize: 12, fontWeight: 700 }}>
                        {item.label}
                      </div>
                      <OwnerMotionIcon name={item.icon} size={34} />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  background: 'rgba(255, 248, 245, 0.08)',
                  border: '1px solid rgba(255, 248, 245, 0.12)',
                  borderRadius: 20,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: 'rgba(255, 244, 240, 0.7)', fontWeight: 700 }}>
                    Listing health
                  </span>
                  {primaryBusiness ? (
                    <span
                      style={{
                        borderRadius: 999,
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 800,
                        ...businessStatusStyles[primaryBusiness.status],
                      }}
                    >
                      {businessStatusLabels[primaryBusiness.status]}
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(255, 244, 240, 0.84)' }}>
                  {ownerNote}
                </div>
                <div style={{ display: 'grid', gap: 6, color: 'rgba(255, 244, 240, 0.72)', fontSize: 13 }}>
                  <div>Top premium service: {topService}</div>
                  <div>Latest audience activity: {formatDateTime(latestAudienceActivity)}</div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {pendingReviewCount > 0 ? (
          <section
            style={{
              ...shellCardStyle,
              padding: 18,
              background: 'linear-gradient(135deg, #fff8e6, #fff1cb)',
              borderColor: 'rgba(169, 120, 32, 0.18)',
              color: '#7a571f',
              lineHeight: 1.7,
              fontWeight: 700,
            }}
          >
            {pendingReviewCount} business {pendingReviewCount === 1 ? 'is' : 'are'} waiting for
            admin review. You can keep editing services, pricing, media, and promotions while the
            listing is pending.
          </section>
        ) : null}

        <section
          id="overview"
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          }}
        >
          {metrics.map((metric) => (
            <article
              key={metric.label}
              style={{
                ...shellCardStyle,
                padding: 22,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    width: 'fit-content',
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: '#f8efee',
                    color: '#8c5665',
                    fontWeight: 800,
                    fontSize: 12,
                    letterSpacing: 0.4,
                  }}
                >
                  {metric.label}
                </div>
                <OwnerMotionIcon name={metric.icon} size={38} />
              </div>
              <div style={{ color: '#24171b', fontSize: 38, fontWeight: 800, lineHeight: 1 }}>
                {metric.value}
              </div>
              <div style={{ color: '#7b646c', fontSize: 14, lineHeight: 1.65 }}>{metric.detail}</div>
            </article>
          ))}
        </section>

        <section
          id="operations"
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.95fr)',
          }}
        >
          <article
            style={{
              ...shellCardStyle,
              padding: 24,
              display: 'grid',
              gap: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <OwnerMotionIcon name="bookings" size={52} />
                <div>
                <p style={sectionEyebrowStyle}>Operations</p>
                <h2 style={sectionTitleStyle}>Upcoming appointments</h2>
                </div>
              </div>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: '#f7eee8',
                  color: '#7d5c56',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {approvedBusinesses.length} approved salons live
              </div>
            </div>

            {appointments.length > 0 ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    style={{
                      borderRadius: 22,
                      padding: 18,
                      background: 'linear-gradient(135deg, #fcf6f3, #fffdfb)',
                      border: '1px solid rgba(113, 70, 90, 0.12)',
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong style={{ fontSize: 18, color: '#24171b' }}>{appointment.client}</strong>
                        <span style={{ color: '#6f5961' }}>{appointment.service}</span>
                      </div>
                      <span
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          background: '#f8efee',
                          color: '#8c5665',
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      >
                        {appointment.status}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        color: '#5f4d55',
                        fontWeight: 700,
                      }}
                    >
                      <span>{appointment.dayLabel}</span>
                      <span>{appointment.timeRange}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: '#fbf7f4',
                  border: '1px dashed rgba(113, 70, 90, 0.2)',
                  color: '#6f5961',
                  lineHeight: 1.7,
                }}
              >
                No upcoming bookings yet. As soon as customers confirm appointments, they will
                appear here with date, time, and service details.
              </div>
            )}
          </article>

          <div style={{ display: 'grid', gap: 20 }}>
            <article
              style={{
                ...shellCardStyle,
                padding: 24,
                display: 'grid',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <OwnerMotionIcon name="inbox" size={50} />
                <div>
                <p style={sectionEyebrowStyle}>Inbox</p>
                <h2 style={{ ...sectionTitleStyle, fontSize: 26 }}>Recent notices</h2>
                </div>
              </div>

              {recentNotifications.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      style={{
                        borderRadius: 18,
                        padding: 16,
                        background: notification.read ? '#fcf7f5' : '#f7eee8',
                        border: '1px solid rgba(113, 70, 90, 0.1)',
                        display: 'grid',
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <strong style={{ color: '#24171b' }}>{notification.title}</strong>
                        <span style={{ color: '#7b646c', fontSize: 12, fontWeight: 700 }}>
                          {formatDateTime(notification.createdAt)}
                        </span>
                      </div>
                      <div style={{ color: '#6f5961', lineHeight: 1.65 }}>
                        {notification.body ?? 'No message body provided.'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    background: '#fbf7f4',
                    border: '1px dashed rgba(113, 70, 90, 0.2)',
                    color: '#6f5961',
                    lineHeight: 1.7,
                  }}
                >
                  No new owner notifications right now. Booking messages and moderation updates
                  will appear here.
                </div>
              )}
            </article>

            <article
              style={{
                ...shellCardStyle,
                padding: 24,
                display: 'grid',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <OwnerMotionIcon name="listings" size={50} />
                <div>
                <p style={sectionEyebrowStyle}>Listings</p>
                <h2 style={{ ...sectionTitleStyle, fontSize: 26 }}>Portfolio status</h2>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {ownerBusinesses.length > 0 ? (
                  ownerBusinesses.map((business) => (
                    <div
                      key={business.id}
                      style={{
                        borderRadius: 20,
                        padding: 16,
                        border: '1px solid rgba(113, 70, 90, 0.1)',
                        background: '#fffcfb',
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'grid', gap: 4 }}>
                          <strong style={{ color: '#24171b', fontSize: 17 }}>{business.name}</strong>
                          <span style={{ color: '#7b646c' }}>
                            {business.city}, {business.state}
                          </span>
                        </div>
                        <span
                          style={{
                            borderRadius: 999,
                            padding: '7px 10px',
                            fontSize: 12,
                            fontWeight: 800,
                            ...businessStatusStyles[business.status],
                          }}
                        >
                          {businessStatusLabels[business.status]}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gap: 8,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          color: '#5f4d55',
                        }}
                      >
                        <div>{business.services.filter((service) => service.isActive).length} active services</div>
                        <div>{business.staff.filter((member) => member.isActive).length} active staff</div>
                        <div>{business.reviewCount} reviews</div>
                        <div>{business.rating.toFixed(1)} average rating</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      borderRadius: 18,
                      padding: 16,
                      background: '#fbf7f4',
                      border: '1px dashed rgba(113, 70, 90, 0.2)',
                      color: '#6f5961',
                      lineHeight: 1.7,
                    }}
                  >
                    Your owner account does not have any linked business profiles yet.
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>

        <section
          id="audience"
          style={{
            ...shellCardStyle,
            padding: 24,
            display: 'grid',
            gap: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <OwnerMotionIcon name="audience" size={54} />
              <div>
              <p style={sectionEyebrowStyle}>Audience intelligence</p>
              <h2 style={sectionTitleStyle}>Customers viewing your salon pages</h2>
              <p style={{ ...mutedTextStyle, margin: '10px 0 0', maxWidth: 760 }}>
                See how many unique customers reached your page, how long they stayed, and which
                business profiles are drawing attention right now.
              </p>
              </div>
            </div>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                background: '#f7eee8',
                color: '#7d5c56',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Updated {formatDateTime(ownerAudience.generatedAt)}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 14,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            {[
              {
                icon: 'audience' as OwnerMotionIconName,
                label: 'Unique customers',
                value: String(ownerAudience.totalUniqueViewers),
                detail: 'Distinct viewers across all your salon pages',
              },
              {
                icon: 'traffic' as OwnerMotionIconName,
                label: 'Total page views',
                value: String(ownerAudience.totalPageViews),
                detail: 'Overall visits recorded by the browsing tracker',
              },
              {
                icon: 'listings' as OwnerMotionIconName,
                label: 'Businesses with traffic',
                value: String(ownerAudience.businessesWithViews),
                detail: 'Listings with at least one tracked visit',
              },
              {
                icon: 'review' as OwnerMotionIconName,
                label: 'Latest audience activity',
                value: formatDateTime(latestAudienceActivity),
                detail: 'Most recent detected page-view event',
              },
            ].map((item) => (
              <article
                key={item.label}
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: '#fffcfb',
                  border: '1px solid rgba(113, 70, 90, 0.1)',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div style={{ color: '#8b6270', fontWeight: 700, fontSize: 13 }}>{item.label}</div>
                  <OwnerMotionIcon name={item.icon} size={36} />
                </div>
                <div style={{ color: '#24171b', fontWeight: 800, fontSize: 28, lineHeight: 1.2 }}>
                  {item.value}
                </div>
                <div style={{ color: '#6f5961', lineHeight: 1.65 }}>{item.detail}</div>
              </article>
            ))}
          </div>

          {ownerAudience.businesses.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {ownerAudience.businesses.map((business) => (
                <article
                  key={business.businessId}
                  style={{
                    borderRadius: 22,
                    padding: 18,
                    background: '#ffffff',
                    border: '1px solid rgba(113, 70, 90, 0.1)',
                    display: 'grid',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 4 }}>
                      <strong style={{ color: '#24171b', fontSize: 20 }}>{business.businessName}</strong>
                      <span style={{ color: '#7b646c' }}>
                        Last viewed {formatDateTime(business.lastViewedAt)}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 999,
                        background: '#f8efee',
                        color: '#8c5665',
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      {business.totalPageViews} visits
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: 12,
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    }}
                  >
                    <div style={{ color: '#5f4d55' }}>Unique customers: {business.uniqueViewers}</div>
                    <div style={{ color: '#5f4d55' }}>Total page views: {business.totalPageViews}</div>
                    <div style={{ color: '#5f4d55' }}>
                      Average dwell: {business.averageDwellSeconds}s
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div
              style={{
                borderRadius: 22,
                padding: 18,
                background: '#fbf7f4',
                border: '1px dashed rgba(113, 70, 90, 0.2)',
                color: '#6f5961',
                lineHeight: 1.7,
              }}
            >
              No tracked customer views yet. Once customers open your salon page and spend time on
              it, this report will start filling in automatically.
            </div>
          )}
        </section>

        <section
          id="business-workspace"
          style={{
            display: 'grid',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <OwnerMotionIcon name="listings" size={54} />
            <div style={{ display: 'grid', gap: 8 }}>
            <p style={sectionEyebrowStyle}>Business workspace</p>
            <h2 style={sectionTitleStyle}>Salon owner business settings</h2>
            <p style={{ ...mutedTextStyle, margin: 0, maxWidth: 780 }}>
              Keep the salon profile, services, media library, and promotions up to date without
              mixing them into private technician management.
            </p>
            </div>
          </div>

          <OwnerBusinessWorkspace
            initialBusinesses={ownerBusinesses}
            authToken={activeOwnerToken}
            previewMode={previewMode}
          />
        </section>

        <section
          id="technician-desk"
          style={{
            display: 'grid',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <OwnerMotionIcon name="team" size={54} />
            <div style={{ display: 'grid', gap: 8 }}>
              <p style={sectionEyebrowStyle}>Technician desk</p>
              <h2 style={sectionTitleStyle}>Private technician roster</h2>
              <p style={{ ...mutedTextStyle, margin: 0, maxWidth: 780 }}>
                Manage technicians separately from salon owner profile settings so identity,
                availability, and internal team records stay in their own workspace.
              </p>
            </div>
          </div>

          <OwnerTechnicianDesk
            initialBusinesses={ownerBusinesses}
            authToken={activeOwnerToken}
            previewMode={previewMode}
          />
        </section>
      </div>
    </main>
  );
}
