'use client';

import { useMemo, useState } from 'react';
import type { AdminReviewQueueItem, ReviewModerationStatus } from '@beauty-finder/types';
import { fetchAdminJson, getApiBaseUrl, getAdminHeaders } from '../lib/admin-api';
import { PublicIdChip } from './public-id-chip';

const statusLabels: Record<ReviewModerationStatus, string> = {
  flagged: 'Flagged',
  hidden: 'Hidden',
  published: 'Published',
};

export function ReviewModerationBoard({
  initialReviews,
}: {
  initialReviews: AdminReviewQueueItem[];
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewModerationStatus>('flagged');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Flagged reviews land here first. Review cards now include business and customer public IDs for faster lookup.',
  );

  const visibleReviews = useMemo(() => {
    return reviews.filter((review) =>
      statusFilter === 'all' ? true : review.status === statusFilter,
    );
  }, [reviews, statusFilter]);

  async function updateReviewStatus(
    review: AdminReviewQueueItem,
    status: ReviewModerationStatus,
  ) {
    setSavingId(review.id);
    setStatusMessage(`Updating review ${review.id}...`);

    try {
      const response = await fetch(`${getApiBaseUrl()}/admin/reviews/${review.id}/status`, {
        method: 'PATCH',
        headers: getAdminHeaders(true),
        body: JSON.stringify({
          status,
          note: noteDrafts[review.id] || undefined,
        }),
      });

      if (!response.ok) {
        setStatusMessage(`Could not update review ${review.id}.`);
        return;
      }

      const refreshedReviews = await fetchAdminJson<AdminReviewQueueItem[]>('/admin/reviews');
      if (refreshedReviews) {
        setReviews(refreshedReviews);
      }

      setStatusMessage(`Review ${review.id} is now ${statusLabels[status].toLowerCase()}.`);
    } catch {
      setStatusMessage(`Network error while updating review ${review.id}.`);
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
          Review Queue
        </p>
        <h2 style={{ margin: 0, color: '#341b36', fontSize: 28 }}>Moderate customer reviews</h2>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {(['flagged', 'hidden', 'published', 'all'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '10px 14px',
              fontWeight: 800,
              cursor: 'pointer',
              background: statusFilter === filter ? '#ff6f9f' : '#fff0f6',
              color: statusFilter === filter ? '#fff9fb' : '#6d5060',
            }}
          >
            {filter === 'all' ? 'All reviews' : statusLabels[filter]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {visibleReviews.map((review) => (
          <article
            key={review.id}
            style={{
              display: 'grid',
              gap: 12,
              background: '#ffffff',
              borderRadius: 24,
              padding: 18,
              border: '1px solid #f0cad8',
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
                <div style={{ color: '#341b36', fontSize: 20, fontWeight: 800 }}>
                  {review.businessName} · {review.rating}/5
                </div>
                <div style={{ color: '#8e657b', fontSize: 13, fontWeight: 700 }}>
                  by {review.customerName} · {new Date(review.createdAt).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <PublicIdChip label="Business" value={review.businessPublicId ?? review.businessId} />
                  <PublicIdChip label="Customer" value={review.customerPublicId ?? review.customerId} />
                </div>
              </div>

              <div
                style={{
                  background: review.status === 'flagged' ? '#fff0c9' : '#fff4f8',
                  color: review.status === 'flagged' ? '#8b5b24' : '#8e657b',
                  borderRadius: 999,
                  padding: '10px 14px',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {statusLabels[review.status]}
              </div>
            </div>

            <div
              style={{
                color: '#5c4456',
                lineHeight: 1.7,
                background: '#fff7fa',
                borderRadius: 18,
                padding: 14,
              }}
            >
              {review.comment || 'No review comment provided.'}
            </div>

            <input
              value={noteDrafts[review.id] ?? ''}
              onChange={(event) =>
                setNoteDrafts((current) => ({
                  ...current,
                  [review.id]: event.target.value,
                }))
              }
              placeholder="Optional moderation note"
              style={{
                borderRadius: 14,
                border: '1px solid #f0cad8',
                padding: '12px 14px',
                fontSize: 14,
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(['published', 'hidden', 'flagged'] as ReviewModerationStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={savingId === review.id}
                  onClick={() => {
                    void updateReviewStatus(review, status);
                  }}
                  style={{
                    border: status === review.status ? '2px solid #ff6f9f' : '1px solid #f0cad8',
                    background: status === 'published' ? '#ff6f9f' : '#ffffff',
                    color: status === 'published' ? '#fff9fb' : '#6d5060',
                    borderRadius: 999,
                    padding: '12px 16px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {savingId === review.id && status === review.status
                    ? 'Saving...'
                    : statusLabels[status]}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
