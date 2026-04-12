import type {
  ProfessionalAccountType,
  Role,
  SessionPayload,
  UserSummary,
} from '@beauty-finder/types';
import { RoleName } from '@prisma/client';
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import type { UserWithRoles } from './marketplace.types';

export type AccessTokenClaims = {
  ver?: 1 | 2;
  iss: string;
  sub: string;
  role: Role;
  iat: number;
  exp: number;
};

type AccessTokenHeader = {
  alg: 'HS256';
  typ: 'JWT';
};

const permissionMap: Record<Role, string[]> = {
  customer: ['browse:businesses', 'book:appointments', 'chat:businesses'],
  owner: ['manage:business', 'manage:bookings', 'chat:customers'],
  technician: ['manage:profile', 'manage:services', 'manage:ads'],
  admin: ['manage:users', 'manage:businesses', 'view:platform'],
};

function getRolePriority(role: Role) {
  switch (role) {
    case 'admin':
      return 0;
    case 'owner':
      return 1;
    case 'technician':
      return 2;
    case 'customer':
    default:
      return 3;
  }
}

function getPrimaryRole(roles: { role: RoleName }[]): Role {
  return (
    roles
      .map((entry) => fromRoleName(entry.role))
      .sort((left, right) => getRolePriority(left) - getRolePriority(right))[0] ??
    'customer'
  );
}

function getAccountType(role: Role): ProfessionalAccountType | undefined {
  switch (role) {
    case 'owner':
      return 'salon_owner';
    case 'technician':
      return 'private_technician';
    default:
      return undefined;
  }
}

export function toBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength =
    normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);

  return Buffer.from(
    `${normalized}${'='.repeat(paddingLength)}`,
    'base64',
  ).toString('utf8');
}

export function signAccessTokenValue(value: string, secret: string) {
  return toBase64Url(createHmac('sha256', secret).update(value).digest());
}

export function toRoleName(role: Role): RoleName {
  return role.toUpperCase() as RoleName;
}

export function fromRoleName(role: RoleName): Role {
  return role.toLowerCase() as Role;
}

export function toUserSummary(user: UserWithRoles): UserSummary {
  const role = getPrimaryRole(user.roles);

  return {
    id: user.id,
    role,
    name: user.fullName,
    email: user.email,
    accountType: getAccountType(role),
    avatarUrl: user.avatarUrl ?? undefined,
  };
}

export function createAccessToken(
  user: UserSummary,
  options: {
    issuer: string;
    secret: string;
    ttlSeconds: number;
  },
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + options.ttlSeconds;
  const header: AccessTokenHeader = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const claims: AccessTokenClaims = {
    ver: 2,
    iss: options.issuer,
    sub: user.id,
    role: user.role,
    iat: issuedAt,
    exp: expiresAt,
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(claims));
  const signature = signAccessTokenValue(
    `${encodedHeader}.${encodedPayload}`,
    options.secret,
  );

  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function parseAccessToken(
  token: string,
  options: {
    issuer: string;
    secret: string;
    nowInSeconds?: number;
  },
): AccessTokenClaims | undefined {
  const [encodedHeader, encodedPayload, providedSignature, extraSegment] =
    token.split('.');

  if (
    !encodedHeader ||
    !encodedPayload ||
    !providedSignature ||
    extraSegment
  ) {
    return undefined;
  }

  const expectedSignature = signAccessTokenValue(
    `${encodedHeader}.${encodedPayload}`,
    options.secret,
  );
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return undefined;
  }

  try {
    const header = JSON.parse(
      fromBase64Url(encodedHeader),
    ) as Partial<AccessTokenHeader>;
    const claims = JSON.parse(
      fromBase64Url(encodedPayload),
    ) as AccessTokenClaims;
    const now = options.nowInSeconds ?? Math.floor(Date.now() / 1000);

    if (
      header.alg !== 'HS256' ||
      header.typ !== 'JWT' ||
      (claims.ver !== undefined && claims.ver !== 2) ||
      claims.iss !== options.issuer ||
      !claims.sub ||
      !claims.role ||
      !Number.isFinite(claims.iat) ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= now
    ) {
      return undefined;
    }

    return claims;
  } catch {
    return undefined;
  }
}

export function hashLegacyPassword(password: string) {
  return `sha256$${createHash('sha256').update(password).digest('hex')}`;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');

  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  if (passwordHash.startsWith('scrypt$')) {
    const [, salt, storedKey] = passwordHash.split('$');

    if (!salt || !storedKey) {
      return false;
    }

    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    const expectedBuffer = Buffer.from(storedKey, 'hex');
    const providedBuffer = Buffer.from(derivedKey, 'hex');

    return (
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer)
    );
  }

  if (passwordHash.startsWith('sha256$')) {
    return hashLegacyPassword(password) === passwordHash;
  }

  return passwordHash === password;
}

export function needsPasswordRehash(passwordHash: string) {
  return !passwordHash.startsWith('scrypt$');
}

export function buildSessionPayload(
  user: UserWithRoles,
  options: {
    issuer: string;
    secret: string;
    ttlSeconds: number;
    issuedToken?: string;
    expiresAt?: string;
  },
): SessionPayload {
  const summary = toUserSummary(user);
  const tokenBundle =
    options.issuedToken && options.expiresAt
      ? {
          token: options.issuedToken,
          expiresAt: options.expiresAt,
        }
      : createAccessToken(summary, {
          issuer: options.issuer,
          secret: options.secret,
          ttlSeconds: options.ttlSeconds,
        });

  return {
    user: summary,
    permissions: permissionMap[summary.role],
    accessToken: tokenBundle.token,
    expiresAt: tokenBundle.expiresAt,
  };
}
