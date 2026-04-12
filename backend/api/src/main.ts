import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { getJwtSecret } from './common/auth.config';
import {
  getAllowedCorsOrigins,
  isCorsOriginAllowed,
  rateLimitExposedHeaders,
} from './common/cors.config';
import { getOwnerMediaStorageConfig } from './common/owner-media-storage.config';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  getJwtSecret();
  const ownerMediaStorage = getOwnerMediaStorageConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const host = process.env.HOST ?? '127.0.0.1';
  const allowedOrigins = getAllowedCorsOrigins();

  app.setGlobalPrefix('api');
  app.set('query parser', 'extended');
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));
  if (ownerMediaStorage.driver === 'local') {
    app.useStaticAssets(ownerMediaStorage.uploadsDirectory, { prefix: '/uploads/' });
  }
  app.enableCors({
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type'],
    exposedHeaders: rateLimitExposedHeaders,
    maxAge: 60 * 60,
    optionsSuccessStatus: 204,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  await app.listen(port, host);
}

bootstrap();
