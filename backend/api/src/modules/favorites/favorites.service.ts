import { Injectable } from '@nestjs/common';
import type { UserSummary } from '@beauty-finder/types';
import { MarketplaceService } from '../../common/marketplace.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly marketplace: MarketplaceService) {}

  getFavorites(actor: UserSummary) {
    return this.marketplace.getFavorites(actor);
  }

  addFavorite(actor: UserSummary, businessId: string) {
    return this.marketplace.addFavorite(actor, businessId);
  }

  removeFavorite(actor: UserSummary, businessId: string) {
    return this.marketplace.removeFavorite(actor, businessId);
  }
}
