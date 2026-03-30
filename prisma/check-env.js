const { URL } = require('node:url');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail('DATABASE_URL is required before running Prisma database commands.');
}

if (databaseUrl.includes('[YOUR-PASSWORD]') || databaseUrl.includes('YOUR_PASSWORD')) {
  fail('Replace the placeholder password in DATABASE_URL before running db:push or db:seed.');
}

if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
  fail('DATABASE_URL must be a PostgreSQL connection string.');
}

try {
  new URL(databaseUrl);
} catch (error) {
  fail(`DATABASE_URL is not a valid URL: ${error instanceof Error ? error.message : String(error)}`);
}
