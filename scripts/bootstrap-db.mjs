import { spawn } from 'node:child_process';
import loadAppEnvModule from './load-app-env.cjs';

const { loadAppEnv } = loadAppEnvModule;

loadAppEnv();

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(' ')} failed with ${
            signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`
          }`,
        ),
      );
    });
    child.on('error', reject);
  });
}

async function runWithRetries(label, command, args, attempts = 10) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await run(command, args);
      return;
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      console.error(
        `[bootstrap-db] ${label} attempt ${attempt}/${attempts} failed. Retrying in 3s...`,
      );
      await sleep(3_000);
    }
  }

  throw lastError;
}

function isSampleSeedEnabled() {
  return ['1', 'true', 'yes'].includes(
    (process.env.SEED_SAMPLE_DATA ?? '').trim().toLowerCase(),
  );
}

function getAppEnv() {
  return (process.env.APP_ENV ?? 'local').trim().toLowerCase();
}

async function main() {
  const appEnv = getAppEnv();
  console.log(`[bootstrap-db] Running Prisma migrate deploy for ${appEnv}.`);
  await runWithRetries('Prisma migrate deploy', 'npx', ['prisma', 'migrate', 'deploy']);

  if (!isSampleSeedEnabled()) {
    console.log('[bootstrap-db] Sample seed skipped because SEED_SAMPLE_DATA is not true.');
    return;
  }

  if (appEnv === 'production') {
    throw new Error('SEED_SAMPLE_DATA is blocked when APP_ENV=production.');
  }

  console.log(`[bootstrap-db] Seeding sample data for ${appEnv}.`);
  await runWithRetries('Prisma sample seed', 'node', ['prisma/seed.js'], 3);
}

main().catch((error) => {
  console.error('[bootstrap-db] Database bootstrap failed');
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
