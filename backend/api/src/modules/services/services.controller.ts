import { Controller, Get, Query } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  listServices(@Query('businessId') businessId?: string) {
    return this.servicesService.listServices(businessId);
  }
}
