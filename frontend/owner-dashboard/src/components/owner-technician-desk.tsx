'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type {
  OwnerBusinessProfile,
  OwnerTechnicianInput,
  OwnerTechnicianProfile,
} from '@beauty-finder/types';
import {
  fetchOwnerTechnicians,
  maxOwnerImageUploadSizeBytes,
  previewOwnerTechniciansStorageKey,
  saveOwnerTechnicianRoster,
  uploadOwnerBusinessImage,
} from '../lib/owner-api';
import { OwnerMotionIcon } from './owner-motion-icon';

function isUploadableImageFile(file: File) {
  if (file.type.startsWith('image/')) {
    return true;
  }

  return /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

function createDraftTechnician(business: OwnerBusinessProfile): OwnerTechnicianProfile {
  return {
    id: `draft-technician-${Math.random().toString(36).slice(2, 10)}`,
    businessId: business.id,
    businessName: business.name,
    businessCategory: business.category,
    businessStatus: business.status,
    name: 'New team member',
    title: 'Salon specialist',
    avatarUrl: '',
    isActive: true,
  };
}

function isDraftTechnician(id: string) {
  return id.startsWith('draft-technician-');
}

function buildInitialTechnicianState(initialBusinesses: OwnerBusinessProfile[]) {
  return Object.fromEntries(
    initialBusinesses.map((business) => [
      business.id,
      business.staff.map((member) => ({
        ...member,
        businessName: business.name,
        businessCategory: business.category,
        businessStatus: business.status,
      })),
    ]),
  ) as Record<string, OwnerTechnicianProfile[]>;
}

function buildTechnicianPayload(
  technicians: OwnerTechnicianProfile[],
): OwnerTechnicianInput[] {
  return technicians
    .map((technician) => ({
      id: isDraftTechnician(technician.id) ? undefined : technician.id,
      userId: technician.userId,
      name: technician.name.trim(),
      title: technician.title?.trim() || undefined,
      avatarUrl: technician.avatarUrl?.trim() || undefined,
      isActive: technician.isActive,
    }))
    .filter((technician) => technician.name);
}

export function OwnerTechnicianDesk({
  initialBusinesses,
  previewMode = false,
}: {
  initialBusinesses: OwnerBusinessProfile[];
  previewMode?: boolean;
}) {
  const [selectedBusinessId, setSelectedBusinessId] = useState(initialBusinesses[0]?.id ?? '');
  const hasMultipleBusinesses = initialBusinesses.length > 1;
  const [techniciansByBusiness, setTechniciansByBusiness] = useState(
    buildInitialTechnicianState(initialBusinesses),
  );
  const [statusMessage, setStatusMessage] = useState(
    previewMode
      ? 'Preview mode is active. Team updates save locally on this device.'
      : 'Team roster, avatars, and availability are managed separately from the salon profile.',
  );
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null);
  const [loadingBusinessId, setLoadingBusinessId] = useState<string | null>(null);
  const [uploadingTechnicianId, setUploadingTechnicianId] = useState<string | null>(null);
  const technicianAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAvatarTechnicianIdRef = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!previewMode || typeof window === 'undefined') {
      return;
    }

    const stored = window.localStorage.getItem(previewOwnerTechniciansStorageKey);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Record<string, OwnerTechnicianProfile[]>;
      if (parsed && typeof parsed === 'object') {
        setTechniciansByBusiness((current) => ({ ...current, ...parsed }));
        setStatusMessage('Loaded saved team preview changes from this device.');
      }
    } catch {
      window.localStorage.removeItem(previewOwnerTechniciansStorageKey);
    }
  }, [previewMode]);

  useEffect(() => {
    if (!previewMode || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      previewOwnerTechniciansStorageKey,
      JSON.stringify(techniciansByBusiness),
    );
  }, [previewMode, techniciansByBusiness]);

  useEffect(() => {
    if (previewMode || !selectedBusinessId) {
      return;
    }

    let cancelled = false;
    setLoadingBusinessId(selectedBusinessId);

    void (async () => {
      const technicians = await fetchOwnerTechnicians(selectedBusinessId);
      if (cancelled) {
        return;
      }

      if (technicians) {
        setTechniciansByBusiness((current) => ({
          ...current,
          [selectedBusinessId]: technicians,
        }));
      }

      setLoadingBusinessId(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [previewMode, selectedBusinessId]);

    const activeBusiness =
    initialBusinesses.find((business) => business.id === selectedBusinessId) ?? initialBusinesses[0];

  if (!activeBusiness) {
    return null;
  }

  const activeTechnicians = techniciansByBusiness[activeBusiness.id] ?? [];
  const availableTechnicians = activeTechnicians.filter((technician) => technician.isActive).length;
  const specialtyCount = new Set(
    activeTechnicians.map((technician) => technician.title?.trim()).filter(Boolean),
  ).size;

  function updateActiveTechnicians(
    updater: (technicians: OwnerTechnicianProfile[]) => OwnerTechnicianProfile[],
  ) {
    setTechniciansByBusiness((current) => ({
      ...current,
      [activeBusiness.id]: updater(current[activeBusiness.id] ?? []),
    }));
  }

  async function uploadTechnicianAvatar(technicianId: string, file?: File | null) {
    if (!activeBusiness || !file) {
      return;
    }

    if (file.size > maxOwnerImageUploadSizeBytes) {
      setStatusMessage('Selected image must be 5 MB or smaller.');
      return;
    }

    if (!isUploadableImageFile(file)) {
      setStatusMessage('Choose an image file from your device before uploading.');
      return;
    }

    setUploadingTechnicianId(technicianId);
    const technician = activeTechnicians.find((item) => item.id === technicianId);
    const technicianName = technician?.name || 'team member';
    setStatusMessage(`Uploading avatar for ${technicianName}...`);

    const uploadedUrl = await uploadOwnerBusinessImage(activeBusiness.id, file);

    if (!uploadedUrl) {
      setStatusMessage(`Could not upload the avatar for ${technicianName}.`);
      setUploadingTechnicianId(null);
      return;
    }

    const nextTechnicians = activeTechnicians.map((item) =>
      item.id === technicianId ? { ...item, avatarUrl: uploadedUrl } : item,
    );

    setTechniciansByBusiness((current) => ({
      ...current,
      [activeBusiness.id]: nextTechnicians,
    }));

    if (previewMode) {
      setStatusMessage(`${technicianName} avatar was uploaded in preview mode and saved locally.`);
      setUploadingTechnicianId(null);
      return;
    }

    const updated = await saveOwnerTechnicianRoster(
      activeBusiness.id,
      buildTechnicianPayload(nextTechnicians),
    );

    if (updated) {
      setTechniciansByBusiness((current) => ({
        ...current,
        [activeBusiness.id]: updated,
      }));
      setStatusMessage(`${technicianName} avatar was uploaded and the team roster was saved.`);
    } else {
      setStatusMessage(`${technicianName} avatar was uploaded, but the team roster was not saved.`);
    }

    setUploadingTechnicianId(null);
  }

  function saveActiveTechnicians() {
    if (!activeBusiness) {
      return;
    }

    const nextPayload = buildTechnicianPayload(activeTechnicians);

    if (previewMode) {
      setStatusMessage(
        `${activeBusiness.name} team roster was saved locally in preview mode.`,
      );
      return;
    }

    setStatusMessage(`Saving team roster for ${activeBusiness.name}...`);
    setSavingBusinessId(activeBusiness.id);

    startTransition(() => {
      void (async () => {
        const updated = await saveOwnerTechnicianRoster(activeBusiness.id, nextPayload);
        if (updated) {
          setTechniciansByBusiness((current) => ({
            ...current,
            [activeBusiness.id]: updated,
          }));
          setStatusMessage(`${activeBusiness.name} team roster was saved separately.`);
        } else {
          setStatusMessage(`Could not save team roster for ${activeBusiness.name}.`);
        }
        setSavingBusinessId(null);
      })();
    });
  }

  return (
    <section
      style={{
        background: '#fffdfb',
        borderRadius: 34,
        padding: 26,
        border: '1px solid rgba(113, 70, 90, 0.14)',
        boxShadow: '0 24px 56px rgba(51, 36, 41, 0.06)',
        display: 'grid',
        gap: 20,
      }}
    >
      <input
        ref={technicianAvatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const technicianId = pendingAvatarTechnicianIdRef.current;
          if (technicianId) {
            void uploadTechnicianAvatar(technicianId, file);
          }
          pendingAvatarTechnicianIdRef.current = null;
          event.currentTarget.value = '';
        }}
        style={{ display: 'none' }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', maxWidth: 760 }}>
          <OwnerMotionIcon name="team" size={58} />
          <div style={{ display: 'grid', gap: 8 }}>
            <p
              style={{
                margin: 0,
                color: '#9e5870',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Team desk
            </p>
            <h2 style={{ margin: 0, fontSize: 32, color: '#24171b', lineHeight: 1.12 }}>
              Manage your salon team separately from the salon profile
            </h2>
            <p style={{ margin: 0, color: '#6f5961', lineHeight: 1.7 }}>
              Availability and staff details stay in their own roster, instead of being mixed into
              the salon settings workspace.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            saveActiveTechnicians();
          }}
          disabled={isPending || savingBusinessId === activeBusiness.id}
          style={{
            border: 'none',
            background: '#6f404a',
            color: '#fffaf8',
            borderRadius: 999,
            padding: '14px 18px',
            fontWeight: 800,
            cursor: 'pointer',
            minWidth: 190,
          }}
        >
          {savingBusinessId === activeBusiness.id ? 'Saving team...' : 'Save team roster'}
        </button>
      </div>

      <div
        style={{
          background: '#f7eee8',
          color: '#64545a',
          borderRadius: 18,
          padding: '12px 14px',
          border: '1px solid rgba(113, 70, 90, 0.1)',
          fontWeight: 700,
        }}
      >
        {loadingBusinessId === activeBusiness.id
          ? `Refreshing team roster for ${activeBusiness.name}...`
          : statusMessage}
      </div>

      {hasMultipleBusinesses ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {initialBusinesses.map((business) => (
            <button
              key={business.id}
              type="button"
              onClick={() => {
                setSelectedBusinessId(business.id);
                setStatusMessage(`Managing the team for ${business.name}.`);
              }}
              style={{
                border:
                  business.id === activeBusiness.id
                    ? '2px solid #6f404a'
                    : '1px solid rgba(113, 70, 90, 0.14)',
                background:
                  business.id === activeBusiness.id
                    ? 'linear-gradient(135deg, #f7ede8, #fff9f6)'
                    : '#ffffff',
                borderRadius: 22,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'grid',
                gap: 4,
                minWidth: 180,
                textAlign: 'left',
              }}
            >
              <span style={{ fontWeight: 800, color: '#24171b', fontSize: 15 }}>{business.name}</span>
              <span style={{ color: '#756067', fontSize: 12 }}>
                {business.city}, {business.state}
              </span>
              <span style={{ color: '#8f6a1f', fontSize: 12, fontWeight: 700 }}>
                Team roster
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { icon: 'team' as const, label: 'Total team members', value: String(activeTechnicians.length) },
          { icon: 'review' as const, label: 'Available now', value: String(availableTechnicians) },
          { icon: 'services' as const, label: 'Role titles', value: String(specialtyCount) },
        ].map((item) => (
          <article
            key={item.label}
            style={{
              background: '#ffffff',
              borderRadius: 22,
              padding: 18,
              border: '1px solid rgba(113, 70, 90, 0.12)',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ color: '#876470', fontWeight: 700, fontSize: 13 }}>{item.label}</div>
              <OwnerMotionIcon name={item.icon} size={36} />
            </div>
            <div style={{ color: '#24171b', fontSize: 30, fontWeight: 800, marginTop: 6 }}>
              {item.value}
            </div>
          </article>
        ))}
      </div>

      <div
        style={{
          background: '#ffffff',
          borderRadius: 28,
          padding: 20,
          border: '1px solid rgba(113, 70, 90, 0.14)',
          boxShadow: '0 18px 40px rgba(51, 36, 41, 0.06)',
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
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <OwnerMotionIcon name="team" size={48} />
            <div>
              <p
                style={{
                  margin: 0,
                  color: '#9e5870',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                Salon team
              </p>
              <h3 style={{ margin: '8px 0 0', fontSize: 24, color: '#24171b' }}>
                {activeBusiness.name} team roster
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              updateActiveTechnicians((current) => [...current, createDraftTechnician(activeBusiness)]);
            }}
            style={{
              border: '1px solid rgba(113, 70, 90, 0.14)',
              background: '#f8efee',
              color: '#7e4c59',
              borderRadius: 999,
              padding: '8px 12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            >
            Add team member
          </button>
        </div>

        {activeTechnicians.length > 0 ? (
          activeTechnicians.map((technician, index) => (
            <div
              key={technician.id}
              style={{
                display: 'grid',
                gap: 10,
                background: technician.isActive ? '#fcf7f5' : '#f4efec',
                borderRadius: 20,
                padding: 16,
                border: '1px solid rgba(113, 70, 90, 0.12)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      border: '1px solid rgba(113, 70, 90, 0.14)',
                      background: technician.avatarUrl
                        ? `center / cover no-repeat url(${technician.avatarUrl})`
                        : 'linear-gradient(135deg, #f4ddd3, #fdf7f2)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#7e4c59',
                      fontSize: 24,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {!technician.avatarUrl ? technician.name.trim().slice(0, 1).toUpperCase() || 'T' : null}
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ color: '#24171b', fontSize: 16, fontWeight: 800 }}>
                      {technician.name}
                    </div>
                    <div style={{ color: '#756067', fontSize: 13 }}>
                      {technician.title?.trim() || 'Team member profile'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    pendingAvatarTechnicianIdRef.current = technician.id;
                    technicianAvatarInputRef.current?.click();
                  }}
                  disabled={uploadingTechnicianId !== null}
                  style={{
                    border: '1px solid rgba(113, 70, 90, 0.14)',
                    background: '#ffffff',
                    color: '#756067',
                    borderRadius: 999,
                    padding: '8px 12px',
                    cursor: uploadingTechnicianId !== null ? 'wait' : 'pointer',
                    fontWeight: 800,
                  }}
                >
                  {uploadingTechnicianId === technician.id ? 'Uploading avatar...' : 'Upload avatar'}
                </button>
              </div>

              <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
                Team member avatar URL
                <input
                  value={technician.avatarUrl ?? ''}
                  placeholder="https://..."
                  onChange={(event) => {
                    const value = event.target.value;
                    updateActiveTechnicians((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, avatarUrl: value } : item,
                      ),
                    );
                  }}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(113, 70, 90, 0.14)',
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 10,
                }}
              >
                <input
                  value={technician.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateActiveTechnicians((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: value } : item,
                      ),
                    );
                  }}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(113, 70, 90, 0.14)',
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
                <input
                  value={technician.title ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateActiveTechnicians((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, title: value } : item,
                      ),
                    );
                  }}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(113, 70, 90, 0.14)',
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#6d5060' }}>
                  <input
                    type="checkbox"
                    checked={technician.isActive}
                    onChange={(event) => {
                      const value = event.target.checked;
                      updateActiveTechnicians((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, isActive: value } : item,
                        ),
                      );
                    }}
                  />
                  Available for bookings
                </label>

                <button
                  type="button"
                  onClick={() => {
                    updateActiveTechnicians((current) =>
                      current.filter((item) => item.id !== technician.id),
                    );
                  }}
                  style={{
                    border: '1px solid rgba(113, 70, 90, 0.14)',
                    background: '#ffffff',
                    color: '#756067',
                    borderRadius: 999,
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {isDraftTechnician(technician.id) ? 'Drop draft' : 'Remove team member'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              borderRadius: 20,
              padding: 16,
              background: '#fbf7f4',
              border: '1px dashed rgba(113, 70, 90, 0.2)',
              color: '#6f5961',
              lineHeight: 1.7,
            }}
          >
            No team members have been added for this salon yet. Add the roster here so it stays
            separate from the salon profile settings.
          </div>
        )}
      </div>
    </section>
  );
}
