import type {
  AdminActionRecord,
  AdminBusinessQueueItem,
  AdminConversationCase,
  AdminOverview,
  AdminReviewQueueItem,
  AdPricingRecord,
  BusinessSummary,
  CustomerPreferenceReportRecord,
} from '@beauty-finder/types';
import { AccountAccessManager } from '../components/account-access-manager';
import { AdPricingManager } from '../components/ad-pricing-manager';
import { AuditLogPanel } from '../components/audit-log-panel';
import { BusinessModerationBoard } from '../components/business-moderation-board';
import { ConversationMonitorBoard } from '../components/conversation-monitor-board';
import { CustomerInsightReport } from '../components/customer-insight-report';
import { HomepageOrderManager } from '../components/homepage-order-manager';
import { ReviewModerationBoard } from '../components/review-moderation-board';
import { fetchAdminJson } from '../lib/admin-api';

const quickLinks = [
  { label: 'Account access', href: '#account-access' },
  { label: 'Customer insights', href: '#customer-insights' },
  { label: 'Ad pricing', href: '#ad-pricing' },
  { label: 'Homepage order', href: '#homepage-order' },
  { label: 'Business queue', href: '#business-queue' },
  { label: 'Review queue', href: '#review-queue' },
  { label: 'Care escalations', href: '#care-escalations' },
  { label: 'Audit log', href: '#audit-log' },
];

const fallbackOverview: AdminOverview = {
  users: 8,
  businesses: 6,
  activeBookings: 1,
  openConversations: 2,
  pendingReviews: 3,
};

const fallbackHomepageBusinesses: BusinessSummary[] = [
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
    heroImage: '',
    description: 'Blowouts, silk press styling, and polished trims close to your side of town.',
    services: [
      { id: 'svc-7', name: 'Silk Press + Trim', durationMinutes: 80, price: 98 },
      { id: 'svc-8', name: 'Express Blowout', durationMinutes: 45, price: 52 },
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
    heroImage: '',
    description: 'Soft gel sets, glossy pedicures, and quick polish refreshes near West Ashley.',
    services: [
      { id: 'svc-5', name: 'Soft Gel Overlay', durationMinutes: 60, price: 62 },
      { id: 'svc-6', name: 'Pedicure + Gloss', durationMinutes: 75, price: 68 },
    ],
  },
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
    heroImage: '',
    description: 'Gel, acrylic, and minimalist nail art for busy city clients.',
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
    heroImage: '',
    description: 'Color, silk press, and precision cuts with online booking.',
    services: [
      { id: 'svc-3', name: 'Silk Press', durationMinutes: 75, price: 95 },
      { id: 'svc-4', name: 'Haircut + Blowout', durationMinutes: 60, price: 70 },
    ],
  },
];

const fallbackBusinessQueue: AdminBusinessQueueItem[] = [
  {
    id: 'biz-5',
    ownerId: 'user-owner-5',
    ownerName: 'Selena Park',
    ownerEmail: 'selena@lunalashatelier.app',
    category: 'hair',
    name: 'Luna Lash Atelier',
    status: 'pending_review',
    featuredOnHomepage: false,
    homepageRank: 999,
    city: 'Charleston',
    state: 'SC',
    createdAt: '2026-03-21T15:00:00.000Z',
  },
  {
    id: 'biz-4',
    ownerId: 'user-owner-4',
    ownerName: 'Jade Brooks',
    ownerEmail: 'jade@ashleyriverblowout.app',
    category: 'hair',
    name: 'Ashley River Blowout Club',
    status: 'approved',
    featuredOnHomepage: true,
    homepageRank: 1,
    city: 'Charleston',
    state: 'SC',
    createdAt: '2026-03-20T15:00:00.000Z',
  },
  {
    id: 'biz-3',
    ownerId: 'user-owner-3',
    ownerName: 'Mia Carter',
    ownerEmail: 'mia@lowcountryglossbar.app',
    category: 'nail',
    name: 'Lowcountry Gloss Bar',
    status: 'approved',
    featuredOnHomepage: true,
    homepageRank: 2,
    city: 'Charleston',
    state: 'SC',
    createdAt: '2026-03-20T14:00:00.000Z',
  },
  {
    id: 'biz-1',
    ownerId: 'user-owner-1',
    ownerName: 'Lina Nguyen',
    ownerEmail: 'lina@polishedstudio.app',
    category: 'nail',
    name: 'Polished Studio',
    status: 'approved',
    featuredOnHomepage: true,
    homepageRank: 3,
    city: 'New York',
    state: 'NY',
    createdAt: '2026-03-20T13:00:00.000Z',
  },
  {
    id: 'biz-2',
    ownerId: 'user-owner-2',
    ownerName: 'Nora Bennett',
    ownerEmail: 'nora@northstrandhair.app',
    category: 'hair',
    name: 'North Strand Hair',
    status: 'approved',
    featuredOnHomepage: false,
    homepageRank: 999,
    city: 'Brooklyn',
    state: 'NY',
    createdAt: '2026-03-20T12:00:00.000Z',
  },
  {
    id: 'biz-6',
    ownerId: 'user-owner-6',
    ownerName: 'Tessa Quinn',
    ownerEmail: 'tessa@velvettintstudio.app',
    category: 'hair',
    name: 'Velvet Tint Studio',
    status: 'suspended',
    featuredOnHomepage: false,
    homepageRank: 999,
    city: 'Brooklyn',
    state: 'NY',
    createdAt: '2026-03-19T12:00:00.000Z',
  },
];

const fallbackReviewQueue: AdminReviewQueueItem[] = [
  {
    id: 'review-2',
    businessId: 'biz-1',
    businessName: 'Polished Studio',
    customerId: 'user-customer-1',
    customerName: 'Ava Tran',
    rating: 4,
    comment: 'Needs moderation review.',
    status: 'flagged',
    createdAt: '2026-03-22T11:00:00.000Z',
  },
  {
    id: 'review-3',
    businessId: 'biz-2',
    businessName: 'North Strand Hair',
    customerId: 'user-customer-1',
    customerName: 'Ava Tran',
    rating: 3,
    comment: 'Possible duplicate review.',
    status: 'flagged',
    createdAt: '2026-03-22T12:00:00.000Z',
  },
  {
    id: 'review-4',
    businessId: 'biz-2',
    businessName: 'North Strand Hair',
    customerId: 'user-customer-1',
    customerName: 'Ava Tran',
    rating: 2,
    comment: 'Escalated for policy check.',
    status: 'flagged',
    createdAt: '2026-03-23T09:00:00.000Z',
  },
];

const fallbackConversationCases: AdminConversationCase[] = [
  {
    id: 'conv-2',
    businessId: 'biz-2',
    businessName: 'North Strand Hair',
    participantNames: ['Ava Tran', 'Nora Bennett'],
    lastMessage: 'I need help with a refund after two reschedules.',
    lastMessageAt: '2026-03-24T16:18:00.000Z',
    messageCount: 2,
    priority: 'high',
    caseStatus: 'watched',
  },
  {
    id: 'conv-1',
    businessId: 'biz-1',
    businessName: 'Polished Studio',
    bookingId: 'booking-1',
    participantNames: ['Ava Tran', 'Lina Nguyen'],
    lastMessage: 'Perfect, thank you.',
    lastMessageAt: '2026-03-20T14:35:00.000Z',
    messageCount: 2,
    priority: 'high',
    caseStatus: 'open',
  },
];

const fallbackAuditActions: AdminActionRecord[] = [
  {
    id: 'admin-action-3',
    adminUserId: 'user-admin-1',
    adminName: 'Mason Lee',
    targetType: 'conversation',
    targetId: 'conv-2',
    action: 'watch_conversation',
    metadata: '{"note":"Refund language detected in customer message."}',
    createdAt: '2026-03-24T16:20:00.000Z',
  },
  {
    id: 'admin-action-2',
    adminUserId: 'user-admin-1',
    adminName: 'Mason Lee',
    targetType: 'review',
    targetId: 'review-2',
    action: 'flag_review',
    metadata: '{"note":"Kept in moderation queue for manual review."}',
    createdAt: '2026-03-22T11:15:00.000Z',
  },
  {
    id: 'admin-action-1',
    adminUserId: 'user-admin-1',
    adminName: 'Mason Lee',
    targetType: 'business',
    targetId: 'biz-4',
    action: 'approved_business',
    metadata: '{"note":"Launch checklist verified."}',
    createdAt: '2026-03-20T13:00:00.000Z',
  },
];

const fallbackAdPricing: AdPricingRecord[] = [
  {
    placement: 'homepage_spotlight',
    label: 'Homepage spotlight',
    dailyPrice: 120,
    monthlyPrice: 3000,
    currency: 'USD',
    note: 'Highest-visibility inventory on the platform.',
    updatedAt: '2026-03-30T00:00:00.000Z',
  },
  {
    placement: 'category_boost',
    label: 'Category boost',
    dailyPrice: 90,
    monthlyPrice: 2250,
    currency: 'USD',
    note: 'Useful for salons competing inside one service category.',
    updatedAt: '2026-03-30T00:00:00.000Z',
  },
  {
    placement: 'city_boost',
    label: 'City boost',
    dailyPrice: 75,
    monthlyPrice: 1900,
    currency: 'USD',
    note: 'Local discovery push for one city market.',
    updatedAt: '2026-03-30T00:00:00.000Z',
  },
];

const fallbackCustomerInsightReport: CustomerPreferenceReportRecord = {
  generatedAt: '2026-03-30T00:00:00.000Z',
  totalCustomers: 3,
  totalTrackedPageViews: 18,
  colorTrends: [
    { label: 'neutral', score: 11.2 },
    { label: 'pink', score: 8.6 },
    { label: 'pastel', score: 6.1 },
  ],
  serviceTrends: [
    { label: 'Gel Manicure', score: 9.4 },
    { label: 'Silk Press', score: 7.8 },
    { label: 'Pedicure + Gloss', score: 6.2 },
  ],
  experienceTrends: [
    { label: 'Polished natural', score: 2 },
    { label: 'Precision haircare', score: 1 },
  ],
  customers: [
    {
      customerId: 'user-customer-1',
      customerName: 'Ava Tran',
      customerEmail: 'ava@demo.app',
      favoriteColors: [{ label: 'pink', score: 4.4 }, { label: 'neutral', score: 3.8 }],
      topServices: [{ label: 'Gel Manicure', score: 6.2 }, { label: 'Pedicure + Gloss', score: 3.1 }],
      topCategories: [{ label: 'nail', score: 7.7 }],
      preferredExperience: 'Polished natural',
      averageBusinessPageDwellSeconds: 74,
      totalBusinessPageViews: 6,
      totalFavoriteBusinesses: 2,
      totalBookings: 1,
      engagementScore: 71.5,
      lastSeenAt: '2026-03-30T14:00:00.000Z',
    },
    {
      customerId: 'user-customer-2',
      customerName: 'Jordan Ellis',
      customerEmail: 'jordan@demo.app',
      favoriteColors: [{ label: 'neutral', score: 5.2 }],
      topServices: [{ label: 'Silk Press', score: 5.6 }],
      topCategories: [{ label: 'hair', score: 6.4 }],
      preferredExperience: 'Precision haircare',
      averageBusinessPageDwellSeconds: 89,
      totalBusinessPageViews: 5,
      totalFavoriteBusinesses: 1,
      totalBookings: 1,
      engagementScore: 68.2,
      lastSeenAt: '2026-03-30T13:20:00.000Z',
    },
  ],
};

function formatActionSummary(action: AdminActionRecord) {
  return `${action.action.replace(/_/g, ' ')} · ${action.targetType} ${action.targetId}`;
}

export default async function AdminPanelPage() {
  const [
    overview,
    customerInsightReport,
    adPricing,
    homepageBusinesses,
    businessQueue,
    reviewQueue,
    conversationCases,
    auditActions,
  ] = await Promise.all([
    fetchAdminJson<AdminOverview>('/admin/overview'),
    fetchAdminJson<CustomerPreferenceReportRecord>('/admin/customer-insights/report'),
    fetchAdminJson<AdPricingRecord[]>('/admin/ad-pricing'),
    fetchAdminJson<BusinessSummary[]>('/admin/homepage-businesses'),
    fetchAdminJson<AdminBusinessQueueItem[]>('/admin/businesses'),
    fetchAdminJson<AdminReviewQueueItem[]>('/admin/reviews'),
    fetchAdminJson<AdminConversationCase[]>('/admin/conversations'),
    fetchAdminJson<AdminActionRecord[]>('/admin/audit-actions'),
  ]);

  const safeOverview = overview ?? fallbackOverview;
  const safeCustomerInsightReport =
    customerInsightReport ?? fallbackCustomerInsightReport;
  const safeAdPricing = adPricing ?? fallbackAdPricing;
  const safeHomepageBusinesses = homepageBusinesses ?? fallbackHomepageBusinesses;
  const safeBusinessQueue = businessQueue ?? fallbackBusinessQueue;
  const safeReviewQueue = reviewQueue ?? fallbackReviewQueue;
  const safeConversationCases = conversationCases ?? fallbackConversationCases;
  const safeAuditActions = auditActions ?? fallbackAuditActions;

  const moderationQueues = [
    {
      label: 'Pending business approvals',
      value: safeBusinessQueue.filter((business) => business.status === 'pending_review').length,
    },
    {
      label: 'Flagged reviews',
      value: safeReviewQueue.filter((review) => review.status === 'flagged').length,
    },
    {
      label: 'Open care cases',
      value: safeConversationCases.filter((conversation) => conversation.caseStatus !== 'resolved').length,
    },
  ];

  const recentActions =
    safeAuditActions.length > 0
      ? safeAuditActions.slice(0, 3).map((action) => formatActionSummary(action))
      : [
          `Platform businesses visible: ${safeOverview.businesses}`,
          `Live booking load: ${safeOverview.activeBookings}`,
          `Open conversations to monitor: ${safeOverview.openConversations}`,
        ];

  return (
    <main
      style={{
        padding: 32,
        display: 'grid',
        gap: 24,
        maxWidth: 1180,
        margin: '0 auto',
      }}
    >
      <section
        style={{
          background:
            'radial-gradient(circle at top right, rgba(255, 241, 198, 0.95), transparent 26%), linear-gradient(135deg, #fffafc, #ffdce8)',
          color: '#3a1831',
          borderRadius: 32,
          padding: 30,
          border: '2px solid #f0bfd0',
          boxShadow: '0 24px 60px rgba(203, 88, 132, 0.15)',
          display: 'grid',
          gap: 18,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: 1.3,
              fontSize: 12,
              fontWeight: 800,
              color: '#ff4f8c',
            }}
          >
            Trust desk
          </p>
          <h1 style={{ margin: '12px 0 10px', fontSize: 44, lineHeight: 1.05 }}>
            Cute shell, serious moderation.
          </h1>
          <p
            style={{ margin: 0, maxWidth: 820, lineHeight: 1.7, color: '#6d5060', fontSize: 16 }}
          >
            The admin console now runs actual business moderation, homepage placement, flagged
            review handling, conversation monitoring, and audit tracking from live API data.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {quickLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                background: '#ff6f9f',
                color: '#fff9fb',
                padding: '10px 14px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {moderationQueues.map((item) => (
          <article
            key={item.label}
            style={{
              background: '#fffafc',
              borderRadius: 24,
              padding: 22,
              border: '1px solid #f0cad8',
            }}
          >
            <div style={{ color: '#8e657b', fontSize: 13, fontWeight: 700 }}>{item.label}</div>
            <div style={{ fontSize: 38, fontWeight: 800, marginTop: 10, color: '#d6336c' }}>
              {item.value}
            </div>
          </article>
        ))}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.85fr',
          gap: 20,
        }}
      >
        <div
          style={{
            background: '#fffafc',
            borderRadius: 30,
            padding: 24,
            border: '1px solid #f0c8d6',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p
                style={{
                  margin: 0,
                  color: '#ff4f8c',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Activity
              </p>
              <h2 style={{ margin: '8px 0 0', color: '#341b36', fontSize: 28 }}>Recent actions</h2>
            </div>
            <div
              style={{
                background: '#fff0c9',
                color: '#8b5b24',
                borderRadius: 999,
                padding: '10px 14px',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {safeOverview.users} admins & users tracked
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
            {recentActions.map((action) => (
              <div
                key={action}
                style={{
                  background: 'linear-gradient(135deg, #fff6fa, #ffe3ee)',
                  borderRadius: 22,
                  padding: 18,
                  border: '1px solid #f4cede',
                  color: '#5d4658',
                  fontWeight: 700,
                }}
              >
                {action}
              </div>
            ))}
          </div>
        </div>

        <aside
          style={{
            background: '#ffffff',
            borderRadius: 30,
            padding: 24,
            border: '1px solid #f0cad8',
            display: 'grid',
            gap: 16,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: '#ff4f8c',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Snapshot
            </p>
            <h2 style={{ margin: '8px 0 0', color: '#341b36', fontSize: 28 }}>Queue health</h2>
          </div>
          <div style={{ background: '#fff0f6', borderRadius: 22, padding: 18, color: '#694d60', lineHeight: 1.7 }}>
            There are {safeReviewQueue.filter((review) => review.status === 'flagged').length} flagged reviews waiting for moderation.
          </div>
          <div style={{ background: '#ffecc1', borderRadius: 22, padding: 18, color: '#815c1f', fontWeight: 700 }}>
            Highest urgency: keep trust coverage on{' '}
            {safeConversationCases.filter((conversation) => conversation.priority === 'high').length}{' '}
            high-priority care cases.
          </div>
        </aside>
      </section>

      <section id="account-access">
        <AccountAccessManager />
      </section>

      <section id="customer-insights">
        <CustomerInsightReport initialReport={safeCustomerInsightReport} />
      </section>

      <section id="ad-pricing">
        <AdPricingManager initialPricing={safeAdPricing} />
      </section>

      <section id="homepage-order">
        <HomepageOrderManager initialBusinesses={safeHomepageBusinesses} />
      </section>

      <section id="business-queue">
        <BusinessModerationBoard initialBusinesses={safeBusinessQueue} />
      </section>

      <section id="review-queue">
        <ReviewModerationBoard initialReviews={safeReviewQueue} />
      </section>

      <section id="care-escalations">
        <ConversationMonitorBoard initialCases={safeConversationCases} />
      </section>

      <section id="audit-log">
        <AuditLogPanel actions={safeAuditActions} />
      </section>
    </main>
  );
}
