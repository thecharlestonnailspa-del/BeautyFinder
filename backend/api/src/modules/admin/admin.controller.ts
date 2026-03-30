import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionPayload } from '@beauty-finder/types';
import { JwtAuthGuard } from '../../common/auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminService } from './admin.service';
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

  @Get('homepage-businesses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getHomepageBusinesses() {
    return this.adminService.getHomepageBusinesses();
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
