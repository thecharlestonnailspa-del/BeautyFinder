type EnvSource = Partial<Record<string, string | undefined>>;

export const defaultAllowedCorsOrigins = [
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:8081',
  'http://localhost:19006',
];

export const rateLimitExposedHeaders = [
  'Retry-After',
  'X-RateLimit-Limit',
  'X-RateLimit-Policy',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
];

export function getAllowedCorsOrigins(env: EnvSource = process.env) {
  const configuredOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const originsToUse =
    configuredOrigins.length > 0
      ? configuredOrigins
      : defaultAllowedCorsOrigins;

  return [...new Set(originsToUse)];
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
) {
  return (
    !origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)
  );
}
