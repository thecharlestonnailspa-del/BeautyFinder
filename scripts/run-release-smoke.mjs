import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function fail(message) {
  throw new Error(message);
}

function parseEnvFile(filePath) {
  const entries = {};
  const contents = readFileSync(filePath, 'utf8');

  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, '').trim();
    }

    entries[key] = value.replace(/\\n/gu, '\n');
  }

  return entries;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: options.env ?? process.env,
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

async function main() {
  const envFile = process.argv[2];

  if (!envFile) {
    fail(
      'Usage: npm run smoke:deploy:file -- <release-env-file>. Example: deploy/env/smoke.staging.local.env',
    );
  }

  const resolvedEnvFile = path.resolve(process.cwd(), envFile);
  const fileEntries = parseEnvFile(resolvedEnvFile);
  const mergedEnv = {
    ...fileEntries,
    ...process.env,
  };

  console.log(`[run-release-smoke] Validating ${envFile} in strict mode.`);
  await run('node', ['scripts/check-release-env.mjs', '--strict', envFile]);

  console.log(`[run-release-smoke] Running deploy smoke with ${envFile}.`);
  await run('node', ['scripts/smoke-deploy.mjs'], { env: mergedEnv });
}

main().catch((error) => {
  console.error('[run-release-smoke] Smoke run aborted');
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
