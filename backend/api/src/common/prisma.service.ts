import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private validateDatabaseUrl() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required before starting the API');
    }

    if (databaseUrl.includes('[YOUR-PASSWORD]') || databaseUrl.includes('YOUR_PASSWORD')) {
      throw new Error('Replace the placeholder password in DATABASE_URL before starting the API');
    }
  }

  async onModuleInit() {
    this.validateDatabaseUrl();
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
