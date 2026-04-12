import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, it, vi } from 'vitest';
import type { PrismaService } from './common/prisma.service';
import { MarketplaceService } from './common/marketplace.service';

describe('Owner media uploads', () => {
  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.NODE_ENV;
    delete process.env.OWNER_MEDIA_STORAGE_DRIVER;
    delete process.env.OWNER_MEDIA_UPLOAD_DIR;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.OWNER_MEDIA_STORAGE_BUCKET;
    delete process.env.OWNER_MEDIA_PUBLIC_BASE_URL;
    delete process.env.OWNER_MEDIA_STORAGE_PATH_PREFIX;
    vi.restoreAllMocks();
  });

  it('stores an uploaded image for the matching business owner', async () => {
    const uploadsDirectory = await mkdtemp(
      join(tmpdir(), 'beauty-finder-owner-media-'),
    );
    process.env.OWNER_MEDIA_STORAGE_DRIVER = 'local';
    process.env.OWNER_MEDIA_UPLOAD_DIR = uploadsDirectory;

    const prisma = {
      business: {
        findUnique: async () => ({
          id: 'biz-1',
          name: 'Polished Studio',
          ownerUserId: 'user-owner-1',
        }),
      },
    };
    const service = new MarketplaceService(prisma as unknown as PrismaService);

    try {
      const uploaded = await service.uploadOwnerBusinessImage(
        'biz-1',
        {
          filename: 'hero.png',
          contentType: 'image/png',
          base64:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2nK7cAAAAASUVORK5CYII=',
        },
        {
          id: 'user-owner-1',
          role: 'owner',
          name: 'Lina Nguyen',
          email: 'lina@polishedstudio.app',
        },
      );

      assert.match(
        uploaded.path,
        /^\/uploads\/owners\/user-owner-1\/biz-1\/.+\.png$/,
      );

      const savedFile = await readFile(
        join(uploadsDirectory, uploaded.path.replace('/uploads/', '')),
      );

      assert.ok(savedFile.byteLength > 0);
      assert.equal(uploaded.contentType, 'image/png');
    } finally {
      await rm(uploadsDirectory, { recursive: true, force: true });
    }
  });

  it('uploads owner media to Supabase storage outside local filesystem mode', async () => {
    process.env.OWNER_MEDIA_STORAGE_DRIVER = 'supabase';
    process.env.SUPABASE_URL = 'https://project-ref.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.OWNER_MEDIA_STORAGE_BUCKET = 'owner-media';

    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        ({
          ok: true,
          status: 200,
          text: async () => '',
        }) as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    const prisma = {
      business: {
        findUnique: async () => ({
          id: 'biz-1',
          name: 'Polished Studio',
          ownerUserId: 'user-owner-1',
        }),
      },
    };
    const service = new MarketplaceService(prisma as unknown as PrismaService);

    const uploaded = await service.uploadOwnerBusinessImage(
      'biz-1',
      {
        filename: 'hero.png',
        contentType: 'image/png',
        base64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2nK7cAAAAASUVORK5CYII=',
      },
      {
        id: 'user-owner-1',
        role: 'owner',
        name: 'Lina Nguyen',
        email: 'lina@polishedstudio.app',
      },
    );

    assert.match(
      uploaded.path,
      /^https:\/\/project-ref\.supabase\.co\/storage\/v1\/object\/public\/owner-media\/owners\/user-owner-1\/biz-1\/.+\.png$/,
    );
    assert.equal(fetchMock.mock.calls.length, 1);
    const [firstCall] = fetchMock.mock.calls;
    assert.ok(firstCall);
    assert.match(String(firstCall[0]), /\/storage\/v1\/object\/owner-media\//);
  });

  it('rejects uploads when the business does not belong to the authenticated owner', async () => {
    const prisma = {
      business: {
        findUnique: async () => ({
          id: 'biz-2',
          name: 'North Strand Hair',
          ownerUserId: 'user-owner-2',
        }),
      },
    };
    const service = new MarketplaceService(prisma as unknown as PrismaService);

    await assert.rejects(
      () =>
        service.uploadOwnerBusinessImage(
          'biz-2',
          {
            filename: 'hero.png',
            contentType: 'image/png',
            base64:
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2nK7cAAAAASUVORK5CYII=',
          },
          {
            id: 'user-owner-1',
            role: 'owner',
            name: 'Lina Nguyen',
            email: 'lina@polishedstudio.app',
          },
        ),
      ForbiddenException,
    );
  });
});
