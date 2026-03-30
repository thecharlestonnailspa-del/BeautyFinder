import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../../common/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @Get()
  async getHealth() {
    return {
      name: 'beauty-finder-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: await this.redisService.getHealth(),
      },
    };
  }
}
