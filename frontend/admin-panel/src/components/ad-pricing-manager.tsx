'use client';

import { useState } from 'react';
import type { AdPlacement, AdPricingRecord } from '@beauty-finder/types';
import { getAdminHeaders, getApiBaseUrl } from '../lib/admin-api';

const placementDescriptions: Record<AdPlacement, string> = {
  homepage_spotlight: 'Prime homepage inventory for the most visible salon placements.',
  category_boost: 'Extra ranking weight inside category browsing and discovery pages.',
  city_boost: 'Local market lift for salons targeting one city at a time.',
};

export function AdPricingManager({
  initialPricing,
}: {
  initialPricing: AdPricingRecord[];
}) {
  const [pricing, setPricing] = useState(initialPricing);
  const [drafts, setDrafts] = useState<Record<string, { dailyPrice: string; monthlyPrice: string; note: string }>>(
    () =>
      Object.fromEntries(
        initialPricing.map((entry) => [
          entry.placement,
          {
            dailyPrice: String(entry.dailyPrice),
            monthlyPrice: String(entry.monthlyPrice),
            note: entry.note ?? '',
          },
        ]),
      ),
  );
  const [savingPlacement, setSavingPlacement] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Control platform ad pricing here. Changes apply per placement, with separate day and month rates.',
  );

  async function savePricing(placement: AdPlacement) {
    const draft = drafts[placement];
    const dailyPrice = Number(draft?.dailyPrice);
    const monthlyPrice = Number(draft?.monthlyPrice);

    if (!Number.isFinite(dailyPrice) || dailyPrice < 0 || !Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
      setStatusMessage('Enter valid day and month prices before saving.');
      return;
    }

    setSavingPlacement(placement);
    setStatusMessage(`Saving ${placement.replace(/_/g, ' ')} pricing...`);

    try {
      const response = await fetch(`${getApiBaseUrl()}/admin/ad-pricing/${placement}`, {
        method: 'PATCH',
        headers: getAdminHeaders(true),
        body: JSON.stringify({
          dailyPrice,
          monthlyPrice,
          note: draft.note || undefined,
        }),
      });

      if (!response.ok) {
        setStatusMessage(`Could not save pricing for ${placement.replace(/_/g, ' ')}.`);
        return;
      }

      const updated = (await response.json()) as AdPricingRecord;
      setPricing((current) =>
        current.map((entry) => (entry.placement === updated.placement ? updated : entry)),
      );
      setDrafts((current) => ({
        ...current,
        [updated.placement]: {
          dailyPrice: String(updated.dailyPrice),
          monthlyPrice: String(updated.monthlyPrice),
          note: updated.note ?? '',
        },
      }));
      setStatusMessage(`Saved ${updated.label.toLowerCase()} pricing.`);
    } catch {
      setStatusMessage(`Network error while saving ${placement.replace(/_/g, ' ')} pricing.`);
    } finally {
      setSavingPlacement(null);
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
          Ad Pricing
        </p>
        <h2 style={{ margin: 0, color: '#341b36', fontSize: 28 }}>
          Tune day and month rates for platform ads
        </h2>
        <p style={{ margin: 0, color: '#6d5060', lineHeight: 1.7 }}>
          Admins can set the base rate for each advertising placement. Use daily pricing for short bursts and monthly pricing for longer campaigns.
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
          gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        {pricing.map((entry) => {
          const draft = drafts[entry.placement] ?? {
            dailyPrice: String(entry.dailyPrice),
            monthlyPrice: String(entry.monthlyPrice),
            note: entry.note ?? '',
          };

          return (
            <article
              key={entry.placement}
              style={{
                background: '#ffffff',
                borderRadius: 24,
                padding: 18,
                border: '1px solid #f0cad8',
                display: 'grid',
                gap: 12,
              }}
            >
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ color: '#341b36', fontSize: 20, fontWeight: 800 }}>{entry.label}</div>
                <div style={{ color: '#8e657b', fontSize: 14, lineHeight: 1.6 }}>
                  {placementDescriptions[entry.placement]}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                  Daily price
                  <input
                    value={draft.dailyPrice}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [entry.placement]: {
                          ...draft,
                          dailyPrice: event.target.value,
                        },
                      }))
                    }
                    inputMode="decimal"
                    style={{
                      borderRadius: 14,
                      border: '1px solid #f0cad8',
                      padding: '12px 14px',
                      fontSize: 14,
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                  Monthly price
                  <input
                    value={draft.monthlyPrice}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [entry.placement]: {
                          ...draft,
                          monthlyPrice: event.target.value,
                        },
                      }))
                    }
                    inputMode="decimal"
                    style={{
                      borderRadius: 14,
                      border: '1px solid #f0cad8',
                      padding: '12px 14px',
                      fontSize: 14,
                    }}
                  />
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                Admin note
                <input
                  value={draft.note}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [entry.placement]: {
                        ...draft,
                        note: event.target.value,
                      },
                    }))
                  }
                  placeholder="Optional pricing note"
                  style={{
                    borderRadius: 14,
                    border: '1px solid #f0cad8',
                    padding: '12px 14px',
                    fontSize: 14,
                  }}
                />
              </label>

              <div style={{ color: '#8e657b', fontSize: 13 }}>
                Updated {new Date(entry.updatedAt).toLocaleString()} · currency {entry.currency}
              </div>

              <button
                type="button"
                disabled={savingPlacement === entry.placement}
                onClick={() => {
                  void savePricing(entry.placement);
                }}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '12px 16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: '#ff6f9f',
                  color: '#fff9fb',
                }}
              >
                {savingPlacement === entry.placement ? 'Saving...' : 'Save pricing'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
