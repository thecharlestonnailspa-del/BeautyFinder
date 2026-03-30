import type { NotificationRecord } from '@beauty-finder/types';

const apiBaseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000/api';
const ownerUserId = process.env.WORKER_OWNER_ID ?? 'user-owner-1';
const ownerEmail = process.env.WORKER_OWNER_EMAIL ?? 'lina@polishedstudio.app';
const ownerPassword = process.env.WORKER_OWNER_PASSWORD ?? 'mock-password';
let ownerToken = process.env.WORKER_OWNER_TOKEN?.trim();

async function getOwnerToken() {
  if (ownerToken) {
    return ownerToken;
  }

  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: ownerEmail,
      password: ownerPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(`Worker failed to log in for a JWT token: ${response.status}`);
  }

  const session = (await response.json()) as { accessToken?: string };
  if (!session.accessToken) {
    throw new Error('Worker login did not return an access token');
  }

  ownerToken = session.accessToken;
  return ownerToken;
}

async function fetchNotifications() {
  const activeOwnerToken = await getOwnerToken();
  const response = await fetch(`${apiBaseUrl}/notifications?userId=${ownerUserId}`, {
    headers: {
      Authorization: `Bearer ${activeOwnerToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Worker failed to fetch notifications: ${response.status}`);
  }

  return (await response.json()) as NotificationRecord[];
}

async function main() {
  try {
    const notifications = await fetchNotifications();

    console.log('[worker] Beauty Finder worker online');
    console.log(`[worker] API: ${apiBaseUrl}`);
    console.log(`[worker] Owner notifications queued: ${notifications.length}`);

    notifications.slice(0, 3).forEach((notification) => {
      console.log(
        `[worker] ${notification.type} -> ${notification.title} (${notification.createdAt})`,
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown worker error';
    console.warn(`[worker] ${message}`);
    console.log('[worker] Falling back to offline mode. Start the API to enable live polling.');
  }
}

void main();
