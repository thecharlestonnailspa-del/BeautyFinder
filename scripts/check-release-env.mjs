import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const RELEASE_ENV_DIR = path.resolve(process.cwd(), 'deploy/env');

const PROFILE_BY_BASENAME = new Map([
  ['render-api.staging.env.example', { kind: 'render-api', environment: 'staging' }],
  ['render-api.production.env.example', { kind: 'render-api', environment: 'production' }],
  ['vercel-owner.staging.env.example', { kind: 'vercel-owner', environment: 'staging' }],
  ['vercel-owner.production.env.example', { kind: 'vercel-owner', environment: 'production' }],
  ['vercel-admin.staging.env.example', { kind: 'vercel-admin', environment: 'staging' }],
  ['vercel-admin.production.env.example', { kind: 'vercel-admin', environment: 'production' }],
  ['vercel-customer-web.staging.env.example', { kind: 'vercel-customer-web', environment: 'staging' }],
  ['vercel-customer-web.production.env.example', { kind: 'vercel-customer-web', environment: 'production' }],
  ['smoke.staging.env.example', { kind: 'smoke', environment: 'staging' }],
  ['smoke.production.env.example', { kind: 'smoke', environment: 'production' }],
  ['github-smoke.secrets.example', { kind: 'github-smoke', environment: 'staging' }],
  ['github-smoke.production.secrets.example', { kind: 'github-smoke', environment: 'production' }],
]);

const PROFILE_BY_LOCAL_BASENAME = new Map([
  ['render-api.staging.local.env', { kind: 'render-api', environment: 'staging' }],
  ['render-api.production.local.env', { kind: 'render-api', environment: 'production' }],
  ['vercel-owner.staging.local.env', { kind: 'vercel-owner', environment: 'staging' }],
  ['vercel-owner.production.local.env', { kind: 'vercel-owner', environment: 'production' }],
  ['vercel-admin.staging.local.env', { kind: 'vercel-admin', environment: 'staging' }],
  ['vercel-admin.production.local.env', { kind: 'vercel-admin', environment: 'production' }],
  ['vercel-customer-web.staging.local.env', {
    kind: 'vercel-customer-web',
    environment: 'staging',
  }],
  ['vercel-customer-web.production.local.env', {
    kind: 'vercel-customer-web',
    environment: 'production',
  }],
  ['smoke.staging.local.env', { kind: 'smoke', environment: 'staging' }],
  ['smoke.production.local.env', { kind: 'smoke', environment: 'production' }],
  ['github-smoke.staging.local.env', { kind: 'github-smoke', environment: 'staging' }],
  ['github-smoke.production.local.env', {
    kind: 'github-smoke',
    environment: 'production',
  }],
]);

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const files = [];
  let strict = false;

  for (const arg of argv) {
    if (arg === '--strict') {
      strict = true;
      continue;
    }

    files.push(arg);
  }

  return { strict, files };
}

function defaultFiles() {
  return readdirSync(RELEASE_ENV_DIR)
    .filter((name) => PROFILE_BY_BASENAME.has(name))
    .sort()
    .map((name) => path.join(RELEASE_ENV_DIR, name));
}

function parseEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const values = new Map();
  const errors = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      return;
    }

    const equalsIndex = rawLine.indexOf('=');

    if (equalsIndex <= 0) {
      errors.push(`line ${index + 1} is not in KEY=VALUE format.`);
      return;
    }

    const key = rawLine.slice(0, equalsIndex).trim();
    const value = rawLine.slice(equalsIndex + 1).trim();

    if (!key) {
      errors.push(`line ${index + 1} has an empty key.`);
      return;
    }

    if (values.has(key)) {
      errors.push(`duplicate key ${key} on line ${index + 1}.`);
      return;
    }

    values.set(key, value);
  });

  return { values, errors };
}

function readProfile(filePath) {
  const basename = path.basename(filePath);
  const profile =
    PROFILE_BY_BASENAME.get(basename) ?? PROFILE_BY_LOCAL_BASENAME.get(basename);

  if (!profile) {
    fail(`Unsupported release env file: ${basename}`);
  }

  return profile;
}

function getRequiredValue(values, key, errors) {
  if (!values.has(key)) {
    errors.push(`missing required key ${key}.`);
    return null;
  }

  return values.get(key) ?? '';
}

function isPlaceholder(value) {
  return (
    value.length === 0 ||
    /<[^>]+>/.test(value) ||
    /replace-with/i.test(value) ||
    /example\.com/i.test(value) ||
    /your-project-ref/i.test(value) ||
    /staging-postgres-host/i.test(value) ||
    /production-postgres-host/i.test(value) ||
    /staging-redis-host/i.test(value) ||
    /production-redis-host/i.test(value) ||
    /staging_password/i.test(value) ||
    /production_password/i.test(value)
  );
}

function parseBoolean(value) {
  const normalized = value.trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return null;
}

function requireExplicitBoolean(values, key, errors) {
  const value = getRequiredValue(values, key, errors);

  if (value === null) {
    return null;
  }

  const parsed = parseBoolean(value);

  if (parsed === null) {
    errors.push(`${key} must be explicitly true or false.`);
  }

  return parsed;
}

function assertStrictFilled(values, key, errors) {
  const value = getRequiredValue(values, key, errors);

  if (value === null) {
    return;
  }

  if (isPlaceholder(value)) {
    errors.push(`${key} still contains a placeholder or blank value.`);
  }
}

function assertEmail(values, key, errors, strict) {
  const value = getRequiredValue(values, key, errors);

  if (value === null) {
    return;
  }

  if (!strict && isPlaceholder(value)) {
    return;
  }

  if (!value.includes('@')) {
    errors.push(`${key} must be an email address.`);
  }

  if (strict && isPlaceholder(value)) {
    errors.push(`${key} still contains a placeholder or blank value.`);
  }
}

function assertHttpsUrl(values, key, errors, strict, options = {}) {
  const value = getRequiredValue(values, key, errors);

  if (value === null) {
    return;
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    errors.push(`${key} must be a valid URL.`);
    return;
  }

  if (parsed.protocol !== 'https:') {
    errors.push(`${key} must use https.`);
  }

  if (options.requireApiPath && !parsed.pathname.endsWith('/api')) {
    errors.push(`${key} must end with /api.`);
  }

  if (strict && isPlaceholder(value)) {
    errors.push(`${key} still contains a placeholder or blank value.`);
  }
}

function assertCommaSeparatedHttpsUrls(values, key, errors, strict) {
  const value = getRequiredValue(values, key, errors);

  if (value === null) {
    return;
  }

  const urls = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    errors.push(`${key} must contain at least one URL.`);
    return;
  }

  urls.forEach((url, index) => {
    try {
      const parsed = new URL(url);

      if (parsed.protocol !== 'https:') {
        errors.push(`${key} entry ${index + 1} must use https.`);
      }
    } catch {
      errors.push(`${key} entry ${index + 1} must be a valid URL.`);
    }
  });

  if (strict && urls.some((url) => isPlaceholder(url))) {
    errors.push(`${key} still contains a placeholder value.`);
  }
}

function assertUrlPrefix(values, key, errors, expectedPrefixes, strict) {
  const value = getRequiredValue(values, key, errors);

  if (value === null) {
    return;
  }

  if (!expectedPrefixes.some((prefix) => value.startsWith(prefix))) {
    errors.push(`${key} must start with ${expectedPrefixes.join(' or ')}.`);
  }

  if (strict && isPlaceholder(value)) {
    errors.push(`${key} still contains a placeholder or blank value.`);
  }
}

function assertExactValue(values, key, expectedValue, errors) {
  const value = getRequiredValue(values, key, errors);

  if (value === null) {
    return;
  }

  if (value !== expectedValue) {
    errors.push(`${key} must equal ${expectedValue}.`);
  }
}

function validateRenderApi(values, environment, errors, strict) {
  const alwaysRequired = [
    'APP_ENV',
    'SEED_SAMPLE_DATA',
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'HOST',
    'PORT',
    'CORS_ORIGINS',
    'RATE_LIMIT_MAX',
    'RATE_LIMIT_WINDOW_MS',
    'AUTH_RATE_LIMIT_MAX',
    'AUTH_RATE_LIMIT_WINDOW_MS',
    'PAYMENT_TAX_RATE',
    'OWNER_MEDIA_STORAGE_DRIVER',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OWNER_MEDIA_STORAGE_BUCKET',
    'OWNER_MEDIA_PUBLIC_BASE_URL',
    'OWNER_MEDIA_STORAGE_PATH_PREFIX',
  ];

  alwaysRequired.forEach((key) => getRequiredValue(values, key, errors));
  assertExactValue(values, 'APP_ENV', environment, errors);
  assertExactValue(values, 'SEED_SAMPLE_DATA', 'false', errors);
  assertExactValue(values, 'HOST', '0.0.0.0', errors);
  assertExactValue(values, 'PORT', '3000', errors);
  assertExactValue(values, 'OWNER_MEDIA_STORAGE_DRIVER', 'supabase', errors);
  assertExactValue(values, 'OWNER_MEDIA_STORAGE_BUCKET', 'owner-media', errors);
  assertExactValue(values, 'OWNER_MEDIA_STORAGE_PATH_PREFIX', environment, errors);
  assertCommaSeparatedHttpsUrls(values, 'CORS_ORIGINS', errors, strict);
  assertUrlPrefix(values, 'DATABASE_URL', errors, ['postgres://', 'postgresql://'], strict);
  assertUrlPrefix(values, 'REDIS_URL', errors, ['redis://', 'rediss://'], strict);
  assertHttpsUrl(values, 'SUPABASE_URL', errors, strict);
  assertHttpsUrl(values, 'OWNER_MEDIA_PUBLIC_BASE_URL', errors, strict);

  if (strict) {
    [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OWNER_MEDIA_PUBLIC_BASE_URL',
    ].forEach((key) => assertStrictFilled(values, key, errors));
  }
}

function validateVercelOwner(values, errors, strict) {
  assertHttpsUrl(values, 'NEXT_PUBLIC_API_URL', errors, strict, {
    requireApiPath: true,
  });
  assertExactValue(values, 'NEXT_PUBLIC_ENABLE_PREVIEW_MODE', 'false', errors);
}

function validateVercelAdmin(values, errors, strict) {
  assertHttpsUrl(values, 'NEXT_PUBLIC_API_URL', errors, strict, {
    requireApiPath: true,
  });
}

function validateVercelCustomerWeb(values, errors, strict) {
  assertHttpsUrl(values, 'EXPO_PUBLIC_API_URL', errors, strict, {
    requireApiPath: true,
  });
  assertExactValue(values, 'EXPO_PUBLIC_ENABLE_DEMO_MODE', 'false', errors);
}

function validateSmokeConfig(values, errors, strict) {
  assertHttpsUrl(values, 'DEPLOY_SMOKE_API_URL', errors, strict, {
    requireApiPath: true,
  });
  assertHttpsUrl(values, 'DEPLOY_SMOKE_OWNER_URL', errors, strict);
  assertHttpsUrl(values, 'DEPLOY_SMOKE_ADMIN_URL', errors, strict);
  assertHttpsUrl(values, 'DEPLOY_SMOKE_CUSTOMER_URL', errors, strict);
  assertEmail(values, 'DEPLOY_SMOKE_OWNER_EMAIL', errors, strict);
  assertEmail(values, 'DEPLOY_SMOKE_ADMIN_EMAIL', errors, strict);

  if (strict) {
    assertStrictFilled(values, 'DEPLOY_SMOKE_OWNER_PASSWORD', errors);
    assertStrictFilled(values, 'DEPLOY_SMOKE_ADMIN_PASSWORD', errors);
  } else {
    getRequiredValue(values, 'DEPLOY_SMOKE_OWNER_PASSWORD', errors);
    getRequiredValue(values, 'DEPLOY_SMOKE_ADMIN_PASSWORD', errors);
  }

  const allowSideEffects = requireExplicitBoolean(
    values,
    'DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS',
    errors,
  );
  const ownerMediaUpload = requireExplicitBoolean(
    values,
    'DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD',
    errors,
  );
  const accessAccountId = values.get('DEPLOY_SMOKE_ACCESS_ACCOUNT_ID')?.trim() ?? '';
  const ownerBusinessId = values.get('DEPLOY_SMOKE_OWNER_BUSINESS_ID')?.trim() ?? '';
  const homepageBusinessId =
    values.get('DEPLOY_SMOKE_ADMIN_HOMEPAGE_BUSINESS_ID')?.trim() ?? '';
  const adminStatusBusinessId =
    values.get('DEPLOY_SMOKE_ADMIN_STATUS_BUSINESS_ID')?.trim() ?? '';

  if (
    allowSideEffects === false &&
    (accessAccountId ||
      ownerBusinessId ||
      homepageBusinessId ||
      adminStatusBusinessId ||
      ownerMediaUpload === true)
  ) {
    errors.push(
      'Mutating smoke keys are set while DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=false.',
    );
  }

  if (ownerMediaUpload === true && !ownerBusinessId) {
    errors.push(
      'DEPLOY_SMOKE_OWNER_BUSINESS_ID is required when DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD=true.',
    );
  }
}

function validateFile(filePath, strict) {
  const profile = readProfile(filePath);
  const parsed = parseEnvFile(filePath);
  const errors = [...parsed.errors];

  switch (profile.kind) {
    case 'render-api':
      validateRenderApi(parsed.values, profile.environment, errors, strict);
      break;
    case 'vercel-owner':
      validateVercelOwner(parsed.values, errors, strict);
      break;
    case 'vercel-admin':
      validateVercelAdmin(parsed.values, errors, strict);
      break;
    case 'vercel-customer-web':
      validateVercelCustomerWeb(parsed.values, errors, strict);
      break;
    case 'smoke':
    case 'github-smoke':
      validateSmokeConfig(parsed.values, errors, strict);
      break;
    default:
      fail(`No validator implemented for ${profile.kind}.`);
  }

  return { profile, errors };
}

function main() {
  const { strict, files } = parseArgs(process.argv.slice(2));
  const targets = files.length
    ? files.map((filePath) => path.resolve(process.cwd(), filePath))
    : defaultFiles();
  let failureCount = 0;

  console.log(
    `[check-release-env] Validating ${targets.length} file(s)${strict ? ' in strict mode' : ''}.`,
  );

  for (const target of targets) {
    const { profile, errors } = validateFile(target, strict);

    if (errors.length > 0) {
      failureCount += 1;
      console.error(
        `[check-release-env] FAIL ${path.relative(process.cwd(), target)} (${profile.kind}/${profile.environment})`,
      );
      errors.forEach((error) => {
        console.error(`  - ${error}`);
      });
      continue;
    }

    console.log(
      `[check-release-env] PASS ${path.relative(process.cwd(), target)} (${profile.kind}/${profile.environment})`,
    );
  }

  if (failureCount > 0) {
    process.exitCode = 1;
    return;
  }

  console.log('[check-release-env] All release env files passed.');
}

main();
