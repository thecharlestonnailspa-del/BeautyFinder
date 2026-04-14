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

function getOptionalBooleanEnv(name) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function optionalString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function toRequestHeaders(headers = {}, cookieHeader) {
  return cookieHeader ? { ...headers, Cookie: cookieHeader } : headers;
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

async function expectStatus(response, expectedStatus, label) {
  if (response.status === expectedStatus) {
    return;
  }

  const body = await response.text().catch(() => '');
  fail(
    `${label} expected status ${expectedStatus} but received ${response.status}${body ? `: ${body}` : ''}`,
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

function expectArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} did not return an array.`);
  }

  return value;
}

function selectRecordById(records, recordId, label) {
  const selected = records.find(
    (record) => record && typeof record === 'object' && record.id === recordId,
  );

  if (!selected) {
    fail(`${label} ${recordId} was not found.`);
  }

  return selected;
}

function buildOwnerBusinessUpdatePayload(business) {
  const payload = {};
  const name = optionalString(business.name);
  const description = optionalString(business.description);
  const heroImage = optionalString(business.heroImage);
  const businessLogo = optionalString(business.businessLogo);
  const businessBanner = optionalString(business.businessBanner);
  const ownerAvatar = optionalString(business.ownerAvatar);
  const videoUrl = optionalString(business.videoUrl);

  if (name) {
    payload.name = name;
  }

  if (description) {
    payload.description = description;
  }

  if (heroImage) {
    payload.heroImage = heroImage;
  }

  if (businessLogo) {
    payload.businessLogo = businessLogo;
  }

  if (businessBanner) {
    payload.businessBanner = businessBanner;
  }

  if (ownerAvatar) {
    payload.ownerAvatar = ownerAvatar;
  }

  if (videoUrl) {
    payload.videoUrl = videoUrl;
  }

  if (Array.isArray(business.galleryImages)) {
    payload.galleryImages = business.galleryImages
      .map((imageUrl) => optionalString(imageUrl))
      .filter(Boolean);
  }

  if (business.promotion && typeof business.promotion === 'object') {
    const title = optionalString(business.promotion.title);

    if (title) {
      payload.promotion = {
        title,
        discountPercent: Number(business.promotion.discountPercent) || 0,
        ...(optionalString(business.promotion.description)
          ? { description: optionalString(business.promotion.description) }
          : {}),
        ...(optionalString(business.promotion.code)
          ? { code: optionalString(business.promotion.code) }
          : {}),
        ...(optionalString(business.promotion.expiresAt)
          ? { expiresAt: optionalString(business.promotion.expiresAt) }
          : {}),
      };
    }
  }

  if (Array.isArray(business.services)) {
    const services = business.services
      .map((service) => {
        const serviceName = optionalString(service?.name);
        const serviceDescription = optionalString(service?.description);
        const durationMinutes = Number(service?.durationMinutes);
        const price = Number(service?.price);

        if (
          !serviceName ||
          !serviceDescription ||
          !Number.isFinite(durationMinutes) ||
          durationMinutes <= 0 ||
          !Number.isFinite(price) ||
          price <= 0
        ) {
          return null;
        }

        return {
          ...(optionalString(service.id) ? { id: optionalString(service.id) } : {}),
          name: serviceName,
          description: serviceDescription,
          durationMinutes,
          price,
          isActive: service?.isActive !== false,
        };
      })
      .filter(Boolean);

    if (services.length > 0) {
      payload.services = services;
    }
  }

  if (Array.isArray(business.staff)) {
    const staff = business.staff
      .map((member) => {
        const memberName = optionalString(member?.name);

        if (!memberName) {
          return null;
        }

        return {
          ...(optionalString(member.id) ? { id: optionalString(member.id) } : {}),
          name: memberName,
          ...(optionalString(member.title)
            ? { title: optionalString(member.title) }
            : {}),
          ...(optionalString(member.avatarUrl)
            ? { avatarUrl: optionalString(member.avatarUrl) }
            : {}),
          isActive: member?.isActive !== false,
        };
      })
      .filter(Boolean);

    if (staff.length > 0) {
      payload.staff = staff;
    }
  }

  return payload;
}

function buildOwnerTechnicianPayload(technicians) {
  return {
    technicians: technicians
      .map((technician) => {
        const technicianName = optionalString(technician?.name);

        if (!technicianName) {
          return null;
        }

        return {
          ...(optionalString(technician.id)
            ? { id: optionalString(technician.id) }
            : {}),
          ...(optionalString(technician.userId)
            ? { userId: optionalString(technician.userId) }
            : {}),
          name: technicianName,
          ...(optionalString(technician.title)
            ? { title: optionalString(technician.title) }
            : {}),
          ...(optionalString(technician.avatarUrl)
            ? { avatarUrl: optionalString(technician.avatarUrl) }
            : {}),
          isActive: technician?.isActive !== false,
        };
      })
      .filter(Boolean),
  };
}

function isPublicMediaUrl(value) {
  return /^https?:\/\//i.test(value) && !value.includes('/uploads/');
}

const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2nK7cAAAAASUVORK5CYII=';

async function checkApiHealth(apiUrl) {
  console.log(`Checking API health at ${apiUrl}/health`);
  const response = await fetch(`${apiUrl}/health`, {
    cache: 'no-store',
  });
  await expectOk(response, 'API health check');
}

async function checkOwnerWritePaths(
  ownerUrl,
  cookieJar,
  ownerBusinessId,
  ownerMediaUploadEnabled,
) {
  const ownerBusinesses = await requestJson(
    `${ownerUrl}/api/backend/businesses/owner/manage`,
    {
      headers: toRequestHeaders({}, cookieJar.header()),
      cache: 'no-store',
    },
    'Owner business list',
  );
  const businesses = expectArray(ownerBusinesses.body, 'Owner business list');
  const business = selectRecordById(
    businesses,
    ownerBusinessId,
    'Owner smoke business',
  );

  console.log(`Checking owner write paths for business ${business.id}`);

  const ownerProfileUpdate = await requestJson(
    `${ownerUrl}/api/backend/businesses/${business.id}/owner-profile`,
    {
      method: 'PATCH',
      headers: toRequestHeaders(
        { 'Content-Type': 'application/json' },
        cookieJar.header(),
      ),
      body: JSON.stringify(buildOwnerBusinessUpdatePayload(business)),
    },
    'Owner business round-trip update',
  );

  if (ownerProfileUpdate.body?.id !== business.id) {
    fail('Owner business round-trip update returned the wrong business.');
  }

  const ownerTechnicians = await requestJson(
    `${ownerUrl}/api/backend/businesses/${business.id}/owner-technicians`,
    {
      headers: toRequestHeaders({}, cookieJar.header()),
      cache: 'no-store',
    },
    'Owner technician roster read',
  );
  const technicians = expectArray(
    ownerTechnicians.body,
    'Owner technician roster read',
  );
  const ownerTechnicianUpdate = await requestJson(
    `${ownerUrl}/api/backend/businesses/${business.id}/owner-technicians`,
    {
      method: 'PUT',
      headers: toRequestHeaders(
        { 'Content-Type': 'application/json' },
        cookieJar.header(),
      ),
      body: JSON.stringify(buildOwnerTechnicianPayload(technicians)),
    },
    'Owner technician roster round-trip update',
  );

  expectArray(
    ownerTechnicianUpdate.body,
    'Owner technician roster round-trip update',
  );

  if (ownerMediaUploadEnabled) {
    const ownerMediaUpload = await requestJson(
      `${ownerUrl}/api/backend/businesses/${business.id}/owner-media/image`,
      {
        method: 'PATCH',
        headers: toRequestHeaders(
          { 'Content-Type': 'application/json' },
          cookieJar.header(),
        ),
        body: JSON.stringify({
          filename: 'deploy-smoke-check.png',
          contentType: 'image/png',
          base64: tinyPngBase64,
        }),
      },
      'Owner media upload',
    );

    const uploadedPath = optionalString(ownerMediaUpload.body?.path);
    if (!uploadedPath || !isPublicMediaUrl(uploadedPath)) {
      fail('Owner media upload did not return a public object-storage URL.');
    }
  }
}

async function checkOwnerApp(
  ownerUrl,
  email,
  password,
  ownerBusinessId,
  ownerMediaUploadEnabled,
) {
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

  if (ownerBusinessId) {
    await checkOwnerWritePaths(
      ownerUrl,
      cookieJar,
      ownerBusinessId,
      ownerMediaUploadEnabled,
    );
  } else if (ownerMediaUploadEnabled) {
    fail(
      'DEPLOY_SMOKE_OWNER_BUSINESS_ID is required when DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD is enabled.',
    );
  }

  const logout = await fetch(`${ownerUrl}/api/auth/logout`, {
    method: 'POST',
    headers: toRequestHeaders({}, cookieJar.header()),
  });
  await expectOk(logout, 'Owner logout');
  cookieJar.apply(logout);

  const authAfterLogout = await fetch(`${ownerUrl}/api/backend/auth/me`, {
    headers: toRequestHeaders({}, cookieJar.header()),
    cache: 'no-store',
  });
  await expectStatus(authAfterLogout, 401, 'Owner auth check after logout');
}

async function checkAdminHomepageWritePath(
  adminUrl,
  cookieJar,
  homepageBusinessId,
) {
  console.log(
    `Checking admin homepage placement round-trip for business ${homepageBusinessId}`,
  );

  const approvedBusinesses = await requestJson(
    `${adminUrl}/api/backend/admin/businesses?status=approved`,
    {
      headers: toRequestHeaders({}, cookieJar.header()),
      cache: 'no-store',
    },
    'Admin approved business list',
  );
  const approvedQueue = expectArray(
    approvedBusinesses.body,
    'Admin approved business list',
  );
  const business = selectRecordById(
    approvedQueue,
    homepageBusinessId,
    'Admin homepage smoke business',
  );

  const homepagePlacementUpdate = await requestJson(
    `${adminUrl}/api/backend/admin/businesses/${business.id}/homepage`,
    {
      method: 'PATCH',
      headers: toRequestHeaders(
        { 'Content-Type': 'application/json' },
        cookieJar.header(),
      ),
      body: JSON.stringify({
        featuredOnHomepage: Boolean(business.featuredOnHomepage),
        homepageRank:
          Number.isFinite(Number(business.homepageRank)) &&
          Number(business.homepageRank) > 0
            ? Math.floor(Number(business.homepageRank))
            : 1,
      }),
    },
    'Admin homepage placement round-trip update',
  );

  if (homepagePlacementUpdate.body?.id !== business.id) {
    fail('Admin homepage placement update returned the wrong business.');
  }

  const refreshedHomepageBusinesses = await requestJson(
    `${adminUrl}/api/backend/admin/homepage-businesses`,
    {
      headers: toRequestHeaders({}, cookieJar.header()),
      cache: 'no-store',
    },
    'Admin homepage business refresh',
  );
  const refreshedHomepageQueue = expectArray(
    refreshedHomepageBusinesses.body,
    'Admin homepage business refresh',
  );

  const stillFeatured = refreshedHomepageQueue.some(
    (item) => item && typeof item === 'object' && item.id === business.id,
  );

  if (business.featuredOnHomepage && !stillFeatured) {
    fail('Admin homepage placement update did not preserve the featured business.');
  }

  if (!business.featuredOnHomepage && stillFeatured) {
    fail('Admin homepage placement update unexpectedly featured a hidden business.');
  }
}

async function checkAdminModerationWritePath(
  adminUrl,
  cookieJar,
  moderationBusinessId,
) {
  console.log(
    `Checking admin moderation no-op update for business ${moderationBusinessId}`,
  );

  const allBusinesses = await requestJson(
    `${adminUrl}/api/backend/admin/businesses`,
    {
      headers: toRequestHeaders({}, cookieJar.header()),
      cache: 'no-store',
    },
    'Admin business queue',
  );
  const businessQueue = expectArray(allBusinesses.body, 'Admin business queue');
  const business = selectRecordById(
    businessQueue,
    moderationBusinessId,
    'Admin moderation smoke business',
  );

  const moderationUpdate = await requestJson(
    `${adminUrl}/api/backend/admin/businesses/${business.id}/status`,
    {
      method: 'PATCH',
      headers: toRequestHeaders(
        { 'Content-Type': 'application/json' },
        cookieJar.header(),
      ),
      body: JSON.stringify({
        status: business.status,
        note: 'Deployment smoke verification',
      }),
    },
    'Admin moderation no-op update',
  );

  if (moderationUpdate.body?.id !== business.id) {
    fail('Admin moderation update returned the wrong business.');
  }

  if (moderationUpdate.body?.status !== business.status) {
    fail('Admin moderation update did not preserve the business status.');
  }
}

async function checkAdminApp(
  adminUrl,
  email,
  password,
  accessAccountId,
  homepageBusinessId,
  moderationBusinessId,
) {
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

  if (homepageBusinessId) {
    await checkAdminHomepageWritePath(
      adminUrl,
      cookieJar,
      homepageBusinessId,
    );
  }

  if (moderationBusinessId) {
    await checkAdminModerationWritePath(
      adminUrl,
      cookieJar,
      moderationBusinessId,
    );
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
      headers: toRequestHeaders({}, cookieJar.header()),
    });
    await expectOk(accessLogout, 'Admin access-session clear');
    cookieJar.apply(accessLogout);

    const accessAuthAfterClear = await fetch(`${adminUrl}/api/backend/auth/me`, {
      headers: toRequestHeaders(
        { 'x-admin-session-scope': 'access' },
        cookieJar.header(),
      ),
      cache: 'no-store',
    });
    await expectStatus(
      accessAuthAfterClear,
      401,
      'Admin access-session auth check after clear',
    );
  }

  const logout = await fetch(`${adminUrl}/api/auth/logout`, {
    method: 'POST',
    headers: toRequestHeaders({}, cookieJar.header()),
  });
  await expectOk(logout, 'Admin logout');
  cookieJar.apply(logout);

  const authAfterLogout = await fetch(`${adminUrl}/api/backend/auth/me`, {
    headers: toRequestHeaders({}, cookieJar.header()),
    cache: 'no-store',
  });
  await expectStatus(authAfterLogout, 401, 'Admin auth check after logout');
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
  const ownerBusinessId = getOptionalEnv('DEPLOY_SMOKE_OWNER_BUSINESS_ID');
  const ownerMediaUploadEnabled = getOptionalBooleanEnv(
    'DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD',
  );
  const allowSideEffects = getOptionalBooleanEnv(
    'DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS',
  );
  const adminHomepageBusinessId = getOptionalEnv(
    'DEPLOY_SMOKE_ADMIN_HOMEPAGE_BUSINESS_ID',
  );
  const adminStatusBusinessId = getOptionalEnv(
    'DEPLOY_SMOKE_ADMIN_STATUS_BUSINESS_ID',
  );
  const requestedMutatingChecks = [
    accessAccountId,
    ownerBusinessId,
    adminHomepageBusinessId,
    adminStatusBusinessId,
    ownerMediaUploadEnabled ? 'owner-media-upload' : null,
  ].filter(Boolean);

  if (requestedMutatingChecks.length > 0 && !allowSideEffects) {
    fail(
      'DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=true is required before running mutating smoke checks such as access-session, owner write paths, homepage placement, moderation, or media upload.',
    );
  }

  await checkApiHealth(apiUrl);

  if (ownerUrl) {
    if (!ownerEmail || !ownerPassword) {
      fail(
        'DEPLOY_SMOKE_OWNER_EMAIL and DEPLOY_SMOKE_OWNER_PASSWORD are required when DEPLOY_SMOKE_OWNER_URL is set.',
      );
    }

    await checkOwnerApp(
      normalizeBaseUrl(ownerUrl),
      ownerEmail,
      ownerPassword,
      ownerBusinessId,
      ownerMediaUploadEnabled,
    );
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
      adminHomepageBusinessId,
      adminStatusBusinessId,
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
