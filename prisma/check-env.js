const { URL } = require('node:url');
const { loadAppEnv } = require('../scripts/load-app-env.cjs');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const { appEnv } = loadAppEnv();
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail(`DATABASE_URL is required before running Prisma database commands for APP_ENV=${appEnv}.`);
}

if (databaseUrl.includes('[YOUR-PASSWORD]') || databaseUrl.includes('YOUR_PASSWORD')) {
  fail(
    'Replace the placeholder password in DATABASE_URL before running Prisma migrate or sample seed commands.',
  );
}

if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
  fail('DATABASE_URL must be a PostgreSQL connection string.');
}

try {
  new URL(databaseUrl);
} catch (error) {
  fail(`DATABASE_URL is not a valid URL: ${error instanceof Error ? error.message : String(error)}`);
}
