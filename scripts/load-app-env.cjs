const fs = require('node:fs');
const path = require('node:path');

function normalizeAppEnv(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'production' || normalized === 'staging' || normalized === 'local') {
    return normalized;
  }

  return '';
}

function parseEnvFile(filePath) {
  const entries = {};
  const contents = fs.readFileSync(filePath, 'utf8');

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

function applyEntries(entries) {
  for (const [key, value] of Object.entries(entries)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function previewAppEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  return normalizeAppEnv(parseEnvFile(filePath).APP_ENV);
}

function loadFiles(cwd, fileNames) {
  const loadedFiles = [];

  for (const fileName of fileNames) {
    const filePath = path.join(cwd, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    applyEntries(parseEnvFile(filePath));
    loadedFiles.push(fileName);
  }

  return loadedFiles;
}

function selectTargetAppEnv(cwd) {
  const explicitAppEnv = normalizeAppEnv(process.env.APP_ENV);

  if (explicitAppEnv) {
    return explicitAppEnv;
  }

  const previewedAppEnv =
    previewAppEnv(path.join(cwd, '.env.local')) || previewAppEnv(path.join(cwd, '.env'));

  return previewedAppEnv || 'local';
}

function getCandidateFiles(appEnv) {
  switch (appEnv) {
    case 'production':
      return ['.env.production', '.env.production.local'];
    case 'staging':
      return ['.env.staging', '.env.staging.local'];
    case 'local':
    default:
      return ['.env', '.env.local'];
  }
}

function loadAppEnv(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const appEnv = selectTargetAppEnv(cwd);
  const loadedFiles = loadFiles(cwd, getCandidateFiles(appEnv));

  return {
    appEnv,
    loadedFiles,
  };
}

module.exports = {
  loadAppEnv,
};
