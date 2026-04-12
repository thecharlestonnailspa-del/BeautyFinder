import { Injectable } from '@nestjs/common';
import type { UserSummary } from '@beauty-finder/types';
import { MarketplaceService } from '../../common/marketplace.service';
import { RecordBusinessPageViewDto } from './dto/record-business-page-view.dto';

@Injectable()
export class CustomerInsightsService {
  constructor(private readonly marketplace: MarketplaceService) {}

  recordBusinessPageView(
    businessId: string,
    input: RecordBusinessPageViewDto,
    actor: UserSummary,
  ) {
    return this.marketplace.recordBusinessPageView(businessId, input, actor);
  }

  getOwnerAudienceReport(actor: UserSummary) {
    return this.marketplace.getOwnerAudienceReport(actor.id, actor);
  }

  getCustomerPreferenceReport() {
    return this.marketplace.getCustomerPreferenceReport();
  }
}
