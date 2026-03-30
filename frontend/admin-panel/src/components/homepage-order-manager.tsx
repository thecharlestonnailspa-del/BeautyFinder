'use client';

import { useState } from 'react';
import type { BusinessSummary } from '@beauty-finder/types';
import { getAdminHeaders, getApiBaseUrl } from '../lib/admin-api';

function sortBusinesses(list: BusinessSummary[]) {
  return [...list].sort((left, right) => {
    if (left.featuredOnHomepage !== right.featuredOnHomepage) {
      return left.featuredOnHomepage ? -1 : 1;
    }

    if (left.homepageRank !== right.homepageRank) {
      return left.homepageRank - right.homepageRank;
    }

    return left.name.localeCompare(right.name);
  });
}

export function HomepageOrderManager({
  initialBusinesses,
}: {
  initialBusinesses: BusinessSummary[];
}) {
  const [businesses, setBusinesses] = useState(() => sortBusinesses(initialBusinesses));
  const [rankDrafts, setRankDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialBusinesses.map((business) => [business.id, String(business.homepageRank)])),
  );
  const [statusMessage, setStatusMessage] = useState(
    'Changes here affect the customer home page order. Featured slots auto-renumber when you save.',
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  async function saveBusiness(business: BusinessSummary, featuredOnHomepage: boolean) {
    const nextRank = Math.max(1, Number(rankDrafts[business.id] ?? business.homepageRank) || 1);
    setSavingId(business.id);
    setStatusMessage(`Saving homepage order for ${business.name}...`);

    try {
      const response = await fetch(`${getApiBaseUrl()}/admin/businesses/${business.id}/homepage`, {
        method: 'PATCH',
        headers: getAdminHeaders(true),
        body: JSON.stringify({
          featuredOnHomepage,
          homepageRank: nextRank,
        }),
      });

      if (!response.ok) {
        setStatusMessage(`Could not save ${business.name}.`);
        return;
      }

      const updatedBusiness = (await response.json()) as BusinessSummary;
      const refreshResponse = await fetch(`${getApiBaseUrl()}/admin/homepage-businesses`, {
        headers: getAdminHeaders(),
        cache: 'no-store',
      });

      if (refreshResponse.ok) {
        const refreshedBusinesses = sortBusinesses((await refreshResponse.json()) as BusinessSummary[]);
        setBusinesses(refreshedBusinesses);
        setRankDrafts(
          Object.fromEntries(
            refreshedBusinesses.map((item) => [item.id, String(item.homepageRank)]),
          ),
        );
      } else {
        setBusinesses((current) =>
          sortBusinesses(
            current.map((item) => (item.id === updatedBusiness.id ? updatedBusiness : item)),
          ),
        );
        setRankDrafts((current) => ({
          ...current,
          [updatedBusiness.id]: String(updatedBusiness.homepageRank),
        }));
      }

      setStatusMessage(
        updatedBusiness.featuredOnHomepage
          ? `${updatedBusiness.name} is now set to homepage slot #${updatedBusiness.homepageRank}.`
          : `${updatedBusiness.name} was removed from the homepage spotlight.`,
      );
    } catch {
      setStatusMessage(`Network error while saving ${business.name}.`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section
      style={{
        background: '#fffafc',
        borderRadius: 30,
        padding: 24,
        border: '1px solid #f0c8d6',
        display: 'grid',
        gap: 16,
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
          Homepage Order
        </p>
        <h2 style={{ margin: 0, color: '#341b36', fontSize: 28 }}>
          Control which businesses show first
        </h2>
        <p style={{ margin: 0, color: '#6d5060', lineHeight: 1.7 }}>
          Featured businesses appear first on the customer home page, sorted by homepage slot.
          Saving a slot inserts that business into position and re-numbers the rest automatically.
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
          {statusMessage}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 12,
        }}
      >
        {businesses.map((business) => (
          <article
            key={business.id}
            style={{
              display: 'grid',
              gap: 12,
              background: business.featuredOnHomepage
                ? 'linear-gradient(135deg, #fff6fa, #ffe4ee)'
                : '#ffffff',
              borderRadius: 24,
              padding: 18,
              border: `1px solid ${business.featuredOnHomepage ? '#f4cede' : '#f0cad8'}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ color: '#341b36', fontSize: 20, fontWeight: 800 }}>{business.name}</div>
                <div style={{ color: '#8e657b', fontSize: 13, fontWeight: 700 }}>
                  {business.city}, {business.state} · {business.category}
                </div>
              </div>

              <div
                style={{
                  background: business.featuredOnHomepage ? '#fff0c9' : '#fff4f8',
                  color: business.featuredOnHomepage ? '#8b5b24' : '#8e657b',
                  borderRadius: 999,
                  padding: '10px 14px',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {business.featuredOnHomepage
                  ? `Homepage slot #${business.homepageRank}`
                  : 'Hidden from homepage spotlight'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <label
                style={{
                  display: 'grid',
                  gap: 6,
                  color: '#6d5060',
                  fontWeight: 700,
                }}
              >
                Homepage slot
                <input
                  type="number"
                  min={1}
                  value={rankDrafts[business.id] ?? String(business.homepageRank)}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setRankDrafts((current) => ({
                      ...current,
                      [business.id]: nextValue,
                    }));
                  }}
                  style={{
                    width: 110,
                    borderRadius: 14,
                    border: '1px solid #f0cad8',
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  void saveBusiness(business, true);
                }}
                disabled={savingId === business.id}
                style={{
                  border: 'none',
                  background: '#ff6f9f',
                  color: '#fff9fb',
                  borderRadius: 999,
                  padding: '12px 16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {savingId === business.id ? 'Saving...' : 'Show on homepage'}
              </button>

              <button
                type="button"
                onClick={() => {
                  void saveBusiness(business, false);
                }}
                disabled={savingId === business.id}
                style={{
                  border: '1px solid #f0cad8',
                  background: '#ffffff',
                  color: '#6d5060',
                  borderRadius: 999,
                  padding: '12px 16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Remove from homepage
              </button>
            </div>
          </article>
        ))}
      </div>

      <div
        style={{
          background: '#fff0c9',
          color: '#8b5b24',
          borderRadius: 22,
          padding: 18,
          fontWeight: 700,
          lineHeight: 1.7,
        }}
      >
        Active homepage lineup:{' '}
        {businesses.some((business) => business.featuredOnHomepage)
          ? businesses
              .filter((business) => business.featuredOnHomepage)
              .map((business) => `${business.homepageRank}. ${business.name}`)
              .join(' · ')
          : 'No businesses are featured yet.'}
      </div>
    </section>
  );
}
