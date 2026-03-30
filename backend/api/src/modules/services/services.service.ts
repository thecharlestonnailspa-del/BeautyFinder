import { Injectable } from '@nestjs/common';
import { MarketplaceService } from '../../common/marketplace.service';

@Injectable()
export class ServicesService {
  constructor(private readonly marketplace: MarketplaceService) {}

  listServices(businessId?: string) {
    return this.marketplace.getServices(businessId);
  }
}
