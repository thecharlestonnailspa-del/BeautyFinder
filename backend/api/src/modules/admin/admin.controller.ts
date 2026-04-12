import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Role, SessionPayload } from '@beauty-finder/types';
import { JwtAuthGuard } from '../../common/auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminService } from './admin.service';
import { CreateAdminAccessSessionDto } from './dto/create-admin-access-session.dto';
import { UpdateAdPricingDto } from './dto/update-ad-pricing.dto';
import { UpdateAdminAccountDto } from './dto/update-admin-account.dto';
import { UpdateBusinessStatusDto } from './dto/update-business-status.dto';
import { UpdateConversationCaseStatusDto } from './dto/update-conversation-case-status.dto';
import { UpdateHomepageBusinessDto } from './dto/update-homepage-business.dto';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';

type SessionRequest = Request & { session?: SessionPayload };

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('customer-insights/report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getCustomerPreferenceReport() {
    return this.adminService.getCustomerPreferenceReport();
  }

  @Get('ad-pricing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAdPricing() {
    return this.adminService.getAdPricing();
  }

  @Patch('ad-pricing/:placement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateAdPricing(
    @Param('placement') placement: 'homepage_spotlight' | 'category_boost' | 'city_boost',
    @Body() input: UpdateAdPricingDto,
    @Req() request: SessionRequest,
  ) {
    return this.adminService.updateAdPricing(
      placement,
      input,
      request.session!.user.id,
    );
  }

  @Get('homepage-businesses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getHomepageBusinesses() {
    return this.adminService.getHomepageBusinesses();
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAccounts(
    @Query('search') search?: string,
    @Query('role') role?: Role,
  ) {
    return this.adminService.getAccounts(search, role);
  }

  @Get('accounts/:accountId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAccount(@Param('accountId') accountId: string) {
    return this.adminService.getAccount(accountId);
  }

  @Patch('accounts/:accountId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateAccount(
    @Param('accountId') accountId: string,
    @Body() input: UpdateAdminAccountDto,
    @Req() request: SessionRequest,
  ) {
    return this.adminService.updateAccount(
      accountId,
      input,
      request.session!.user.id,
    );
  }

  @Post('accounts/:accountId/access-session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createAccessSession(
    @Param('accountId') accountId: string,
    @Body() input: CreateAdminAccessSessionDto,
    @Req() request: SessionRequest,
  ) {
    return this.adminService.createAccessSession(
      accountId,
      input,
      request.session!.user.id,
    );
  }

  @Get('businesses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getBusinesses(@Query('status') status?: UpdateBusinessStatusDto['status']) {
    return this.adminService.getBusinesses(status);
  }

  @Patch('businesses/:businessId/homepage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateHomepagePlacement(
    @Param('businessId') businessId: string,
    @Body() input: UpdateHomepageBusinessDto,
  ) {
    return this.adminService.updateHomepagePlacement(businessId, input);
  }

  @Patch('businesses/:businessId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateBusinessStatus(
    @Param('businessId') businessId: string,
    @Body() input: UpdateBusinessStatusDto,
    @Req() request: SessionRequest,
  ) {
    return this.adminService.updateBusinessStatus(
      businessId,
      input,
      request.session!.user.id,
    );
  }

  @Get('reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getReviews(@Query('status') status?: UpdateReviewStatusDto['status']) {
    return this.adminService.getReviews(status);
  }

  @Patch('reviews/:reviewId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateReviewStatus(
    @Param('reviewId') reviewId: string,
    @Body() input: UpdateReviewStatusDto,
    @Req() request: SessionRequest,
  ) {
    return this.adminService.updateReviewStatus(
      reviewId,
      input,
      request.session!.user.id,
    );
  }

  @Get('conversations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getConversations() {
    return this.adminService.getConversations();
  }

  @Patch('conversations/:conversationId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateConversationCaseStatus(
    @Param('conversationId') conversationId: string,
    @Body() input: UpdateConversationCaseStatusDto,
    @Req() request: SessionRequest,
  ) {
    return this.adminService.updateConversationCaseStatus(
      conversationId,
      input,
      request.session!.user.id,
    );
  }

  @Get('audit-actions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAuditActions() {
    return this.adminService.getAuditActions();
  }
}
