import { spawn } from 'node:child_process';

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
        `[compose] ${label} attempt ${attempt}/${attempts} failed. Retrying in 3s...`,
      );
      await sleep(3_000);
    }
  }

  throw lastError;
}

async function main() {
  await runWithRetries('Prisma db push', 'npx', ['prisma', 'db', 'push']);
  await runWithRetries('Prisma seed', 'node', ['prisma/seed.js'], 3);
  await run('node', ['backend/api/dist/backend/api/src/main.js']);
}

main().catch((error) => {
  console.error('[compose] API startup failed');
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
