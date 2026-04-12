import { join } from 'node:path';

type EnvSource = Partial<Record<string, string | undefined>>;

export type OwnerMediaStorageConfig =
  | {
      driver: 'local';
      uploadsDirectory: string;
      publicBasePath: string;
      pathPrefix: string;
    }
  | {
      driver: 'supabase';
      supabaseUrl: string;
      serviceRoleKey: string;
      bucket: string;
      publicBaseUrl: string;
      pathPrefix: string;
    };

function sanitize(value?: string | null) {
  return value?.trim() || undefined;
}

function isStrictRuntime(env: EnvSource = process.env) {
  const appEnv = sanitize(env.APP_ENV)?.toLowerCase();
  const nodeEnv = sanitize(env.NODE_ENV)?.toLowerCase();

  return (
    appEnv === 'staging' ||
    appEnv === 'production' ||
    nodeEnv === 'production'
  );
}

function getPathPrefix(env: EnvSource = process.env) {
  return sanitize(env.OWNER_MEDIA_STORAGE_PATH_PREFIX) ?? '';
}

function resolveLocalConfig(env: EnvSource = process.env): OwnerMediaStorageConfig {
  return {
    driver: 'local',
    uploadsDirectory:
      sanitize(env.OWNER_MEDIA_UPLOAD_DIR) ??
      join(__dirname, '../../uploads'),
    publicBasePath: '/uploads',
    pathPrefix: getPathPrefix(env),
  };
}

function resolveSupabaseConfig(env: EnvSource = process.env): OwnerMediaStorageConfig {
  const supabaseUrl = sanitize(env.SUPABASE_URL);
  const serviceRoleKey = sanitize(env.SUPABASE_SERVICE_ROLE_KEY);
  const bucket = sanitize(env.OWNER_MEDIA_STORAGE_BUCKET);

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL must be set when OWNER_MEDIA_STORAGE_DRIVER=supabase');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must be set when OWNER_MEDIA_STORAGE_DRIVER=supabase',
    );
  }

  if (!bucket) {
    throw new Error(
      'OWNER_MEDIA_STORAGE_BUCKET must be set when OWNER_MEDIA_STORAGE_DRIVER=supabase',
    );
  }

  const publicBaseUrl =
    sanitize(env.OWNER_MEDIA_PUBLIC_BASE_URL) ??
    `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}`;

  return {
    driver: 'supabase',
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    serviceRoleKey,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ''),
    pathPrefix: getPathPrefix(env),
  };
}

export function getOwnerMediaStorageConfig(
  env: EnvSource = process.env,
): OwnerMediaStorageConfig {
  const configuredDriver = sanitize(env.OWNER_MEDIA_STORAGE_DRIVER)?.toLowerCase();

  if (!configuredDriver) {
    return isStrictRuntime(env)
      ? resolveSupabaseConfig(env)
      : resolveLocalConfig(env);
  }

  if (configuredDriver === 'local') {
    if (isStrictRuntime(env)) {
      throw new Error(
        'OWNER_MEDIA_STORAGE_DRIVER=local is not allowed in staging or production',
      );
    }

    return resolveLocalConfig(env);
  }

  if (configuredDriver === 'supabase') {
    return resolveSupabaseConfig(env);
  }

  throw new Error(
    'OWNER_MEDIA_STORAGE_DRIVER must be either "local" or "supabase"',
  );
}

export function usesLocalOwnerMediaStorage(env: EnvSource = process.env) {
  return getOwnerMediaStorageConfig(env).driver === 'local';
}
