import { spawn } from 'node:child_process';

const child = spawn('node', ['backend/api/dist/backend/api/src/main.js'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('[start-api-container] API startup failed');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
