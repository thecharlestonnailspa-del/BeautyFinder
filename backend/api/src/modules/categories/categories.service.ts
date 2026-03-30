import { Injectable } from '@nestjs/common';
import { MarketplaceService } from '../../common/marketplace.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly marketplace: MarketplaceService) {}

  listCategories() {
    return this.marketplace.getCategories();
  }
}
