import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const gitDir = join(process.cwd(), '.git');

if (!existsSync(gitDir)) {
  console.log('Skipping Husky install because .git is not present in this directory.');
  process.exit(0);
}

const huskyBin = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'husky.cmd' : 'husky',
);

const result = spawnSync(huskyBin, [], { stdio: 'inherit' });

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
