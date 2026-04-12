'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type {
  OwnerBusinessProfile,
  OwnerBusinessUpdateInput,
  OwnerServiceSummary,
  PromotionSummary,
} from '@beauty-finder/types';
import {
  OwnerMotionIcon,
  type OwnerMotionIconName,
} from './owner-motion-icon';
import {
  maxOwnerImageUploadSizeBytes,
  previewOwnerBusinessesStorageKey,
  saveOwnerBusinessProfile,
  uploadOwnerBusinessImage,
} from '../lib/owner-api';

type MediaUploadTarget = 'hero' | 'gallery' | 'logo' | 'banner' | 'ownerAvatar';

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

function createDraftId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDraftService(businessId: string): OwnerServiceSummary {
  return {
    id: createDraftId('draft-service'),
    businessId,
    name: '',
    description: '',
    durationMinutes: 60,
    price: 0,
    isActive: true,
  };
}

function isDraftId(id: string) {
  return id.startsWith('draft-');
}

function isUploadableImageFile(file: File) {
  if (file.type.startsWith('image/')) {
    return true;
  }

  return /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

function getMediaTargetLabel(target: MediaUploadTarget) {
  switch (target) {
    case 'hero':
      return 'hero image';
    case 'gallery':
      return 'gallery image';
    case 'logo':
      return 'business logo';
    case 'banner':
      return 'business banner';
    case 'ownerAvatar':
      return 'owner avatar';
    default:
      return 'image';
  }
}

const mediaActionButtonStyle = {
  border: '1px solid rgba(113, 70, 90, 0.14)',
  borderRadius: 999,
  padding: '8px 12px',
  fontWeight: 800,
} as const;

const serviceFieldStyle = {
  display: 'grid',
  gap: 6,
  color: '#64545a',
  fontWeight: 700,
  fontSize: 13,
} as const;

const studioCardStyle = {
  background: '#ffffff',
  borderRadius: 28,
  padding: 20,
  border: '1px solid rgba(113, 70, 90, 0.14)',
  boxShadow: '0 18px 40px rgba(51, 36, 41, 0.06)',
  display: 'grid',
  gap: 14,
} as const;

function getServiceValidationIssues(service: Pick<OwnerServiceSummary, 'name' | 'description' | 'price'>) {
  const issues = [] as string[];

  if (!service.name.trim()) {
    issues.push('service name');
  }

  if (!Number.isFinite(Number(service.price)) || Number(service.price) <= 0) {
    issues.push('price');
  }

  if (!service.description?.trim()) {
    issues.push('service details');
  }

  return issues;
}

function formatValidationIssueList(issues: string[]) {
  if (issues.length <= 1) {
    return issues[0] ?? '';
  }

  if (issues.length === 2) {
    return `${issues[0]} and ${issues[1]}`;
  }

  return `${issues.slice(0, -1).join(', ')}, and ${issues.at(-1)}`;
}

function getBusinessValidationMessage(business: OwnerBusinessProfile) {
  for (const [index, service] of business.services.entries()) {
    const issues = getServiceValidationIssues(service);

    if (issues.length === 0) {
      continue;
    }

    const serviceLabel = service.name.trim() || `Service ${index + 1}`;
    return `${serviceLabel} is missing ${formatValidationIssueList(issues)}.`;
  }

  return null;
}

function buildUpdatePayload(business: OwnerBusinessProfile): OwnerBusinessUpdateInput {
  const trimmedPromotionTitle = business.promotion?.title.trim();
  const promotion: PromotionSummary | null =
    trimmedPromotionTitle || business.promotion?.discountPercent
      ? {
          title: trimmedPromotionTitle ?? '',
          description: business.promotion?.description?.trim() || undefined,
          discountPercent: business.promotion?.discountPercent ?? 0,
          code: business.promotion?.code?.trim() || undefined,
          expiresAt: business.promotion?.expiresAt || undefined,
        }
      : null;

  return {
    name: business.name.trim(),
    description: business.description.trim(),
    heroImage: business.heroImage.trim() || undefined,
    businessLogo: business.businessLogo?.trim() || undefined,
    businessBanner: business.businessBanner?.trim() || undefined,
    ownerAvatar: business.ownerAvatar?.trim() || undefined,
    galleryImages: business.galleryImages.map((url) => url.trim()).filter(Boolean),
    videoUrl: business.videoUrl?.trim() || undefined,
    promotion,
    services: business.services.map((service) => ({
      id: isDraftId(service.id) ? undefined : service.id,
      name: service.name.trim(),
      description: service.description?.trim() || undefined,
      durationMinutes: Math.max(15, Number(service.durationMinutes) || 15),
      price: Math.max(0, Number(service.price) || 0),
      isActive: service.isActive,
    })),
  };
}

export function OwnerBusinessWorkspace({
  initialBusinesses,
  previewMode = false,
}: {
  initialBusinesses: OwnerBusinessProfile[];
  previewMode?: boolean;
}) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [selectedBusinessId, setSelectedBusinessId] = useState(initialBusinesses[0]?.id ?? '');
  const hasMultipleBusinesses = initialBusinesses.length > 1;
  const [statusMessage, setStatusMessage] = useState(
    initialBusinesses.length > 0
      ? previewMode
        ? 'Preview mode is active. Add services and save this salon locally on this device.'
        : 'Edit this salon profile, logo, banner, owner avatar, pricing, media, and promotions here. Team roster is managed separately below.'
      : 'No salon is linked to this owner account yet.',
  );
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null);
  const [uploadingMediaTarget, setUploadingMediaTarget] = useState<MediaUploadTarget | null>(
    null,
  );
  const [servicePriceInputs, setServicePriceInputs] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const hasHydratedPreviewBusinessesRef = useRef(false);
  const heroImageInputRef = useRef<HTMLInputElement | null>(null);
  const galleryImageInputRef = useRef<HTMLInputElement | null>(null);
  const logoImageInputRef = useRef<HTMLInputElement | null>(null);
  const bannerImageInputRef = useRef<HTMLInputElement | null>(null);
  const ownerAvatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!previewMode || typeof window === 'undefined') {
      return;
    }

    const storedBusinesses = window.localStorage.getItem(previewOwnerBusinessesStorageKey);

    if (!storedBusinesses) {
      hasHydratedPreviewBusinessesRef.current = true;
      return;
    }

    try {
      const parsedBusinesses = JSON.parse(storedBusinesses) as OwnerBusinessProfile[];

      if (!Array.isArray(parsedBusinesses) || parsedBusinesses.length === 0) {
        hasHydratedPreviewBusinessesRef.current = true;
        return;
      }

      setBusinesses(parsedBusinesses);
      setSelectedBusinessId((current) =>
        parsedBusinesses.some((business) => business.id === current)
          ? current
          : parsedBusinesses[0]?.id ?? '',
      );
      setStatusMessage('Loaded your saved preview changes for this salon.');
    } catch {
      window.localStorage.removeItem(previewOwnerBusinessesStorageKey);
    } finally {
      hasHydratedPreviewBusinessesRef.current = true;
    }
  }, [previewMode]);

  useEffect(() => {
    if (
      !previewMode ||
      typeof window === 'undefined' ||
      !hasHydratedPreviewBusinessesRef.current
    ) {
      return;
    }

    window.localStorage.setItem(previewOwnerBusinessesStorageKey, JSON.stringify(businesses));
  }, [businesses, previewMode]);

  useEffect(() => {
    setServicePriceInputs((current) => {
      const next = {} as Record<string, string>;

      for (const business of businesses) {
        for (const service of business.services) {
          next[service.id] = current[service.id] ?? (service.price > 0 ? String(service.price) : '');
        }
      }

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);

      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === next[key])
      ) {
        return current;
      }

      return next;
    });
  }, [businesses]);

  const activeBusiness =
    businesses.find((business) => business.id === selectedBusinessId) ?? businesses[0];

  function updateBusiness(
    businessId: string,
    updater: (business: OwnerBusinessProfile) => OwnerBusinessProfile,
  ) {
    setBusinesses((current) =>
      current.map((business) => (business.id === businessId ? updater(business) : business)),
    );
  }

  function updateActiveBusiness(updater: (business: OwnerBusinessProfile) => OwnerBusinessProfile) {
    if (!activeBusiness) {
      return;
    }

    updateBusiness(activeBusiness.id, updater);
  }

  function selectGalleryImageAsHero(url: string) {
    const nextHeroImage = url.trim();

    if (!nextHeroImage) {
      setStatusMessage('Choose or upload a gallery image before selecting it as the hero image.');
      return;
    }

    updateActiveBusiness((business) => ({ ...business, heroImage: nextHeroImage }));
    setStatusMessage('Hero image selected from the gallery. Save media changes to persist it.');
  }

  function removeGalleryImage(index: number) {
    if (!activeBusiness) {
      return;
    }

    const removedUrl = activeBusiness.galleryImages[index]?.trim() ?? '';
    const wasHeroImage = removedUrl.length > 0 && activeBusiness.heroImage.trim() === removedUrl;

    updateActiveBusiness((business) => {
      const nextGalleryImages = business.galleryImages.filter((_, itemIndex) => itemIndex !== index);
      const nextHeroImage = wasHeroImage
        ? nextGalleryImages.map((url) => url.trim()).find(Boolean) ?? ''
        : business.heroImage;

      return {
        ...business,
        galleryImages: nextGalleryImages,
        heroImage: nextHeroImage,
      };
    });

    setStatusMessage(
      wasHeroImage
        ? 'The selected hero image was removed from the gallery. Save media changes to persist the next hero choice.'
        : 'Gallery image removed. Save media changes to persist it.',
    );
  }

  async function persistBusiness(
    business: OwnerBusinessProfile,
    successMessage: string,
    fallbackMessage: string,
  ) {
    setSavingBusinessId(business.id);
    const updated = await saveOwnerBusinessProfile(business.id, buildUpdatePayload(business));

    if (updated) {
      setBusinesses((current) =>
        current.map((currentBusiness) => (currentBusiness.id === updated.id ? updated : currentBusiness)),
      );
      setStatusMessage(successMessage);
    } else {
      setStatusMessage(fallbackMessage);
    }

    setSavingBusinessId(null);
    return updated;
  }

  async function saveActiveBusiness() {
    if (!activeBusiness) {
      return;
    }

    const validationMessage = getBusinessValidationMessage(activeBusiness);

    if (validationMessage) {
      setStatusMessage(validationMessage);
      return;
    }

    setStatusMessage(`Saving ${activeBusiness.name}...`);

    startTransition(() => {
      void (async () => {
        await persistBusiness(
          activeBusiness,
          `${activeBusiness.name} was saved to the owner API. Services, media, and promotion details are in sync.`,
          previewMode
            ? `${activeBusiness.name} was saved locally in preview mode. Reload will keep your added services and owner edits on this device.`
            : `${activeBusiness.name} was updated locally in preview mode. Start the API to persist these owner changes.`,
        );
      })();
    });
  }

  async function uploadImageFromDevice(target: MediaUploadTarget, file?: File | null) {
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

    const businessId = activeBusiness.id;
    const businessName = activeBusiness.name;
    const targetLabel = getMediaTargetLabel(target);
    setUploadingMediaTarget(target);
    setStatusMessage(`Uploading ${targetLabel} for ${businessName}...`);

    const uploadedUrl = await uploadOwnerBusinessImage(businessId, file);

    if (uploadedUrl) {
      const baseBusiness = activeBusiness;
      const nextBusiness = (() => {
        switch (target) {
          case 'hero':
            return { ...baseBusiness, heroImage: uploadedUrl };
          case 'gallery':
            return {
              ...baseBusiness,
              galleryImages: [...baseBusiness.galleryImages, uploadedUrl],
              heroImage: baseBusiness.heroImage.trim() || uploadedUrl,
            };
          case 'logo':
            return { ...baseBusiness, businessLogo: uploadedUrl };
          case 'banner':
            return { ...baseBusiness, businessBanner: uploadedUrl };
          case 'ownerAvatar':
            return { ...baseBusiness, ownerAvatar: uploadedUrl };
          default:
            return baseBusiness;
        }
      })();
      updateBusiness(businessId, () => nextBusiness);
      setStatusMessage(`Saving ${businessName} after upload...`);

      await persistBusiness(
        nextBusiness,
        `${businessName} ${targetLabel} was uploaded and saved.`,
        `${businessName} ${targetLabel} was uploaded, but the business profile was not saved. Click Save owner changes to persist it.`,
      );
    } else {
      setStatusMessage(`Could not upload the ${targetLabel} right now.`);
    }

    setUploadingMediaTarget(null);
  }

  if (!activeBusiness) {
    return null;
  }

  const activeServices = activeBusiness.services.filter((service) => service.isActive).length;

  return (
    <section
      style={{
        background: 'linear-gradient(180deg, #fdf9f6, #f8f2ee)',
        borderRadius: 34,
        padding: 26,
        border: '1px solid rgba(113, 70, 90, 0.14)',
        boxShadow: '0 24px 56px rgba(51, 36, 41, 0.08)',
        display: 'grid',
        gap: 20,
      }}
    >
      <input
        ref={heroImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          void uploadImageFromDevice('hero', file);
          event.currentTarget.value = '';
        }}
        style={{ display: 'none' }}
      />
      <input
        ref={galleryImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          void uploadImageFromDevice('gallery', file);
          event.currentTarget.value = '';
        }}
        style={{ display: 'none' }}
      />
      <input
        ref={logoImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          void uploadImageFromDevice('logo', file);
          event.currentTarget.value = '';
        }}
        style={{ display: 'none' }}
      />
      <input
        ref={bannerImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          void uploadImageFromDevice('banner', file);
          event.currentTarget.value = '';
        }}
        style={{ display: 'none' }}
      />
      <input
        ref={ownerAvatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          void uploadImageFromDevice('ownerAvatar', file);
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
          <OwnerMotionIcon name="listings" size={58} />
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
            Salon workspace
          </p>
          <h2 style={{ margin: 0, fontSize: 32, color: '#24171b', lineHeight: 1.12 }}>
            Update this salon profile, services, media, and promos from one place
          </h2>
          <p style={{ margin: 0, color: '#6f5961', lineHeight: 1.7 }}>
            {hasMultipleBusinesses
              ? 'Pick the salon you want to edit, tune its service list, refresh gallery URLs, add a video reel, and push a promotion without leaving the owner dashboard. Team records live in a separate desk.'
              : 'Tune the service list, refresh gallery URLs, add a video reel, and push a promotion without leaving the owner dashboard. Team records live in a separate desk.'}
          </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void saveActiveBusiness();
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
            minWidth: 170,
          }}
        >
          {savingBusinessId === activeBusiness.id ? 'Saving...' : 'Save salon changes'}
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
        {statusMessage}
      </div>

      {hasMultipleBusinesses ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {businesses.map((business) => (
            <button
              key={business.id}
              type="button"
              onClick={() => {
                setSelectedBusinessId(business.id);
                setStatusMessage(`Editing ${business.name}.`);
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
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    border: '1px solid rgba(113, 70, 90, 0.12)',
                    background: business.businessLogo
                      ? `center / cover no-repeat url(${business.businessLogo})`
                      : 'linear-gradient(135deg, #f4ddd3, #fdf7f2)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#7e4c59',
                    fontWeight: 900,
                    fontSize: 14,
                    overflow: 'hidden',
                  }}
                >
                  {!business.businessLogo ? business.name.slice(0, 1).toUpperCase() : null}
                </div>
                <span style={{ fontWeight: 800, color: '#24171b', fontSize: 15 }}>{business.name}</span>
              </div>
              <span style={{ color: '#756067', fontSize: 12 }}>
                {business.city}, {business.state}
              </span>
              <span
                style={{
                  justifySelf: 'start',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 800,
                  ...businessStatusStyles[business.status],
                }}
              >
                {businessStatusLabels[business.status]}
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
          {
            icon: 'services' as OwnerMotionIconName,
            label: 'Active services',
            value: String(activeServices),
          },
          {
            icon: 'gallery' as OwnerMotionIconName,
            label: 'Gallery images',
            value: String(activeBusiness.galleryImages.length),
          },
          {
            icon: 'promotion' as OwnerMotionIconName,
            label: 'Discount live',
            value: activeBusiness.promotion ? `${activeBusiness.promotion.discountPercent}%` : 'Off',
          },
          {
            icon: 'listings' as OwnerMotionIconName,
            label: 'Listing status',
            value: businessStatusLabels[activeBusiness.status],
          },
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
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 18,
        }}
      >
        <article
          style={studioCardStyle}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <OwnerMotionIcon name="gallery" size={48} />
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
              Media Room
            </p>
            <h3 style={{ margin: '8px 0 0', fontSize: 24, color: '#24171b' }}>
              Brand media, gallery, and video
            </h3>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.6fr) repeat(2, minmax(120px, 1fr))',
              gap: 12,
            }}
          >
            <div
              style={{
                minHeight: 140,
                borderRadius: 22,
                border: '1px solid #f0cad8',
                background: activeBusiness.businessBanner
                  ? `linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04)), center / cover no-repeat url(${activeBusiness.businessBanner})`
                  : 'linear-gradient(135deg, #f2dfd8, #fdf7f4)',
                display: 'grid',
                alignContent: 'end',
                padding: 16,
                color: '#fffaf8',
                overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Business banner
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
                {activeBusiness.name}
              </div>
            </div>

            <div
              style={{
                minHeight: 140,
                borderRadius: 22,
                border: '1px solid #f0cad8',
                background: '#fffaf8',
                display: 'grid',
                placeItems: 'center',
                gap: 10,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 24,
                  border: '1px solid rgba(113, 70, 90, 0.14)',
                  background: activeBusiness.businessLogo
                    ? `center / cover no-repeat url(${activeBusiness.businessLogo})`
                    : 'linear-gradient(135deg, #f4ddd3, #fdf7f2)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#7e4c59',
                  fontSize: 28,
                  fontWeight: 900,
                }}
              >
                {!activeBusiness.businessLogo
                  ? activeBusiness.name.slice(0, 1).toUpperCase()
                  : null}
              </div>
              <div style={{ color: '#6d5060', fontSize: 12, fontWeight: 800 }}>Business logo</div>
            </div>

            <div
              style={{
                minHeight: 140,
                borderRadius: 22,
                border: '1px solid #f0cad8',
                background: '#fffaf8',
                display: 'grid',
                placeItems: 'center',
                gap: 10,
                padding: 16,
              }}
            >
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: '50%',
                  border: '1px solid rgba(113, 70, 90, 0.14)',
                  background: activeBusiness.ownerAvatar
                    ? `center / cover no-repeat url(${activeBusiness.ownerAvatar})`
                    : 'linear-gradient(135deg, #f4ddd3, #fdf7f2)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#7e4c59',
                  fontSize: 28,
                  fontWeight: 900,
                }}
              >
                {!activeBusiness.ownerAvatar ? 'O' : null}
              </div>
              <div style={{ color: '#6d5060', fontSize: 12, fontWeight: 800 }}>Owner avatar</div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Business logo URL
              <input
                value={activeBusiness.businessLogo ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  updateActiveBusiness((business) => ({ ...business, businessLogo: value || undefined }));
                }}
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                onClick={() => {
                  logoImageInputRef.current?.click();
                }}
                disabled={uploadingMediaTarget !== null}
                style={{
                  background: '#f8efee',
                  color: '#7e4c59',
                  ...mediaActionButtonStyle,
                  cursor: uploadingMediaTarget !== null ? 'wait' : 'pointer',
                }}
              >
                {uploadingMediaTarget === 'logo' ? 'Uploading logo...' : 'Upload logo'}
              </button>
            </label>

            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Business banner URL
              <input
                value={activeBusiness.businessBanner ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  updateActiveBusiness((business) => ({ ...business, businessBanner: value || undefined }));
                }}
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                onClick={() => {
                  bannerImageInputRef.current?.click();
                }}
                disabled={uploadingMediaTarget !== null}
                style={{
                  background: '#f8efee',
                  color: '#7e4c59',
                  ...mediaActionButtonStyle,
                  cursor: uploadingMediaTarget !== null ? 'wait' : 'pointer',
                }}
              >
                {uploadingMediaTarget === 'banner' ? 'Uploading banner...' : 'Upload banner'}
              </button>
            </label>

            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Owner avatar URL
              <input
                value={activeBusiness.ownerAvatar ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  updateActiveBusiness((business) => ({ ...business, ownerAvatar: value || undefined }));
                }}
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                onClick={() => {
                  ownerAvatarInputRef.current?.click();
                }}
                disabled={uploadingMediaTarget !== null}
                style={{
                  background: '#f8efee',
                  color: '#7e4c59',
                  ...mediaActionButtonStyle,
                  cursor: uploadingMediaTarget !== null ? 'wait' : 'pointer',
                }}
              >
                {uploadingMediaTarget === 'ownerAvatar'
                  ? 'Uploading avatar...'
                  : 'Upload owner avatar'}
              </button>
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
            Hero image URL
            <input
              value={activeBusiness.heroImage}
              onChange={(event) => {
                const value = event.target.value;
                updateActiveBusiness((business) => ({ ...business, heroImage: value }));
              }}
              style={{
                borderRadius: 14,
                border: '1px solid #f0cad8',
                padding: '10px 12px',
                fontSize: 14,
              }}
            />
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                heroImageInputRef.current?.click();
              }}
              disabled={uploadingMediaTarget !== null}
              style={{
                background: '#f8efee',
                color: '#7e4c59',
                ...mediaActionButtonStyle,
                cursor: uploadingMediaTarget !== null ? 'wait' : 'pointer',
              }}
            >
              {uploadingMediaTarget === 'hero' ? 'Uploading hero...' : 'Change hero from device'}
            </button>
            <button
              type="button"
              onClick={() => {
                void saveActiveBusiness();
              }}
              disabled={isPending || savingBusinessId === activeBusiness.id}
              style={{
                background: '#ffffff',
                color: '#64545a',
                ...mediaActionButtonStyle,
                cursor:
                  isPending || savingBusinessId === activeBusiness.id ? 'wait' : 'pointer',
              }}
            >
              {savingBusinessId === activeBusiness.id ? 'Saving media...' : 'Save media changes'}
            </button>
            <span style={{ color: '#8e657b', fontSize: 12 }}>
              Paste a URL, upload from this computer, or pick one from the gallery below.
            </span>
          </div>

          <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
            Video URL
            <input
              value={activeBusiness.videoUrl ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                updateActiveBusiness((business) => ({
                  ...business,
                  videoUrl: value || undefined,
                }));
              }}
              style={{
                borderRadius: 14,
                border: '1px solid #f0cad8',
                padding: '10px 12px',
                fontSize: 14,
              }}
            />
          </label>

          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ color: '#6d5060', fontWeight: 800 }}>Gallery images</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    updateActiveBusiness((business) => ({
                      ...business,
                      galleryImages: [...business.galleryImages, ''],
                    }));
                  }}
                  style={{
                    background: '#f8efee',
                    color: '#7e4c59',
                    ...mediaActionButtonStyle,
                    cursor: 'pointer',
                  }}
                >
                  Add URL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    galleryImageInputRef.current?.click();
                  }}
                  disabled={uploadingMediaTarget !== null}
                  style={{
                    background: '#ffffff',
                    color: '#64545a',
                    ...mediaActionButtonStyle,
                    cursor: uploadingMediaTarget !== null ? 'wait' : 'pointer',
                  }}
                >
                  {uploadingMediaTarget === 'gallery'
                    ? 'Uploading gallery...'
                    : 'Add from device'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void saveActiveBusiness();
                  }}
                  disabled={isPending || savingBusinessId === activeBusiness.id}
                  style={{
                    background: '#f8efee',
                    color: '#7e4c59',
                    ...mediaActionButtonStyle,
                    cursor:
                      isPending || savingBusinessId === activeBusiness.id ? 'wait' : 'pointer',
                  }}
                >
                  {savingBusinessId === activeBusiness.id ? 'Saving...' : 'Save gallery changes'}
                </button>
              </div>
            </div>

            {activeBusiness.galleryImages.map((url, index) => {
              const normalizedUrl = url.trim();
              const isHeroImage =
                normalizedUrl.length > 0 && activeBusiness.heroImage.trim() === normalizedUrl;

              return (
              <div key={`${activeBusiness.id}-gallery-${index}`} style={{ display: 'flex', gap: 10 }}>
                <input
                  value={url}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    updateActiveBusiness((business) => ({
                      ...business,
                      galleryImages: business.galleryImages.map((item, itemIndex) =>
                        itemIndex === index ? nextValue : item,
                      ),
                    }));
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    border: '1px solid #f0cad8',
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    selectGalleryImageAsHero(normalizedUrl);
                  }}
                  disabled={!normalizedUrl || isHeroImage}
                  style={{
                    border: isHeroImage ? '1px solid transparent' : '1px solid #f0cad8',
                    background: isHeroImage ? '#ff5f98' : '#fff',
                    color: isHeroImage ? '#fffafc' : '#8e657b',
                    borderRadius: 14,
                    padding: '10px 12px',
                    cursor: !normalizedUrl || isHeroImage ? 'default' : 'pointer',
                    fontWeight: 700,
                  }}
                >
                  {isHeroImage ? 'Hero image' : 'Use as hero'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeGalleryImage(index);
                  }}
                  style={{
                    border: '1px solid #f0cad8',
                    background: '#fff',
                    color: '#8e657b',
                    borderRadius: 14,
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
              );
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 10,
            }}
          >
            {activeBusiness.galleryImages.filter(Boolean).slice(0, 6).map((url, index) => {
              const normalizedUrl = url.trim();
              const isHeroImage =
                normalizedUrl.length > 0 && activeBusiness.heroImage.trim() === normalizedUrl;

              return (
              <div
                key={`${url}-${index}`}
                style={{
                  position: 'relative',
                  minHeight: 94,
                  borderRadius: 18,
                  backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02)), url(${url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: '1px solid #f0cad8',
                }}
              >
                {isHeroImage ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      borderRadius: 999,
                      padding: '4px 8px',
                      background: 'rgba(255, 95, 152, 0.92)',
                      color: '#fffafc',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    Hero
                  </span>
                ) : null}
              </div>
              );
            })}
          </div>
        </article>

        <article
          style={studioCardStyle}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <OwnerMotionIcon name="promotion" size={48} />
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
              Promotion Desk
            </p>
            <h3 style={{ margin: '8px 0 0', fontSize: 24, color: '#24171b' }}>
              Discount and offer setup
            </h3>
            </div>
          </div>

          <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
            Promotion title
            <input
              value={activeBusiness.promotion?.title ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                updateActiveBusiness((business) => ({
                  ...business,
                  promotion: {
                    title: value,
                    description: business.promotion?.description,
                    discountPercent: business.promotion?.discountPercent ?? 0,
                    code: business.promotion?.code,
                    expiresAt: business.promotion?.expiresAt,
                  },
                }));
              }}
              style={{
                borderRadius: 14,
                border: '1px solid #f0cad8',
                padding: '10px 12px',
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
            Promotion notes
            <textarea
              value={activeBusiness.promotion?.description ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                updateActiveBusiness((business) => ({
                  ...business,
                  promotion: {
                    title: business.promotion?.title ?? '',
                    description: value,
                    discountPercent: business.promotion?.discountPercent ?? 0,
                    code: business.promotion?.code,
                    expiresAt: business.promotion?.expiresAt,
                  },
                }));
              }}
              rows={4}
              style={{
                borderRadius: 18,
                border: '1px solid #f0cad8',
                padding: '12px 14px',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Discount %
              <input
                type="number"
                min={0}
                max={100}
                value={activeBusiness.promotion?.discountPercent ?? 0}
                onChange={(event) => {
                  const value = Number(event.target.value) || 0;
                  updateActiveBusiness((business) => ({
                    ...business,
                    promotion: {
                      title: business.promotion?.title ?? '',
                      description: business.promotion?.description,
                      discountPercent: value,
                      code: business.promotion?.code,
                      expiresAt: business.promotion?.expiresAt,
                    },
                  }));
                }}
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Promo code
              <input
                value={activeBusiness.promotion?.code ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  updateActiveBusiness((business) => ({
                    ...business,
                    promotion: {
                      title: business.promotion?.title ?? '',
                      description: business.promotion?.description,
                      discountPercent: business.promotion?.discountPercent ?? 0,
                      code: value,
                      expiresAt: business.promotion?.expiresAt,
                    },
                  }));
                }}
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
              Ends on
              <input
                type="date"
                value={activeBusiness.promotion?.expiresAt?.slice(0, 10) ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  updateActiveBusiness((business) => ({
                    ...business,
                    promotion: {
                      title: business.promotion?.title ?? '',
                      description: business.promotion?.description,
                      discountPercent: business.promotion?.discountPercent ?? 0,
                      code: business.promotion?.code,
                      expiresAt: value ? new Date(`${value}T23:59:59.000Z`).toISOString() : undefined,
                    },
                  }));
                }}
                style={{
                  borderRadius: 14,
                  border: '1px solid #f0cad8',
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
            </label>
          </div>
        </article>

        <article
          style={studioCardStyle}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <OwnerMotionIcon name="services" size={48} />
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
                Services
              </p>
              <h3 style={{ margin: '8px 0 0', fontSize: 24, color: '#24171b' }}>
                Edit services and pricing
              </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                updateActiveBusiness((business) => ({
                  ...business,
                  services: [...business.services, createDraftService(business.id)],
                }));
                setStatusMessage(
                  `Added a new service draft for ${activeBusiness.name}. Update it below, then click Save service changes.`,
                );
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
              Add service
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                void saveActiveBusiness();
              }}
              disabled={isPending || savingBusinessId === activeBusiness.id}
              style={{
                background: '#f8efee',
                color: '#7e4c59',
                ...mediaActionButtonStyle,
                cursor:
                  isPending || savingBusinessId === activeBusiness.id ? 'wait' : 'pointer',
              }}
            >
              {savingBusinessId === activeBusiness.id ? 'Saving services...' : 'Save service changes'}
            </button>
            <span style={{ color: '#8e657b', fontSize: 12 }}>
              Each service should include a name, price, and service details before you save.
            </span>
          </div>

          {activeBusiness.services.map((service, index) => (
            <div
              key={service.id}
              style={{
                display: 'grid',
                gap: 10,
                background: service.isActive ? '#fcf7f5' : '#f4efec',
                borderRadius: 20,
                padding: 16,
                border:
                  getServiceValidationIssues(service).length > 0
                    ? '1px solid #d77d86'
                    : '1px solid rgba(113, 70, 90, 0.12)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 10,
                }}
              >
                <label style={serviceFieldStyle}>
                  Service name
                  <input
                    value={service.name}
                    placeholder="Gel Manicure"
                    required
                    onChange={(event) => {
                      const value = event.target.value;
                      updateActiveBusiness((business) => ({
                        ...business,
                        services: business.services.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, name: value } : item,
                        ),
                      }));
                    }}
                    style={{
                      borderRadius: 14,
                      border:
                        !service.name.trim()
                          ? '1px solid #d77d86'
                          : '1px solid rgba(113, 70, 90, 0.14)',
                      padding: '10px 12px',
                      fontSize: 14,
                    }}
                  />
                </label>

                <label style={serviceFieldStyle}>
                  Duration
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={service.durationMinutes}
                    onChange={(event) => {
                      const value = Number(event.target.value) || 15;
                      updateActiveBusiness((business) => ({
                        ...business,
                        services: business.services.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, durationMinutes: value } : item,
                        ),
                      }));
                    }}
                    style={{
                      borderRadius: 14,
                      border: '1px solid rgba(113, 70, 90, 0.14)',
                      padding: '10px 12px',
                      fontSize: 14,
                    }}
                  />
                </label>

                <label style={serviceFieldStyle}>
                  Price
                  <input
                    type="text"
                    inputMode="decimal"
                    value={servicePriceInputs[service.id] ?? ''}
                    placeholder="55"
                    required
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      const normalizedValue = nextValue.trim();
                      const parsedValue =
                        normalizedValue === '' ? 0 : Number(normalizedValue.replaceAll(',', '.'));

                      setServicePriceInputs((current) => ({
                        ...current,
                        [service.id]: nextValue,
                      }));

                      updateActiveBusiness((business) => ({
                        ...business,
                        services: business.services.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                price: Number.isFinite(parsedValue) ? parsedValue : 0,
                              }
                            : item,
                        ),
                      }));
                    }}
                    style={{
                      borderRadius: 14,
                      border:
                        Number(service.price) <= 0
                          ? '1px solid #d77d86'
                          : '1px solid rgba(113, 70, 90, 0.14)',
                      padding: '10px 12px',
                      fontSize: 14,
                    }}
                  />
                </label>
              </div>

              <label style={serviceFieldStyle}>
                Service details
                <textarea
                  value={service.description ?? ''}
                  rows={3}
                  placeholder="Describe what is included in this service."
                  required
                  onChange={(event) => {
                    const value = event.target.value;
                    updateActiveBusiness((business) => ({
                      ...business,
                      services: business.services.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, description: value } : item,
                      ),
                    }));
                  }}
                  style={{
                    borderRadius: 16,
                    border:
                      !service.description?.trim()
                        ? '1px solid #d77d86'
                        : '1px solid rgba(113, 70, 90, 0.14)',
                    padding: '12px 14px',
                    fontSize: 14,
                    resize: 'vertical',
                    minHeight: 88,
                  }}
                />
              </label>

              {getServiceValidationIssues(service).length > 0 ? (
                <div
                  style={{
                    color: '#a03f34',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Required before save: {formatValidationIssueList(getServiceValidationIssues(service))}.
                </div>
              ) : null}

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
                    checked={service.isActive}
                    onChange={(event) => {
                      const value = event.target.checked;
                      updateActiveBusiness((business) => ({
                        ...business,
                        services: business.services.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, isActive: value } : item,
                        ),
                      }));
                    }}
                  />
                  Active listing
                </label>

                {isDraftId(service.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      updateActiveBusiness((business) => ({
                        ...business,
                        services: business.services.filter((item) => item.id !== service.id),
                      }));
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
                    Drop draft
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </article>

      </div>
    </section>
  );
}
