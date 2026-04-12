import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { getOwnerMediaStorageConfig } from './owner-media-storage.config';

@Injectable()
export class OwnerMediaStorageService {
  async uploadBusinessImage(input: {
    ownerId: string;
    businessId: string;
    buffer: Buffer;
    contentType: string;
    extension: string;
  }) {
    const config = getOwnerMediaStorageConfig();
    const storedFilename = `${Date.now()}-${randomUUID()}.${input.extension}`;
    const objectPath = this.buildObjectPath(
      config.pathPrefix,
      'owners',
      input.ownerId,
      input.businessId,
      storedFilename,
    );

    if (config.driver === 'local') {
      const targetFile = join(config.uploadsDirectory, objectPath);
      await mkdir(join(config.uploadsDirectory, posix.dirname(objectPath)), {
        recursive: true,
      });
      await writeFile(targetFile, input.buffer);

      return {
        contentType: input.contentType,
        path: `${config.publicBasePath}/${objectPath}`,
        size: input.buffer.byteLength,
      };
    }

    const uploadUrl = `${config.supabaseUrl}/storage/v1/object/${encodeURIComponent(
      config.bucket,
    )}/${this.encodeObjectPath(objectPath)}`;
    const uploadBody = Uint8Array.from(input.buffer);
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
        'Content-Type': input.contentType,
        'x-upsert': 'false',
      },
      body: uploadBody,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new InternalServerErrorException(
        `Owner media upload failed for object storage: ${response.status}${
          errorBody ? ` ${errorBody}` : ''
        }`,
      );
    }

    return {
      contentType: input.contentType,
      path: `${config.publicBaseUrl}/${this.encodeObjectPath(objectPath)}`,
      size: input.buffer.byteLength,
    };
  }

  private buildObjectPath(...segments: string[]) {
    return segments
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join('/');
  }

  private encodeObjectPath(path: string) {
    return path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }
}
