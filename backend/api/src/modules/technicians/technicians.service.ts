import { Injectable } from '@nestjs/common';
import type {
  CreatePrivateTechnicianAdInput,
  UpdatePrivateTechnicianAdInput,
  UpdatePrivateTechnicianProfileInput,
  UserSummary,
} from '@beauty-finder/types';
import { MarketplaceService } from '../../common/marketplace.service';

@Injectable()
export class TechniciansService {
  constructor(private readonly marketplace: MarketplaceService) {}

  getPrivateProfile(actor: UserSummary) {
    return this.marketplace.getPrivateTechnicianProfile(actor);
  }

  updatePrivateProfile(
    input: UpdatePrivateTechnicianProfileInput,
    actor: UserSummary,
  ) {
    return this.marketplace.updatePrivateTechnicianProfile(input, actor);
  }

  createAd(input: CreatePrivateTechnicianAdInput, actor: UserSummary) {
    return this.marketplace.createPrivateTechnicianAd(input, actor);
  }

  updateAd(adId: string, input: UpdatePrivateTechnicianAdInput, actor: UserSummary) {
    return this.marketplace.updatePrivateTechnicianAd(adId, input, actor);
  }
}
