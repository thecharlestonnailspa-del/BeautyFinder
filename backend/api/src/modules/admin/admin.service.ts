import { Injectable } from '@nestjs/common';
import { MarketplaceService } from '../../common/marketplace.service';
import { UpdateBusinessStatusDto } from './dto/update-business-status.dto';
import { UpdateConversationCaseStatusDto } from './dto/update-conversation-case-status.dto';
import { UpdateHomepageBusinessDto } from './dto/update-homepage-business.dto';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';

@Injectable()
export class AdminService {
  constructor(private readonly marketplace: MarketplaceService) {}

  getOverview() {
    return this.marketplace.getAdminOverview();
  }

  getHomepageBusinesses() {
    return this.marketplace.getHomepageBusinesses();
  }

  getBusinesses(status?: UpdateBusinessStatusDto['status']) {
    return this.marketplace.getAdminBusinesses(status);
  }

  updateHomepagePlacement(
    businessId: string,
    input: UpdateHomepageBusinessDto,
  ) {
    return this.marketplace.updateHomepagePlacement(businessId, input);
  }

  updateBusinessStatus(
    businessId: string,
    input: UpdateBusinessStatusDto,
    adminUserId: string,
  ) {
    return this.marketplace.updateBusinessStatus(
      businessId,
      input,
      adminUserId,
    );
  }

  getReviews(status?: UpdateReviewStatusDto['status']) {
    return this.marketplace.getAdminReviews(status);
  }

  updateReviewStatus(
    reviewId: string,
    input: UpdateReviewStatusDto,
    adminUserId: string,
  ) {
    return this.marketplace.updateReviewStatus(reviewId, input, adminUserId);
  }

  getConversations() {
    return this.marketplace.getAdminConversationCases();
  }

  updateConversationCaseStatus(
    conversationId: string,
    input: UpdateConversationCaseStatusDto,
    adminUserId: string,
  ) {
    return this.marketplace.updateConversationCaseStatus(
      conversationId,
      input,
      adminUserId,
    );
  }

  getAuditActions() {
    return this.marketplace.getAdminAuditActions();
  }
}
