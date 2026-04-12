'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionPayload } from '@beauty-finder/types';
import {
  isAdminPreviewEnabled,
  previewAdminCredentials,
} from '../../lib/admin-api';

type PostJsonResult<T> = {
  data: T | null;
  errorMessage: string | null;
  status: number;
};

async function postJson<T>(path: string, body: unknown): Promise<PostJsonResult<T>> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    let errorMessage: string | null = null;

    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string | string[] };
        errorMessage = Array.isArray(parsed.message)
          ? parsed.message.join(' ')
          : parsed.message ?? text;
      } catch {
        errorMessage = text;
      }
    }

    return {
      data: null,
      errorMessage,
      status: response.status,
    };
  }

  return {
    data: JSON.parse(text) as T,
    errorMessage: null,
    status: response.status,
  };
}

function getDefaultStatusText(previewEnabled: boolean) {
  return previewEnabled
    ? 'Sign in with an admin account, or use the local preview admin flow while the API is offline.'
    : 'Sign in with an admin account to access moderation, pricing, homepage control, and account access tools.';
}

export default function AdminAuthPage() {
  const router = useRouter();
  const previewEnabled = isAdminPreviewEnabled();
  const [email, setEmail] = useState(previewEnabled ? previewAdminCredentials.email : '');
  const [password, setPassword] = useState(
    previewEnabled ? previewAdminCredentials.password : '',
  );
  const [pending, setPending] = useState(false);
  const [statusText, setStatusText] = useState(getDefaultStatusText(previewEnabled));

  async function handleSubmit() {
    if (pending) {
      return;
    }

    setPending(true);
    setStatusText('Signing you into the admin console...');

    try {
      const { data: session, errorMessage, status } = await postJson<SessionPayload>(
        '/api/auth/login',
        {
          email: email.trim(),
          password,
        },
      );

      if (!session) {
        setStatusText(
          errorMessage ??
            (status === 429
              ? 'Too many sign-in attempts. Wait a minute and retry.'
              : 'Admin sign-in failed. Check your email and password.'),
        );
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setStatusText('Could not reach the admin auth API right now.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 24,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <section
        style={{
          width: 'min(560px, 100%)',
          background: 'linear-gradient(180deg, #fffafc, #fff2f8)',
          borderRadius: 32,
          border: '1px solid #f0c7d8',
          boxShadow: '0 24px 56px rgba(212, 92, 139, 0.14)',
          padding: 28,
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
            Admin console
          </p>
          <h1 style={{ margin: 0, color: '#341b36', fontSize: 34, lineHeight: 1.08 }}>
            Sign in to the trust desk.
          </h1>
          <p style={{ margin: 0, color: '#6d5060', lineHeight: 1.7 }}>{statusText}</p>
          {previewEnabled ? (
            <p style={{ margin: 0, color: '#8d6378', lineHeight: 1.7 }}>
              Local preview sign in is available with `admin@beautyfinder.app` and password
              `mock-password`.
            </p>
          ) : null}
        </div>

        <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@beautyfinder.app"
            autoComplete="email"
            style={{
              borderRadius: 14,
              border: '1px solid #f0cad8',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6, color: '#6d5060', fontWeight: 700 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your admin password"
            autoComplete="current-password"
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
            void handleSubmit();
          }}
          disabled={pending}
          style={{
            border: 'none',
            background: '#ff6f9f',
            color: '#fff9fb',
            borderRadius: 999,
            padding: '14px 18px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {pending ? 'Signing in...' : 'Sign in'}
        </button>
      </section>
    </main>
  );
}
