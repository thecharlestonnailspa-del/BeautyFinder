import type {
  OwnerBusinessProfile,
  OwnerBusinessUpdateInput,
  OwnerTechnicianInput,
  OwnerTechnicianProfile,
  SessionPayload,
  UserSummary,
} from '@beauty-finder/types';

export const ownerSessionCookieName = 'beauty-finder.owner-access-token';
export const maxOwnerImageUploadSizeBytes = 5 * 1024 * 1024;
export const previewOwnerToken = 'beauty-finder.owner-preview-session';
export const previewOwnerBusinessesStorageKey = 'beauty-finder.owner-preview-businesses';
export const previewOwnerTechniciansStorageKey = 'beauty-finder.owner-preview-technicians';
export const previewOwnerCredentials = {
  email: 'lina@polishedstudio.app',
  password: 'mock-password',
} as const;
export const previewOwnerUser: UserSummary = {
  id: 'user-owner-1',
  role: 'owner',
  name: 'Lina Nguyen',
  email: previewOwnerCredentials.email,
};

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function isOwnerPreviewEnabled() {
  const configuredValue = process.env.NEXT_PUBLIC_ENABLE_PREVIEW_MODE?.trim().toLowerCase();

  if (configuredValue === 'true') {
    return true;
  }

  if (configuredValue === 'false') {
    return false;
  }

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    return isLocalHostname(new URL(getApiBaseUrl()).hostname);
  } catch {
    return false;
  }
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api';
}

function getApiOrigin() {
  const fallbackOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000';

  try {
    return new URL(getApiBaseUrl(), fallbackOrigin).origin;
  } catch {
    return fallbackOrigin;
  }
}

function toApiAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return new URL(path, `${getApiOrigin()}/`).toString();
}

export function isPreviewOwnerToken(token?: string | null) {
  return isOwnerPreviewEnabled() && token === previewOwnerToken;
}

export function createPreviewOwnerSession(): SessionPayload {
  return {
    user: previewOwnerUser,
    permissions: ['owner:preview'],
    accessToken: previewOwnerToken,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  };
}

function getOwnerApiUrl(path: string, token?: string | null) {
  if (!token && typeof window !== 'undefined') {
    return `/api/backend${path}`;
  }

  return `${getApiBaseUrl()}${path}`;
}

export function getOwnerHeaders(includeJson = false, token?: string | null) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
  };
}

export async function fetchOwnerJson<T>(path: string, token?: string | null) {
  if (!token && typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(getOwnerApiUrl(path, token), {
      headers: getOwnerHeaders(false, token),
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function fetchAuthenticatedUser(token?: string | null) {
  return fetchOwnerJson<UserSummary>('/auth/me', token);
}

export async function saveOwnerBusinessProfile(
  businessId: string,
  input: OwnerBusinessUpdateInput,
  token?: string | null,
): Promise<OwnerBusinessProfile | null> {
  if (!token && typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(getOwnerApiUrl(`/businesses/${businessId}/owner-profile`, token), {
      method: 'PATCH',
      headers: getOwnerHeaders(true, token),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as OwnerBusinessProfile;
  } catch {
    return null;
  }
}

export async function fetchOwnerTechnicians(
  businessId: string,
  token?: string | null,
): Promise<OwnerTechnicianProfile[] | null> {
  if (!token && typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(getOwnerApiUrl(`/businesses/${businessId}/owner-technicians`, token), {
      headers: getOwnerHeaders(false, token),
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as OwnerTechnicianProfile[];
  } catch {
    return null;
  }
}

export async function saveOwnerTechnicianRoster(
  businessId: string,
  technicians: OwnerTechnicianInput[],
  token?: string | null,
): Promise<OwnerTechnicianProfile[] | null> {
  if (!token && typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(getOwnerApiUrl(`/businesses/${businessId}/owner-technicians`, token), {
      method: 'PUT',
      headers: getOwnerHeaders(true, token),
      body: JSON.stringify({
        technicians,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as OwnerTechnicianProfile[];
  } catch {
    return null;
  }
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('Could not read the selected file'));
        return;
      }

      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not read the selected file'));
    };

    reader.readAsDataURL(file);
  });
}

export async function uploadOwnerBusinessImage(
  businessId: string,
  file: File,
  token?: string | null,
) {
  if (!token && typeof window === 'undefined') {
    return null;
  }

  const base64 = await readFileAsBase64(file);

  try {
    const response = await fetch(getOwnerApiUrl(`/businesses/${businessId}/owner-media/image`, token), {
      method: 'PATCH',
      headers: getOwnerHeaders(true, token),
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || undefined,
        base64,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const uploaded = (await response.json()) as {
      path: string;
    };

    return toApiAssetUrl(uploaded.path);
  } catch {
    return null;
  }
}
