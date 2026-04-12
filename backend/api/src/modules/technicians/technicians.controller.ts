import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { JwtAuthGuard } from '../../common/auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreatePrivateTechnicianAdDto } from './dto/create-private-technician-ad.dto';
import { UpdatePrivateTechnicianAdDto } from './dto/update-private-technician-ad.dto';
import { UpdatePrivateTechnicianProfileDto } from './dto/update-private-technician-profile.dto';
import { TechniciansService } from './technicians.service';

@Controller('technicians')
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Get('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('technician')
  getMyProfile(@Req() request: AuthenticatedRequest) {
    return this.techniciansService.getPrivateProfile(request.session!.user);
  }

  @Put('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('technician')
  updateMyProfile(
    @Body() input: UpdatePrivateTechnicianProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.techniciansService.updatePrivateProfile(input, request.session!.user);
  }

  @Post('me/ads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('technician')
  createAd(
    @Body() input: CreatePrivateTechnicianAdDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.techniciansService.createAd(input, request.session!.user);
  }

  @Patch('me/ads/:adId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('technician')
  updateAd(
    @Param('adId') adId: string,
    @Body() input: UpdatePrivateTechnicianAdDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.techniciansService.updateAd(adId, input, request.session!.user);
  }
}
