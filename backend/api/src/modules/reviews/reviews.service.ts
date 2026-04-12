import { Injectable } from '@nestjs/common';
import type { UserSummary } from '@beauty-finder/types';
import { MarketplaceService } from '../../common/marketplace.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly marketplace: MarketplaceService) {}

  getReviews(businessId: string) {
    return this.marketplace.getReviews(businessId);
  }

  createReview(input: CreateReviewDto, actor: UserSummary) {
    return this.marketplace.createReview(input, actor);
  }
}
