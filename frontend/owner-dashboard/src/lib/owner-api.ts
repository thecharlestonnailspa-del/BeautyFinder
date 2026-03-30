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

function getCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function getCookieMaxAge(expiresAt: string) {
  const expiresAtTimestamp = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtTimestamp)) {
    return 60 * 60 * 24 * 7;
  }

  return Math.max(0, Math.floor((expiresAtTimestamp - Date.now()) / 1000));
}

export function getStoredOwnerToken() {
  return getCookieValue(ownerSessionCookieName);
}

export function isPreviewOwnerToken(token?: string | null) {
  return token === previewOwnerToken;
}

export function createPreviewOwnerSession(): SessionPayload {
  return {
    user: previewOwnerUser,
    permissions: ['owner:preview'],
    accessToken: previewOwnerToken,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  };
}

export function saveOwnerSessionCookie(session: SessionPayload) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${ownerSessionCookieName}=${encodeURIComponent(session.accessToken)}; Path=/; Max-Age=${getCookieMaxAge(session.expiresAt)}; SameSite=Lax`;
}

export function clearOwnerSessionCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${ownerSessionCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getOwnerHeaders(includeJson = false, token?: string | null) {
  const resolvedToken = token ?? getStoredOwnerToken();

  return {
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
  };
}

export async function fetchOwnerJson<T>(path: string, token?: string | null) {
  const headers = getOwnerHeaders(false, token);

  if (!('Authorization' in headers)) {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers,
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
  const headers = getOwnerHeaders(true, token);

  if (!('Authorization' in headers)) {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/businesses/${businessId}/owner-profile`, {
      method: 'PATCH',
      headers,
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
  const headers = getOwnerHeaders(false, token);

  if (!('Authorization' in headers)) {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/businesses/${businessId}/owner-technicians`, {
      headers,
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
  const headers = getOwnerHeaders(true, token);

  if (!('Authorization' in headers)) {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/businesses/${businessId}/owner-technicians`, {
      method: 'PUT',
      headers,
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
  const headers = getOwnerHeaders(true, token);

  if (!('Authorization' in headers)) {
    return null;
  }

  const base64 = await readFileAsBase64(file);

  try {
    const response = await fetch(`${getApiBaseUrl()}/businesses/${businessId}/owner-media/image`, {
      method: 'PATCH',
      headers,
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
