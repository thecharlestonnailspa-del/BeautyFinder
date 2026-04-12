import { Injectable } from '@nestjs/common';
import type { AdPlacement, Role } from '@beauty-finder/types';
import { MarketplaceService } from '../../common/marketplace.service';
import { CreateAdminAccessSessionDto } from './dto/create-admin-access-session.dto';
import { UpdateAdPricingDto } from './dto/update-ad-pricing.dto';
import { UpdateAdminAccountDto } from './dto/update-admin-account.dto';
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

  getCustomerPreferenceReport() {
    return this.marketplace.getCustomerPreferenceReport();
  }

  getAdPricing() {
    return this.marketplace.getAdPricing();
  }

  updateAdPricing(
    placement: AdPlacement,
    input: UpdateAdPricingDto,
    adminUserId: string,
  ) {
    return this.marketplace.updateAdPricing(placement, input, adminUserId);
  }

  getHomepageBusinesses() {
    return this.marketplace.getHomepageBusinesses();
  }

  getAccounts(search?: string, role?: Role) {
    return this.marketplace.getAdminAccounts(search, role);
  }

  getAccount(accountId: string) {
    return this.marketplace.getAdminAccount(accountId);
  }

  updateAccount(
    accountId: string,
    input: UpdateAdminAccountDto,
    adminUserId: string,
  ) {
    return this.marketplace.updateAdminAccount(accountId, input, adminUserId);
  }

  createAccessSession(
    accountId: string,
    input: CreateAdminAccessSessionDto,
    adminUserId: string,
  ) {
    return this.marketplace.createAdminAccessSession(
      accountId,
      adminUserId,
      input.note,
    );
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
