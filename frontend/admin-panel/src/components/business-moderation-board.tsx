'use client';

import { useMemo, useState } from 'react';
import type { AdminBusinessQueueItem, BusinessModerationStatus } from '@beauty-finder/types';
import { fetchAdminJson, getApiBaseUrl, getAdminHeaders } from '../lib/admin-api';
import { PublicIdChip } from './public-id-chip';

const statusLabels: Record<BusinessModerationStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

const filters: Array<'all' | BusinessModerationStatus> = [
  'all',
  'pending_review',
  'approved',
  'suspended',
  'rejected',
  'draft',
];

export function BusinessModerationBoard({
  initialBusinesses,
}: {
  initialBusinesses: AdminBusinessQueueItem[];
}) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [statusFilter, setStatusFilter] = useState<'all' | BusinessModerationStatus>('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Approve, suspend, or reject businesses here. Public IDs are shown on each card and every action is recorded in the audit log.',
  );

  const visibleBusinesses = useMemo(() => {
    return businesses.filter((business) =>
      statusFilter === 'all' ? true : business.status === statusFilter,
    );
  }, [businesses, statusFilter]);

  async function updateBusinessStatus(
    business: AdminBusinessQueueItem,
    status: BusinessModerationStatus,
  ) {
    setSavingId(business.id);
    setStatusMessage(`Updating ${business.name}...`);

    try {
      const response = await fetch(`${getApiBaseUrl()}/admin/businesses/${business.id}/status`, {
        method: 'PATCH',
        headers: getAdminHeaders(true),
        body: JSON.stringify({
          status,
          note: noteDrafts[business.id] || undefined,
        }),
      });

      if (!response.ok) {
        setStatusMessage(`Could not update ${business.name}.`);
        return;
      }

      const refreshedBusinesses = await fetchAdminJson<AdminBusinessQueueItem[]>('/admin/businesses');
      if (refreshedBusinesses) {
        setBusinesses(refreshedBusinesses);
      }

      setStatusMessage(`${business.name} is now ${statusLabels[status].toLowerCase()}.`);
    } catch {
      setStatusMessage(`Network error while updating ${business.name}.`);
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
          Business Queue
        </p>
        <h2 style={{ margin: 0, color: '#341b36', fontSize: 28 }}>Approve, suspend, or reject salons</h2>
        <p style={{ margin: 0, color: '#6d5060', lineHeight: 1.7 }}>
          Pending launches, suspensions, and rejected listings all live here.
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {filters.map((filter) => (
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
            {filter === 'all' ? 'All statuses' : statusLabels[filter]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {visibleBusinesses.map((business) => (
          <article
            key={business.id}
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
                <div style={{ color: '#341b36', fontSize: 20, fontWeight: 800 }}>{business.name}</div>
                <div style={{ color: '#8e657b', fontSize: 13, fontWeight: 700 }}>
                  {business.city}, {business.state} · owner {business.ownerName}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <PublicIdChip label="Business" value={business.publicId ?? business.id} />
                  <PublicIdChip label="Owner" value={business.ownerPublicId ?? business.ownerId} />
                </div>
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
                {statusLabels[business.status]}
              </div>
            </div>

            <div style={{ color: '#6d5060', fontSize: 14 }}>
              {business.ownerEmail} · created {new Date(business.createdAt).toLocaleDateString()}
            </div>

            <input
              value={noteDrafts[business.id] ?? ''}
              onChange={(event) =>
                setNoteDrafts((current) => ({
                  ...current,
                  [business.id]: event.target.value,
                }))
              }
              placeholder="Optional admin note"
              style={{
                borderRadius: 14,
                border: '1px solid #f0cad8',
                padding: '12px 14px',
                fontSize: 14,
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(['approved', 'pending_review', 'suspended', 'rejected'] as BusinessModerationStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={savingId === business.id}
                    onClick={() => {
                      void updateBusinessStatus(business, status);
                    }}
                    style={{
                      border: status === business.status ? '2px solid #ff6f9f' : '1px solid #f0cad8',
                      background: status === 'approved' ? '#ff6f9f' : '#ffffff',
                      color: status === 'approved' ? '#fff9fb' : '#6d5060',
                      borderRadius: 999,
                      padding: '12px 16px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {savingId === business.id && status === business.status
                      ? 'Saving...'
                      : statusLabels[status]}
                  </button>
                ),
              )}
            </div>
          </article>
        ))}

        {visibleBusinesses.length === 0 ? (
          <div
            style={{
              borderRadius: 24,
              padding: 20,
              border: '1px dashed #f0cad8',
              color: '#8e657b',
              background: '#fffdfd',
            }}
          >
            No businesses match this moderation filter.
          </div>
        ) : null}
      </div>
    </section>
  );
}
