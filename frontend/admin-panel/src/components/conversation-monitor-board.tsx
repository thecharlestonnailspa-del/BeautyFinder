'use client';

import { useState } from 'react';
import type { AdminConversationCase, AdminConversationCaseStatus } from '@beauty-finder/types';
import { fetchAdminJson, getApiBaseUrl, getAdminHeaders } from '../lib/admin-api';

const statusLabels: Record<AdminConversationCaseStatus, string> = {
  open: 'Open',
  watched: 'Watched',
  resolved: 'Resolved',
};

export function ConversationMonitorBoard({
  initialCases,
}: {
  initialCases: AdminConversationCase[];
}) {
  const [cases, setCases] = useState(initialCases);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Monitor high-risk conversations here. Refund or reschedule language is surfaced first.',
  );

  async function updateCaseStatus(
    conversationCase: AdminConversationCase,
    status: AdminConversationCaseStatus,
  ) {
    setSavingId(conversationCase.id);
    setStatusMessage(`Updating case ${conversationCase.id}...`);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/admin/conversations/${conversationCase.id}/status`,
        {
          method: 'PATCH',
          headers: getAdminHeaders(true),
          body: JSON.stringify({
            status,
            note: noteDrafts[conversationCase.id] || undefined,
          }),
        },
      );

      if (!response.ok) {
        setStatusMessage(`Could not update case ${conversationCase.id}.`);
        return;
      }

      const refreshedCases = await fetchAdminJson<AdminConversationCase[]>('/admin/conversations');
      if (refreshedCases) {
        setCases(refreshedCases);
      }

      setStatusMessage(`Case ${conversationCase.id} is now ${statusLabels[status].toLowerCase()}.`);
    } catch {
      setStatusMessage(`Network error while updating case ${conversationCase.id}.`);
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
          Care Escalations
        </p>
        <h2 style={{ margin: 0, color: '#341b36', fontSize: 28 }}>Monitor conversation risk</h2>
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

      <div style={{ display: 'grid', gap: 12 }}>
        {cases.map((conversationCase) => (
          <article
            key={conversationCase.id}
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
                  {conversationCase.businessName}
                </div>
                <div style={{ color: '#8e657b', fontSize: 13, fontWeight: 700 }}>
                  {conversationCase.participantNames.join(' · ')} · {conversationCase.messageCount} messages
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div
                  style={{
                    background: conversationCase.priority === 'high' ? '#fff0c9' : '#fff4f8',
                    color: conversationCase.priority === 'high' ? '#8b5b24' : '#8e657b',
                    borderRadius: 999,
                    padding: '10px 14px',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {conversationCase.priority === 'high' ? 'High priority' : 'Normal priority'}
                </div>
                <div
                  style={{
                    background: '#fff4f8',
                    color: '#8e657b',
                    borderRadius: 999,
                    padding: '10px 14px',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {statusLabels[conversationCase.caseStatus]}
                </div>
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
              {conversationCase.lastMessage}
            </div>

            <div style={{ color: '#6d5060', fontSize: 14 }}>
              Last update {new Date(conversationCase.lastMessageAt).toLocaleString()}
              {conversationCase.bookingId ? ` · linked booking ${conversationCase.bookingId}` : ''}
            </div>

            <input
              value={noteDrafts[conversationCase.id] ?? ''}
              onChange={(event) =>
                setNoteDrafts((current) => ({
                  ...current,
                  [conversationCase.id]: event.target.value,
                }))
              }
              placeholder="Optional case note"
              style={{
                borderRadius: 14,
                border: '1px solid #f0cad8',
                padding: '12px 14px',
                fontSize: 14,
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(['open', 'watched', 'resolved'] as AdminConversationCaseStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={savingId === conversationCase.id}
                  onClick={() => {
                    void updateCaseStatus(conversationCase, status);
                  }}
                  style={{
                    border:
                      status === conversationCase.caseStatus
                        ? '2px solid #ff6f9f'
                        : '1px solid #f0cad8',
                    background: status === 'watched' ? '#ff6f9f' : '#ffffff',
                    color: status === 'watched' ? '#fff9fb' : '#6d5060',
                    borderRadius: 999,
                    padding: '12px 16px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {savingId === conversationCase.id && status === conversationCase.caseStatus
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
