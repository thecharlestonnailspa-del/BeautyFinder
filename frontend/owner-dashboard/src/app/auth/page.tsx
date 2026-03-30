'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CSSProperties } from 'react';
import type {
  RegisterBusinessOwnerInput,
  RegisterPrivateTechnicianInput,
  SessionPayload,
} from '@beauty-finder/types';
import {
  createPreviewOwnerSession,
  getApiBaseUrl,
  previewOwnerCredentials,
  saveOwnerSessionCookie,
} from '../../lib/owner-api';

type RegisterTrack = 'business' | 'technician';

async function postJson<T>(path: string, body: unknown) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

function getDefaultStatusText(isRegister: boolean, registerTrack: RegisterTrack) {
  if (!isRegister) {
    return 'Sign in with a salon owner account, or test the seeded owner preview if the API is offline.';
  }

  if (registerTrack === 'technician') {
    return 'Create a private technician account with identity card, SSA number, and the state license information kept in its own compliance profile.';
  }

  return 'Create a salon owner account with salon license, business license, EIN, and the full business profile saved into Postgres.';
}

function ProfessionalAuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams?.get('mode') === 'register' ? 'register' : 'login';
  const registerTrack = searchParams?.get('type') === 'technician' ? 'technician' : 'business';
  const isRegister = mode === 'register';

  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(isRegister ? '' : 'lina@polishedstudio.app');
  const [password, setPassword] = useState(isRegister ? 'Beauty123' : 'mock-password');
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

  const [technicianName, setTechnicianName] = useState('');
  const [technicianEmail, setTechnicianEmail] = useState('');
  const [technicianPhone, setTechnicianPhone] = useState('');
  const [identityCardNumber, setIdentityCardNumber] = useState('');
  const [ssaNumber, setSsaNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');

  const [statusText, setStatusText] = useState(
    getDefaultStatusText(isRegister, registerTrack),
  );
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) {
      setStatusText(getDefaultStatusText(isRegister, registerTrack));
    }
  }, [isRegister, pending, registerTrack]);

  const pageTitle = useMemo(() => {
    if (!isRegister) {
      return 'Sign in to the salon owner workspace.';
    }

    return registerTrack === 'technician'
      ? 'Register a private technician account.'
      : 'Register a salon owner business account.';
  }, [isRegister, registerTrack]);

  const canUsePreviewLogin =
    !isRegister &&
    ownerEmail.trim().toLowerCase() === previewOwnerCredentials.email &&
    password === previewOwnerCredentials.password;

  async function handleSubmit() {
    if (pending) {
      return;
    }

    setPending(true);
    setStatusText(
      !isRegister
        ? 'Signing you in...'
        : registerTrack === 'technician'
          ? 'Creating private technician account...'
          : 'Creating salon owner account...',
    );

    let path = '/auth/login';
    let payload: RegisterBusinessOwnerInput | RegisterPrivateTechnicianInput | {
      email: string;
      password: string;
    };

    if (!isRegister) {
      payload = {
        email: ownerEmail.trim(),
        password,
      };
    } else if (registerTrack === 'technician') {
      path = '/auth/register/technician';
      payload = {
        fullName: technicianName.trim(),
        email: technicianEmail.trim(),
        password,
        phone: technicianPhone.trim() || undefined,
        identityCardNumber: identityCardNumber.trim(),
        ssaNumber: ssaNumber.trim(),
        licenseNumber: licenseNumber.trim(),
        licenseState: licenseState.trim(),
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
        if (canUsePreviewLogin) {
          saveOwnerSessionCookie(createPreviewOwnerSession());
          router.replace('/');
          return;
        }

        setStatusText(
          !isRegister
            ? 'Sign in failed. Check your email and password.'
            : registerTrack === 'technician'
              ? 'Private technician registration failed. Check identity and license fields.'
              : 'Salon owner registration failed. Check business profile and license fields.',
        );
        return;
      }

      if (session.user.role === 'owner') {
        saveOwnerSessionCookie(session);
        router.replace('/');
        return;
      }

      if (session.user.role === 'technician') {
        setPassword('');
        setStatusText(
          'Private technician account created in the real database. Technician access stays separate from the salon owner dashboard, so this screen does not sign that account into owner tools.',
        );
        return;
      }

      setStatusText('That account is not mapped to salon owner or private technician access.');
    } catch {
      if (canUsePreviewLogin) {
        saveOwnerSessionCookie(createPreviewOwnerSession());
        router.replace('/');
        return;
      }

      setStatusText('Could not reach the professional auth API right now.');
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
            Professional Auth
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
            Salon owners and private technicians are now registered separately. Seeded owner
            sign in still works with `lina@polishedstudio.app` and password `mock-password`.
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
            href="/auth?mode=register&type=business"
            style={{
              ...pillStyle,
              color: isRegister && registerTrack === 'business' ? '#ffffff' : '#805f72',
              background: isRegister && registerTrack === 'business' ? '#ff5f98' : '#fff',
              border:
                isRegister && registerTrack === 'business'
                  ? '1px solid transparent'
                  : '1px solid #f0cad8',
            }}
          >
            Register Salon Owner
          </a>
          <a
            href="/auth?mode=register&type=technician"
            style={{
              ...pillStyle,
              color: isRegister && registerTrack === 'technician' ? '#ffffff' : '#805f72',
              background: isRegister && registerTrack === 'technician' ? '#ff5f98' : '#fff',
              border:
                isRegister && registerTrack === 'technician'
                  ? '1px solid transparent'
                  : '1px solid #f0cad8',
            }}
          >
            Register Private Technician
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
          {isRegister && registerTrack === 'technician'
            ? 'Private technicians stay separate from salon owner businesses. Identity, SSA, and state license data are stored in a dedicated compliance profile.'
            : 'Salon owner registration now keeps salon license, business license, and EIN separate from the editable business profile.'}
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

          {isRegister && registerTrack === 'business' ? (
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

          {isRegister && registerTrack === 'technician' ? (
            <>
              <label style={fieldStyle}>
                <span>Technician full name</span>
                <input
                  value={technicianName}
                  onChange={(event) => setTechnicianName(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Email</span>
                <input
                  value={technicianEmail}
                  onChange={(event) => setTechnicianEmail(event.target.value)}
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
                <span>Phone</span>
                <input
                  value={technicianPhone}
                  onChange={(event) => setTechnicianPhone(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Identity card number</span>
                <input
                  value={identityCardNumber}
                  onChange={(event) => setIdentityCardNumber(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>SSA number</span>
                <input
                  value={ssaNumber}
                  onChange={(event) => setSsaNumber(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>License number</span>
                <input
                  value={licenseNumber}
                  onChange={(event) => setLicenseNumber(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>State of registration</span>
                <input
                  value={licenseState}
                  onChange={(event) => setLicenseState(event.target.value)}
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
                : registerTrack === 'technician'
                  ? 'Create technician account'
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
