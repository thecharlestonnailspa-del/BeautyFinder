'use client';

import { useEffect, useState } from 'react';
import type { CustomerPreferenceReportRecord } from '@beauty-finder/types';
import { fetchAdminJson } from '../lib/admin-api';

function renderTopLabels(items: Array<{ label: string }>) {
  if (items.length === 0) {
    return 'No strong signal yet';
  }

  return items.map((item) => item.label).join(', ');
}

export function CustomerInsightReport({
  initialReport,
}: {
  initialReport: CustomerPreferenceReportRecord;
}) {
  const [report, setReport] = useState(initialReport);
  const [statusText, setStatusText] = useState(
    'Refreshing live preference signals from the backend brain...',
  );

  useEffect(() => {
    let active = true;

    async function loadReport() {
      const nextReport = await fetchAdminJson<CustomerPreferenceReportRecord>(
        '/admin/customer-insights/report',
      );
      if (!active) {
        return;
      }
      if (!nextReport) {
        setStatusText('Showing fallback insight data because the live admin API was unavailable.');
        return;
      }
      setReport(nextReport);
      setStatusText('Live preference report loaded from customer behavior signals.');
    }

    void loadReport();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      style={{
        background: '#fffafc',
        borderRadius: 30,
        padding: 24,
        border: '1px solid #f0c8d6',
        display: 'grid',
        gap: 18,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
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
          Customer brain
        </p>
        <h2 style={{ margin: 0, color: '#341b36', fontSize: 28 }}>
          Preference report from browse time, favorites, and bookings
        </h2>
        <p style={{ margin: 0, color: '#6d5060', lineHeight: 1.7 }}>
          The backend now scores customer color taste, service interest, and preferred experience
          from salon page dwell time, favorite history, and appointment behavior.
        </p>
        <div
          style={{
            background: '#fff0f6',
            color: '#6d5060',
            borderRadius: 18,
            padding: '12px 14px',
            fontWeight: 700,
          }}
        >
          {statusText}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        <article style={{ background: '#ffffff', borderRadius: 22, padding: 18, border: '1px solid #f0cad8' }}>
          <div style={{ color: '#8e657b', fontWeight: 700, fontSize: 13 }}>Tracked customers</div>
          <div style={{ color: '#d6336c', fontWeight: 800, fontSize: 34, marginTop: 8 }}>
            {report.totalCustomers}
          </div>
        </article>
        <article style={{ background: '#ffffff', borderRadius: 22, padding: 18, border: '1px solid #f0cad8' }}>
          <div style={{ color: '#8e657b', fontWeight: 700, fontSize: 13 }}>Tracked page views</div>
          <div style={{ color: '#d6336c', fontWeight: 800, fontSize: 34, marginTop: 8 }}>
            {report.totalTrackedPageViews}
          </div>
        </article>
        <article style={{ background: '#ffffff', borderRadius: 22, padding: 18, border: '1px solid #f0cad8' }}>
          <div style={{ color: '#8e657b', fontWeight: 700, fontSize: 13 }}>Top color trend</div>
          <div style={{ color: '#341b36', fontWeight: 800, fontSize: 20, marginTop: 8 }}>
            {report.colorTrends[0]?.label ?? 'No signal yet'}
          </div>
        </article>
        <article style={{ background: '#ffffff', borderRadius: 22, padding: 18, border: '1px solid #f0cad8' }}>
          <div style={{ color: '#8e657b', fontWeight: 700, fontSize: 13 }}>Top experience trend</div>
          <div style={{ color: '#341b36', fontWeight: 800, fontSize: 20, marginTop: 8 }}>
            {report.experienceTrends[0]?.label ?? 'No signal yet'}
          </div>
        </article>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        <article style={{ background: '#fff0f6', borderRadius: 22, padding: 18 }}>
          <div style={{ color: '#341b36', fontWeight: 800, fontSize: 18 }}>Color trends</div>
          <div style={{ color: '#6d5060', lineHeight: 1.8, marginTop: 8 }}>
            {report.colorTrends.map((item) => `${item.label} (${item.score})`).join(' · ') || 'No signal yet'}
          </div>
        </article>
        <article style={{ background: '#fff0f6', borderRadius: 22, padding: 18 }}>
          <div style={{ color: '#341b36', fontWeight: 800, fontSize: 18 }}>Service trends</div>
          <div style={{ color: '#6d5060', lineHeight: 1.8, marginTop: 8 }}>
            {report.serviceTrends.map((item) => `${item.label} (${item.score})`).join(' · ') || 'No signal yet'}
          </div>
        </article>
        <article style={{ background: '#fff0f6', borderRadius: 22, padding: 18 }}>
          <div style={{ color: '#341b36', fontWeight: 800, fontSize: 18 }}>Experience trends</div>
          <div style={{ color: '#6d5060', lineHeight: 1.8, marginTop: 8 }}>
            {report.experienceTrends.map((item) => `${item.label} (${item.score})`).join(' · ') || 'No signal yet'}
          </div>
        </article>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {report.customers.map((customer) => (
          <article
            key={customer.customerId}
            style={{
              background: '#ffffff',
              borderRadius: 24,
              padding: 18,
              border: '1px solid #f0cad8',
              display: 'grid',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ color: '#341b36', fontSize: 20, fontWeight: 800 }}>
                  {customer.customerName}
                </div>
                <div style={{ color: '#6d5060' }}>{customer.customerEmail}</div>
              </div>
              <div
                style={{
                  background: '#fff0c9',
                  color: '#8b5b24',
                  borderRadius: 999,
                  padding: '8px 12px',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                Engagement {customer.engagementScore}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <div>
                <div style={{ color: '#8e657b', fontWeight: 700, fontSize: 13 }}>Favorite colors</div>
                <div style={{ color: '#341b36', marginTop: 6 }}>
                  {renderTopLabels(customer.favoriteColors)}
                </div>
              </div>
              <div>
                <div style={{ color: '#8e657b', fontWeight: 700, fontSize: 13 }}>Top services</div>
                <div style={{ color: '#341b36', marginTop: 6 }}>
                  {renderTopLabels(customer.topServices)}
                </div>
              </div>
              <div>
                <div style={{ color: '#8e657b', fontWeight: 700, fontSize: 13 }}>Top categories</div>
                <div style={{ color: '#341b36', marginTop: 6 }}>
                  {renderTopLabels(customer.topCategories)}
                </div>
              </div>
              <div>
                <div style={{ color: '#8e657b', fontWeight: 700, fontSize: 13 }}>Preferred experience</div>
                <div style={{ color: '#341b36', marginTop: 6 }}>{customer.preferredExperience}</div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 10,
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                color: '#6d5060',
              }}
            >
              <div>Avg dwell: {customer.averageBusinessPageDwellSeconds}s</div>
              <div>Page views: {customer.totalBusinessPageViews}</div>
              <div>Favorites: {customer.totalFavoriteBusinesses}</div>
              <div>Bookings: {customer.totalBookings}</div>
              <div>Last seen: {customer.lastSeenAt ? new Date(customer.lastSeenAt).toLocaleString() : 'Unknown'}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
