function fail(message) {
  throw new Error(message);
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    fail(`${name} is required.`);
  }

  return value;
}

function getOptionalEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  apply(response) {
    const setCookieHeaders =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : response.headers.get('set-cookie')
          ? [response.headers.get('set-cookie')]
          : [];

    for (const header of setCookieHeaders) {
      if (!header) {
        continue;
      }

      const [cookiePart] = header.split(';', 1);
      const separatorIndex = cookiePart.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const name = cookiePart.slice(0, separatorIndex).trim();
      const value = cookiePart.slice(separatorIndex + 1).trim();

      if (!value) {
        this.cookies.delete(name);
        continue;
      }

      this.cookies.set(name, value);
    }
  }

  header() {
    if (this.cookies.size === 0) {
      return null;
    }

    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

async function readJson(response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

async function expectOk(response, label) {
  if (response.ok) {
    return;
  }

  const body = await response.text().catch(() => '');
  fail(
    `${label} failed with status ${response.status}${body ? `: ${body}` : ''}`,
  );
}

async function requestJson(url, init, label) {
  const response = await fetch(url, init);
  await expectOk(response, label);
  const body = await readJson(response);

  if (!body) {
    fail(`${label} did not return JSON.`);
  }

  return { body, response };
}

async function checkApiHealth(apiUrl) {
  console.log(`Checking API health at ${apiUrl}/health`);
  const response = await fetch(`${apiUrl}/health`, {
    cache: 'no-store',
  });
  await expectOk(response, 'API health check');
}

async function checkOwnerApp(ownerUrl, email, password) {
  console.log(`Checking owner app at ${ownerUrl}`);
  const cookieJar = new CookieJar();
  const login = await requestJson(
    `${ownerUrl}/api/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    'Owner login',
  );

  cookieJar.apply(login.response);

  if (login.body.user?.role !== 'owner') {
    fail('Owner login did not return an owner session.');
  }

  if (!cookieJar.header()) {
    fail('Owner login did not set a session cookie.');
  }

  const authMe = await requestJson(
    `${ownerUrl}/api/backend/auth/me`,
    {
      headers: { Cookie: cookieJar.header() },
      cache: 'no-store',
    },
    'Owner proxied auth check',
  );

  if (authMe.body.role !== 'owner') {
    fail('Owner proxied auth check did not resolve to an owner user.');
  }

  const logout = await fetch(`${ownerUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookieJar.header() },
  });
  await expectOk(logout, 'Owner logout');
}

async function checkAdminApp(adminUrl, email, password, accessAccountId) {
  console.log(`Checking admin app at ${adminUrl}`);
  const cookieJar = new CookieJar();
  const login = await requestJson(
    `${adminUrl}/api/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    'Admin login',
  );

  cookieJar.apply(login.response);

  if (login.body.user?.role !== 'admin') {
    fail('Admin login did not return an admin session.');
  }

  if (!cookieJar.header()) {
    fail('Admin login did not set a session cookie.');
  }

  const authMe = await requestJson(
    `${adminUrl}/api/backend/auth/me`,
    {
      headers: { Cookie: cookieJar.header() },
      cache: 'no-store',
    },
    'Admin proxied auth check',
  );

  if (authMe.body.role !== 'admin') {
    fail('Admin proxied auth check did not resolve to an admin user.');
  }

  if (accessAccountId) {
    const accessSession = await requestJson(
      `${adminUrl}/api/auth/access-session`,
      {
        method: 'POST',
        headers: {
          Cookie: cookieJar.header(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: accessAccountId,
          note: 'Deployment smoke test',
        }),
      },
      'Admin access session bootstrap',
    );

    cookieJar.apply(accessSession.response);

    const accessAuthMe = await requestJson(
      `${adminUrl}/api/backend/auth/me`,
      {
        headers: {
          Cookie: cookieJar.header(),
          'x-admin-session-scope': 'access',
        },
        cache: 'no-store',
      },
      'Admin access-session proxied auth check',
    );

    if (!accessAuthMe.body.role) {
      fail('Admin access-session auth check did not return a user.');
    }

    const accessLogout = await fetch(`${adminUrl}/api/auth/access-session`, {
      method: 'DELETE',
      headers: { Cookie: cookieJar.header() },
    });
    await expectOk(accessLogout, 'Admin access-session clear');
  }

  const logout = await fetch(`${adminUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookieJar.header() },
  });
  await expectOk(logout, 'Admin logout');
}

async function checkCustomerApp(customerUrl) {
  console.log(`Checking customer web app at ${customerUrl}`);
  const home = await fetch(`${customerUrl}/`, {
    cache: 'no-store',
  });
  await expectOk(home, 'Customer home page');

  const salonRoute = await fetch(`${customerUrl}/salons/deploy-smoke-check`, {
    cache: 'no-store',
  });
  await expectOk(salonRoute, 'Customer SPA salon route');
}

async function main() {
  const apiUrl = normalizeBaseUrl(getRequiredEnv('DEPLOY_SMOKE_API_URL'));
  const ownerUrl = getOptionalEnv('DEPLOY_SMOKE_OWNER_URL');
  const adminUrl = getOptionalEnv('DEPLOY_SMOKE_ADMIN_URL');
  const customerUrl = getOptionalEnv('DEPLOY_SMOKE_CUSTOMER_URL');
  const ownerEmail = getOptionalEnv('DEPLOY_SMOKE_OWNER_EMAIL');
  const ownerPassword = getOptionalEnv('DEPLOY_SMOKE_OWNER_PASSWORD');
  const adminEmail = getOptionalEnv('DEPLOY_SMOKE_ADMIN_EMAIL');
  const adminPassword = getOptionalEnv('DEPLOY_SMOKE_ADMIN_PASSWORD');
  const accessAccountId = getOptionalEnv('DEPLOY_SMOKE_ACCESS_ACCOUNT_ID');

  await checkApiHealth(apiUrl);

  if (ownerUrl) {
    if (!ownerEmail || !ownerPassword) {
      fail(
        'DEPLOY_SMOKE_OWNER_EMAIL and DEPLOY_SMOKE_OWNER_PASSWORD are required when DEPLOY_SMOKE_OWNER_URL is set.',
      );
    }

    await checkOwnerApp(normalizeBaseUrl(ownerUrl), ownerEmail, ownerPassword);
  }

  if (adminUrl) {
    if (!adminEmail || !adminPassword) {
      fail(
        'DEPLOY_SMOKE_ADMIN_EMAIL and DEPLOY_SMOKE_ADMIN_PASSWORD are required when DEPLOY_SMOKE_ADMIN_URL is set.',
      );
    }

    await checkAdminApp(
      normalizeBaseUrl(adminUrl),
      adminEmail,
      adminPassword,
      accessAccountId,
    );
  }

  if (customerUrl) {
    await checkCustomerApp(normalizeBaseUrl(customerUrl));
  }

  console.log('Deployment smoke checks passed.');
}

main().catch((error) => {
  console.error('[smoke-deploy] Failed');
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
