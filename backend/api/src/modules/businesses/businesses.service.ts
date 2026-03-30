import { Injectable } from '@nestjs/common';
import type {
  OwnerBusinessUpdateInput,
  UserSummary,
} from '@beauty-finder/types';
import { MarketplaceService } from '../../common/marketplace.service';
import { UploadOwnerBusinessImageDto } from './dto/upload-owner-business-image.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly marketplace: MarketplaceService) {}

  listBusinesses(filters: {
    category?: string;
    city?: string;
    search?: string;
  }) {
    return this.marketplace.getBusinesses(filters);
  }

  getBusiness(id: string) {
    return this.marketplace.getBusiness(id);
  }

  getOwnerBusinesses(ownerId: string, actor: UserSummary) {
    return this.marketplace.getOwnerBusinesses(ownerId, actor);
  }

  uploadOwnerBusinessImage(
    businessId: string,
    input: UploadOwnerBusinessImageDto,
    actor: UserSummary,
  ) {
    return this.marketplace.uploadOwnerBusinessImage(businessId, input, actor);
  }

  updateOwnerBusiness(
    id: string,
    input: OwnerBusinessUpdateInput,
    actor: UserSummary,
  ) {
    return this.marketplace.updateOwnerBusiness(id, input, actor);
  }
}
