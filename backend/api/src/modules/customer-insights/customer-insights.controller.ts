import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { JwtAuthGuard } from '../../common/auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { RecordBusinessPageViewDto } from './dto/record-business-page-view.dto';
import { CustomerInsightsService } from './customer-insights.service';

@Controller('customer-insights')
export class CustomerInsightsController {
  constructor(private readonly customerInsightsService: CustomerInsightsService) {}

  @Post('businesses/:businessId/page-view')
  @UseGuards(JwtAuthGuard)
  recordBusinessPageView(
    @Param('businessId') businessId: string,
    @Body() input: RecordBusinessPageViewDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customerInsightsService.recordBusinessPageView(
      businessId,
      input,
      request.session!.user,
    );
  }

  @Get('owner/report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  getOwnerAudienceReport(@Req() request: AuthenticatedRequest) {
    return this.customerInsightsService.getOwnerAudienceReport(request.session!.user);
  }
}
