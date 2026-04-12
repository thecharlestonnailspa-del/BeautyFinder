'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CSSProperties } from 'react';
import type {
  RegisterBusinessOwnerInput,
  SessionPayload,
} from '@beauty-finder/types';
import {
  isOwnerPreviewEnabled,
  previewOwnerCredentials,
} from '../../lib/owner-api';

async function postJson<T>(path: string, body: unknown) {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

function getDefaultStatusText(isRegister: boolean, previewEnabled: boolean) {
  if (!isRegister) {
    return previewEnabled
      ? 'Sign in with a salon owner account, or use the local preview owner flow while the API is offline.'
      : 'Sign in with a salon owner account through the live API for this environment.';
  }

  return 'Create a salon owner account with salon license, business license, EIN, and the full business profile saved into Postgres.';
}

function ProfessionalAuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams?.get('mode') === 'register' ? 'register' : 'login';
  const isRegister = mode === 'register';
  const previewEnabled = isOwnerPreviewEnabled();

  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(
    isRegister ? '' : previewEnabled ? previewOwnerCredentials.email : '',
  );
  const [password, setPassword] = useState(
    isRegister ? 'Beauty123' : previewEnabled ? previewOwnerCredentials.password : '',
  );
  const [ownerPhone, setOwnerPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState<'nail' | 'hair'>('nail');
  const [description, setDescription] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [salonLicenseNumber, setSalonLicenseNumber] = useState('');
  const [businessLicenseNumber, setBusinessLicenseNumber] = useState('');
  const [einNumber, setEinNumber] = useState('');

  const [statusText, setStatusText] = useState(
    getDefaultStatusText(isRegister, previewEnabled),
  );
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) {
      setStatusText(getDefaultStatusText(isRegister, previewEnabled));
    }
  }, [isRegister, pending, previewEnabled]);

  const pageTitle = useMemo(() => {
    if (!isRegister) {
      return 'Sign in to the salon owner workspace.';
    }

    return 'Register a salon owner business account.';
  }, [isRegister]);

  async function handleSubmit() {
    if (pending) {
      return;
    }

    setPending(true);
    setStatusText(!isRegister ? 'Signing you in...' : 'Creating salon owner account...');

    let path = '/auth/login';
    let payload:
      | RegisterBusinessOwnerInput
      | {
          email: string;
          password: string;
        };

    if (!isRegister) {
      payload = {
        email: ownerEmail.trim(),
        password,
      };
    } else {
      path = '/auth/register/business';
      payload = {
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        password,
        ownerPhone: ownerPhone.trim() || undefined,
        businessName: businessName.trim(),
        category,
        description: description.trim() || undefined,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        businessPhone: businessPhone.trim() || undefined,
        businessEmail: businessEmail.trim() || undefined,
        salonLicenseNumber: salonLicenseNumber.trim(),
        businessLicenseNumber: businessLicenseNumber.trim(),
        einNumber: einNumber.trim(),
      };
    }

    try {
      const session = await postJson<SessionPayload>(path, payload);

      if (!session) {
        setStatusText(
          !isRegister
            ? 'Sign in failed. Check your email and password.'
            : 'Salon owner registration failed. Check business profile and license fields.',
        );
        return;
      }

      if (session.user.role === 'owner') {
        router.replace('/');
        return;
      }

      setStatusText('That account is not mapped to salon owner access.');
    } catch {
      setStatusText('Could not reach the salon owner auth API right now.');
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
          width: 'min(980px, 100%)',
          background: 'linear-gradient(180deg, #fffafc, #fff4f8)',
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
            Salon Owner Auth
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: 40,
              lineHeight: 1.05,
              color: '#341b36',
            }}
          >
            {pageTitle}
          </h1>
          <p style={{ margin: 0, color: '#6d5060', lineHeight: 1.7 }}>
            {previewEnabled
              ? 'This workspace is only for salon owners. Local preview sign in still works with `lina@polishedstudio.app` and password `mock-password` while you are developing.'
              : 'This workspace is only for salon owners. This environment only accepts live API-backed sign-in.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="/auth?mode=login"
            style={{
              ...pillStyle,
              color: !isRegister ? '#ffffff' : '#805f72',
              background: !isRegister ? '#ff5f98' : '#fff',
              border: !isRegister ? '1px solid transparent' : '1px solid #f0cad8',
            }}
          >
            Sign In
          </a>
          <a
            href="/auth?mode=register"
            style={{
              ...pillStyle,
              color: isRegister ? '#ffffff' : '#805f72',
              background: isRegister ? '#ff5f98' : '#fff',
              border: isRegister ? '1px solid transparent' : '1px solid #f0cad8',
            }}
          >
            Register Salon Owner
          </a>
        </div>

        <div
          style={{
            background: '#fff0f6',
            color: '#6d5060',
            borderRadius: 20,
            padding: '14px 16px',
            lineHeight: 1.6,
            fontWeight: 600,
          }}
        >
          Salon owner registration keeps salon license, business license, and EIN separate from the
          editable salon profile.
        </div>

        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: isRegister ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr',
          }}
        >
          {!isRegister ? (
            <>
              <label style={fieldStyle}>
                <span>Email</span>
                <input
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={inputStyle}
                />
              </label>
            </>
          ) : null}

          {isRegister ? (
            <>
              <label style={fieldStyle}>
                <span>Owner name</span>
                <input
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Owner email</span>
                <input
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Owner phone</span>
                <input
                  value={ownerPhone}
                  onChange={(event) => setOwnerPhone(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Business name</span>
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as 'nail' | 'hair')}
                  style={inputStyle}
                >
                  <option value="nail">Nail</option>
                  <option value="hair">Hair</option>
                </select>
              </label>

              <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
                />
              </label>

              <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                <span>Address line 1</span>
                <input
                  value={addressLine1}
                  onChange={(event) => setAddressLine1(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                <span>Address line 2</span>
                <input
                  value={addressLine2}
                  onChange={(event) => setAddressLine2(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>City</span>
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>State</span>
                <input
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Postal code</span>
                <input
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Business phone</span>
                <input
                  value={businessPhone}
                  onChange={(event) => setBusinessPhone(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Business email</span>
                <input
                  value={businessEmail}
                  onChange={(event) => setBusinessEmail(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Salon license number</span>
                <input
                  value={salonLicenseNumber}
                  onChange={(event) => setSalonLicenseNumber(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Business license number</span>
                <input
                  value={businessLicenseNumber}
                  onChange={(event) => setBusinessLicenseNumber(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>EIN number</span>
                <input
                  value={einNumber}
                  onChange={(event) => setEinNumber(event.target.value)}
                  style={inputStyle}
                />
              </label>
            </>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={pending}
            style={{
              border: 'none',
              background: '#ff5f98',
              color: '#fffafc',
              borderRadius: 999,
              padding: '14px 18px',
              fontWeight: 800,
              cursor: 'pointer',
              minWidth: 220,
            }}
          >
            {pending
              ? 'Working...'
              : !isRegister
                ? 'Sign in to owner workspace'
                : 'Create salon owner account'}
          </button>

          <Link
            href="/"
            style={{
              textDecoration: 'none',
              borderRadius: 999,
              padding: '14px 18px',
              fontWeight: 800,
              color: '#6d5060',
              border: '1px solid #f0cad8',
              background: '#ffffff',
            }}
          >
            Back to dashboard
          </Link>
        </div>

        <div
          style={{
            background: '#fff0f6',
            color: '#6d5060',
            borderRadius: 18,
            padding: '12px 14px',
            fontWeight: 700,
          }}
        >
          {statusText}
        </div>
      </section>
    </main>
  );
}

export default function OwnerAuthPage() {
  return (
    <Suspense fallback={null}>
      <ProfessionalAuthScreen />
    </Suspense>
  );
}

const pillStyle: CSSProperties = {
  textDecoration: 'none',
  borderRadius: 999,
  padding: '10px 16px',
  fontWeight: 800,
};

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  color: '#6d5060',
  fontWeight: 700,
  fontSize: 14,
};

const inputStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid #f0cad8',
  background: '#ffffff',
  padding: '14px 16px',
  color: '#341b36',
  fontSize: 15,
  fontFamily: 'inherit',
};
