type EnvSource = Partial<Record<string, string | undefined>>;

const invalidJwtSecrets = new Set([
  '',
  'replace-me',
  'replace-with-a-long-random-secret',
]);

export function getJwtSecret(env: EnvSource = process.env) {
  const configuredSecret = (
    env.JWT_SECRET ??
    env.AUTH_TOKEN_SECRET ??
    ''
  ).trim();

  if (invalidJwtSecrets.has(configuredSecret)) {
    throw new Error(
      'JWT_SECRET must be set to a non-placeholder value before starting the API',
    );
  }

  return configuredSecret;
}

export function getJwtTtlSeconds(env: EnvSource = process.env) {
  const configuredTtl = Number(
    env.JWT_TTL_SECONDS ?? env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7,
  );

  return Number.isFinite(configuredTtl) && configuredTtl > 0
    ? Math.floor(configuredTtl)
    : 60 * 60 * 24 * 7;
}
