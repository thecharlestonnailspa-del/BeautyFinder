import { Injectable } from '@nestjs/common';
import { businessSearchSchema } from '@beauty-finder/validation';
import { MarketplaceService } from '../../common/marketplace.service';

@Injectable()
export class SearchService {
  constructor(private readonly marketplace: MarketplaceService) {}

  search(input: { category?: string; city?: string; search?: string }) {
    const normalizedInput = {
      category: input.category || undefined,
      city: input.city || undefined,
      search: input.search || undefined,
    };

    const parsed = businessSearchSchema.parse(normalizedInput);
    return this.marketplace.getBusinesses(parsed);
  }
}
