'use client';

import { useEffect, useState } from 'react';
import type {
  AdminAccountSummary,
  AdminAccountUpdateInput,
  OwnerBusinessProfile,
  SessionPayload,
} from '@beauty-finder/types';
import {
  clearAdminAccountAccessSession,
  fetchAdminJson,
  getAdminHeaders,
  getApiBaseUrl,
} from '../lib/admin-api';
import { PublicIdChip } from './public-id-chip';

type BusinessDraft = {
  name: string;
  description: string;
  heroImage: string;
  videoUrl: string;
  galleryImages: string;
  servicesJson: string;
  staffJson: string;
  promotionJson: string;
};

function createBusinessDraft(business: OwnerBusinessProfile): BusinessDraft {
  return {
    name: business.name,
    description: business.description ?? '',
    heroImage: business.heroImage ?? '',
    videoUrl: business.videoUrl ?? '',
    galleryImages: business.galleryImages.join('\n'),
    servicesJson: JSON.stringify(business.services, null, 2),
    staffJson: JSON.stringify(business.staff, null, 2),
    promotionJson: business.promotion ? JSON.stringify(business.promotion, null, 2) : '',
  };
}

export function AccountAccessManager() {
  const [accounts, setAccounts] = useState<AdminAccountSummary[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<
    'all' | 'customer' | 'owner' | 'technician' | 'admin'
  >('all');
  const [accessNote, setAccessNote] = useState('Admin Dashboard assisted access');
  const [activeSession, setActiveSession] = useState<SessionPayload | null>(null);
  const [activeAccount, setActiveAccount] = useState<AdminAccountSummary | null>(null);
  const [ownerBusinesses, setOwnerBusinesses] = useState<OwnerBusinessProfile[]>([]);
  const [businessDrafts, setBusinessDrafts] = useState<Record<string, BusinessDraft>>({});
  const [accountDraft, setAccountDraft] = useState<AdminAccountUpdateInput>({
    name: '',
    email: '',
    phone: '',
    status: 'active',
  });
  const [statusMessage, setStatusMessage] = useState(
    'Admins can open any account with a short-lived access session, search by public ID, then edit the account profile and owner business data.',
  );
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isStartingAccessFor, setIsStartingAccessFor] = useState<string | null>(null);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null);

  useEffect(() => {
    void refreshAccounts();
    void hydrateActiveAccess();
  }, []);

  async function refreshAccounts() {
    setIsLoadingAccounts(true);
    setStatusMessage('Loading accounts...');
    try {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (roleFilter !== 'all') {
        params.set('role', roleFilter);
      }
      const path = `/admin/accounts${params.size ? `?${params.toString()}` : ''}`;
      const nextAccounts = await fetchAdminJson<AdminAccountSummary[]>(path);
      if (!nextAccounts) {
        setStatusMessage('Could not load accounts from the admin API.');
        return;
      }
      setAccounts(nextAccounts);
      setStatusMessage(`Loaded ${nextAccounts.length} accounts for admin access.`);
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  async function hydrateActiveAccess() {
    const session = await fetchAdminJson<SessionPayload>('/auth/session', undefined, 'access');
    if (!session) {
      await clearAdminAccountAccessSession();
      return;
    }

    setActiveSession(session);
    setStatusMessage(`Account access restored for ${session.user.name}.`);
    await loadActiveAccount(session.user.id, session.user.role);
  }

  async function loadActiveAccount(userId: string, role?: string) {
    const account = await fetchAdminJson<AdminAccountSummary>(`/admin/accounts/${userId}`);
    if (account) {
      setActiveAccount(account);
      setAccountDraft({
        name: account.name,
        email: account.email,
        phone: account.phone ?? '',
        status: account.status,
      });
    }

    const targetRole = role ?? account?.primaryRole;
    if (targetRole === 'owner') {
      const businesses = await fetchAdminJson<OwnerBusinessProfile[]>(
        '/businesses/owner/manage',
        undefined,
        'access',
      );
      if (businesses) {
        setOwnerBusinesses(businesses);
        setBusinessDrafts(
          Object.fromEntries(businesses.map((business) => [business.id, createBusinessDraft(business)])),
        );
        return;
      }
    }

    setOwnerBusinesses([]);
    setBusinessDrafts({});
  }

  async function startAccess(account: AdminAccountSummary) {
    setIsStartingAccessFor(account.id);
    setStatusMessage(`Creating access session for ${account.name}...`);

    try {
      const response = await fetch('/api/auth/access-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          note: accessNote.trim() || undefined,
        }),
      });

      if (!response.ok) {
        setStatusMessage(`Could not start account access for ${account.name}.`);
        return;
      }

      const session = (await response.json()) as SessionPayload;
      setActiveSession(session);
      await loadActiveAccount(account.id, session.user.role);
      setStatusMessage(`Admin access session is live for ${session.user.name}.`);
    } catch {
      setStatusMessage(`Network error while starting account access for ${account.name}.`);
    } finally {
      setIsStartingAccessFor(null);
    }
  }

  function endAccess() {
    void clearAdminAccountAccessSession();
    setActiveSession(null);
    setActiveAccount(null);
    setOwnerBusinesses([]);
    setBusinessDrafts({});
    setStatusMessage('Account access session ended. Admin token remains active.');
  }

  async function saveAccount() {
    if (!activeAccount) {
      return;
    }

    setIsSavingAccount(true);
    setStatusMessage(`Saving account profile for ${activeAccount.name}...`);
    try {
      const response = await fetch(`${getApiBaseUrl()}/admin/accounts/${activeAccount.id}`, {
        method: 'PATCH',
        headers: getAdminHeaders(true),
        body: JSON.stringify({
          name: accountDraft.name?.trim() || undefined,
          email: accountDraft.email?.trim() || undefined,
          phone: accountDraft.phone?.trim() ? accountDraft.phone.trim() : null,
          status: accountDraft.status,
        }),
      });

      if (!response.ok) {
        setStatusMessage(`Could not save account profile for ${activeAccount.name}.`);
        return;
      }

      const updated = (await response.json()) as AdminAccountSummary;
      setActiveAccount(updated);
      setAccountDraft({
        name: updated.name,
        email: updated.email,
        phone: updated.phone ?? '',
        status: updated.status,
      });
      setAccounts((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setStatusMessage(`Saved profile changes for ${updated.name}.`);
    } catch {
      setStatusMessage(`Network error while saving account profile for ${activeAccount.name}.`);
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function saveBusiness(businessId: string) {
    const draft = businessDrafts[businessId];
    if (!draft) {
      setStatusMessage('No active access session is available for owner business editing.');
      return;
    }

    let services;
    let staff;
    let promotion;

    try {
      services = JSON.parse(draft.servicesJson || '[]');
      staff = JSON.parse(draft.staffJson || '[]');
      promotion = draft.promotionJson.trim() ? JSON.parse(draft.promotionJson) : null;
    } catch {
      setStatusMessage('Services, staff, and promotion must be valid JSON before saving.');
      return;
    }

    setSavingBusinessId(businessId);
    setStatusMessage(`Saving business profile ${businessId} through the access session...`);
    try {
      const response = await fetch(`${getApiBaseUrl()}/businesses/${businessId}/owner-profile`, {
        method: 'PATCH',
        headers: getAdminHeaders(true, undefined, 'access'),
        body: JSON.stringify({
          name: draft.name.trim(),
          description: draft.description.trim(),
          heroImage: draft.heroImage.trim() || undefined,
          videoUrl: draft.videoUrl.trim() || undefined,
          galleryImages: draft.galleryImages
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean),
          services,
          staff,
          promotion,
        }),
      });

      if (!response.ok) {
        setStatusMessage(`Could not save business ${businessId} from the admin dashboard.`);
        return;
      }

      const updated = (await response.json()) as OwnerBusinessProfile;
      setOwnerBusinesses((current) =>
        current.map((business) => (business.id === updated.id ? updated : business)),
      );
      setBusinessDrafts((current) => ({
        ...current,
        [updated.id]: createBusinessDraft(updated),
      }));
      setStatusMessage(`Saved owner business ${updated.name} through the access session.`);
    } catch {
      setStatusMessage(`Network error while saving business ${businessId}.`);
    } finally {
      setSavingBusinessId(null);
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
          Account access
        </p>
        <h2 style={{ margin: 0, color: '#341b36', fontSize: 28 }}>
          Enter any account and edit core account or owner business data
        </h2>
        <p style={{ margin: 0, color: '#6d5060', lineHeight: 1.7 }}>
          Access sessions are short-lived, logged in admin audit, and keep the original admin token separate from the account token.
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
          gridTemplateColumns: '1.4fr 0.8fr 1fr auto',
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
          Search account
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, phone, or public ID"
            style={{
              borderRadius: 14,
              border: '1px solid #f0cad8',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
          Role filter
          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(
                event.target.value as 'all' | 'customer' | 'owner' | 'technician' | 'admin',
              )
            }
            style={{
              borderRadius: 14,
              border: '1px solid #f0cad8',
              padding: '12px 14px',
              fontSize: 14,
            }}
          >
            <option value="all">All roles</option>
            <option value="customer">Customer</option>
            <option value="owner">Owner</option>
            <option value="technician">Technician</option>
            <option value="admin">Admin</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
          Access note
          <input
            value={accessNote}
            onChange={(event) => setAccessNote(event.target.value)}
            placeholder="Reason for account access"
            style={{
              borderRadius: 14,
              border: '1px solid #f0cad8',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => {
            void refreshAccounts();
          }}
          disabled={isLoadingAccounts}
          style={{
            border: '1px solid #f0cad8',
            background: '#ffffff',
            color: '#c72d63',
            borderRadius: 999,
            padding: '12px 16px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {isLoadingAccounts ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}
      >
        {accounts.map((account) => {
          const isActive = activeSession?.user.id === account.id;
          return (
            <article
              key={account.id}
              style={{
                background: isActive ? '#fff0f6' : '#ffffff',
                borderRadius: 22,
                padding: 18,
                border: isActive ? '2px solid #ff6f9f' : '1px solid #f0cad8',
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ color: '#341b36', fontWeight: 800, fontSize: 18 }}>{account.name}</div>
                <div style={{ color: '#6d5060', fontSize: 14 }}>{account.email}</div>
                <PublicIdChip label="Public ID" value={account.publicId ?? account.id} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: '#8e657b', fontWeight: 700 }}>
                <span>{account.primaryRole}</span>
                <span>{account.status}</span>
                <span>{account.businessCount} businesses</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void startAccess(account);
                }}
                disabled={isStartingAccessFor === account.id}
                style={{
                  border: 'none',
                  background: '#ff6f9f',
                  color: '#fff9fb',
                  borderRadius: 14,
                  padding: '12px 14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {isStartingAccessFor === account.id ? 'Opening access...' : 'Access account'}
              </button>
            </article>
          );
        })}
      </div>

      {activeSession && activeAccount ? (
        <section
          style={{
            background: '#ffffff',
            borderRadius: 24,
            padding: 20,
            border: '1px solid #f0cad8',
            display: 'grid',
            gap: 18,
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
              <div style={{ color: '#341b36', fontSize: 22, fontWeight: 800 }}>
                Acting as {activeSession.user.name}
              </div>
              <div style={{ color: '#6d5060' }}>
                Role {activeSession.user.role} · started {activeSession.adminAccess?.startedAt ?? activeSession.expiresAt}
              </div>
              <PublicIdChip
                label="Public ID"
                value={activeSession.user.publicId ?? activeAccount.publicId ?? activeAccount.id}
              />
            </div>
            <button
              type="button"
              onClick={endAccess}
              style={{
                border: '1px solid #f0cad8',
                background: '#ffffff',
                color: '#c72d63',
                borderRadius: 999,
                padding: '10px 14px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              End access
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div
              style={{
                borderRadius: 14,
                border: '1px solid #f0cad8',
                background: '#fffafc',
                padding: '12px 14px',
                display: 'grid',
                gap: 8,
              }}
            >
              <span style={{ color: '#8e657b', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                Public ID
              </span>
              <PublicIdChip label="Account" value={activeAccount.publicId ?? activeAccount.id} />
            </div>

            <div
              style={{
                borderRadius: 14,
                border: '1px solid #f0cad8',
                background: '#fffafc',
                padding: '12px 14px',
                display: 'grid',
                gap: 6,
              }}
            >
              <span style={{ color: '#8e657b', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                Internal ID
              </span>
              <span style={{ color: '#341b36', fontWeight: 800 }}>{activeAccount.id}</span>
            </div>

            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Name
              <input
                value={accountDraft.name ?? ''}
                onChange={(event) =>
                  setAccountDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '12px 14px',
                  fontSize: 14,
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Email
              <input
                value={accountDraft.email ?? ''}
                onChange={(event) =>
                  setAccountDraft((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '12px 14px',
                  fontSize: 14,
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Phone
              <input
                value={accountDraft.phone ?? ''}
                onChange={(event) =>
                  setAccountDraft((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '12px 14px',
                  fontSize: 14,
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Status
              <select
                value={accountDraft.status ?? 'active'}
                onChange={(event) =>
                  setAccountDraft((current) => ({
                    ...current,
                    status: event.target.value as AdminAccountSummary['status'],
                  }))
                }
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '12px 14px',
                  fontSize: 14,
                }}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="deleted">Deleted</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                void saveAccount();
              }}
              disabled={isSavingAccount}
              style={{
                border: 'none',
                background: '#ff6f9f',
                color: '#fff9fb',
                borderRadius: 14,
                padding: '12px 16px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {isSavingAccount ? 'Saving account...' : 'Save account'}
            </button>
          </div>

          {activeSession.user.role === 'owner' ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ color: '#341b36', fontSize: 22, fontWeight: 800 }}>Owner business editor</div>
              {ownerBusinesses.map((business) => {
                const draft = businessDrafts[business.id] ?? createBusinessDraft(business);
                return (
                  <article
                    key={business.id}
                    style={{
                      background: '#fffafc',
                      borderRadius: 22,
                      padding: 18,
                      border: '1px solid #f0cad8',
                      display: 'grid',
                      gap: 12,
                    }}
                  >
                    <div style={{ color: '#341b36', fontSize: 20, fontWeight: 800 }}>
                      {business.name}
                    </div>
                    <PublicIdChip label="Public ID" value={business.publicId ?? business.id} />

                    <div
                      style={{
                        display: 'grid',
                        gap: 12,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      }}
                    >
                      <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                        Business name
                        <input
                          value={draft.name}
                          onChange={(event) =>
                            setBusinessDrafts((current) => ({
                              ...current,
                              [business.id]: {
                                ...draft,
                                name: event.target.value,
                              },
                            }))
                          }
                          style={{
                            borderRadius: 14,
                            border: '1px solid #f0cad8',
                            padding: '12px 14px',
                            fontSize: 14,
                          }}
                        />
                      </label>

                      <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                        Hero image
                        <input
                          value={draft.heroImage}
                          onChange={(event) =>
                            setBusinessDrafts((current) => ({
                              ...current,
                              [business.id]: {
                                ...draft,
                                heroImage: event.target.value,
                              },
                            }))
                          }
                          style={{
                            borderRadius: 14,
                            border: '1px solid #f0cad8',
                            padding: '12px 14px',
                            fontSize: 14,
                          }}
                        />
                      </label>

                      <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                        Video URL
                        <input
                          value={draft.videoUrl}
                          onChange={(event) =>
                            setBusinessDrafts((current) => ({
                              ...current,
                              [business.id]: {
                                ...draft,
                                videoUrl: event.target.value,
                              },
                            }))
                          }
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
                      Description
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          setBusinessDrafts((current) => ({
                            ...current,
                            [business.id]: {
                              ...draft,
                              description: event.target.value,
                            },
                          }))
                        }
                        rows={4}
                        style={{
                          borderRadius: 16,
                          border: '1px solid #f0cad8',
                          padding: '12px 14px',
                          fontSize: 14,
                          resize: 'vertical',
                        }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                      Gallery images
                      <textarea
                        value={draft.galleryImages}
                        onChange={(event) =>
                          setBusinessDrafts((current) => ({
                            ...current,
                            [business.id]: {
                              ...draft,
                              galleryImages: event.target.value,
                            },
                          }))
                        }
                        rows={4}
                        style={{
                          borderRadius: 16,
                          border: '1px solid #f0cad8',
                          padding: '12px 14px',
                          fontSize: 14,
                          resize: 'vertical',
                        }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                      Services JSON
                      <textarea
                        value={draft.servicesJson}
                        onChange={(event) =>
                          setBusinessDrafts((current) => ({
                            ...current,
                            [business.id]: {
                              ...draft,
                              servicesJson: event.target.value,
                            },
                          }))
                        }
                        rows={8}
                        style={{
                          borderRadius: 16,
                          border: '1px solid #f0cad8',
                          padding: '12px 14px',
                          fontSize: 13,
                          resize: 'vertical',
                          fontFamily: '"SFMono-Regular", Consolas, monospace',
                        }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                      Staff JSON
                      <textarea
                        value={draft.staffJson}
                        onChange={(event) =>
                          setBusinessDrafts((current) => ({
                            ...current,
                            [business.id]: {
                              ...draft,
                              staffJson: event.target.value,
                            },
                          }))
                        }
                        rows={8}
                        style={{
                          borderRadius: 16,
                          border: '1px solid #f0cad8',
                          padding: '12px 14px',
                          fontSize: 13,
                          resize: 'vertical',
                          fontFamily: '"SFMono-Regular", Consolas, monospace',
                        }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                      Promotion JSON
                      <textarea
                        value={draft.promotionJson}
                        onChange={(event) =>
                          setBusinessDrafts((current) => ({
                            ...current,
                            [business.id]: {
                              ...draft,
                              promotionJson: event.target.value,
                            },
                          }))
                        }
                        rows={6}
                        style={{
                          borderRadius: 16,
                          border: '1px solid #f0cad8',
                          padding: '12px 14px',
                          fontSize: 13,
                          resize: 'vertical',
                          fontFamily: '"SFMono-Regular", Consolas, monospace',
                        }}
                      />
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => {
                          void saveBusiness(business.id);
                        }}
                        disabled={savingBusinessId === business.id}
                        style={{
                          border: 'none',
                          background: '#ff6f9f',
                          color: '#fff9fb',
                          borderRadius: 14,
                          padding: '12px 16px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {savingBusinessId === business.id ? 'Saving business...' : 'Save business'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                background: '#fff6fa',
                borderRadius: 18,
                padding: '14px 16px',
                color: '#6d5060',
                lineHeight: 1.7,
              }}
            >
              This access session can use target-scoped APIs for {activeSession.user.role} accounts.
              The dashboard editor currently exposes direct profile editing here, and owner business editing when the target account owns businesses.
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
