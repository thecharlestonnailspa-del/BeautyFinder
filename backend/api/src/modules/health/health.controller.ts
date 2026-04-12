import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  async getHealth() {
    const [database, redis] = await Promise.all([
      this.prismaService.getHealth(),
      this.redisService.getHealth(),
    ]);

    return {
      name: 'beauty-finder-api',
      status: database.status === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
      },
    };
  }
}
