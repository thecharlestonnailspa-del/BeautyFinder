import { Injectable } from '@nestjs/common';
import { MarketplaceService } from '../../common/marketplace.service';

@Injectable()
export class AvailabilityService {
  constructor(private readonly marketplace: MarketplaceService) {}

  listAvailability(businessId?: string, serviceId?: string) {
    return this.marketplace.getAvailability(businessId, serviceId);
  }
}
