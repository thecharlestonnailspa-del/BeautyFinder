import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { BusinessesService } from './businesses.service';
import { UploadOwnerBusinessImageDto } from './dto/upload-owner-business-image.dto';
import { UpdateOwnerTechnicianRosterDto } from './dto/update-owner-technician-roster.dto';
import { UpdateOwnerBusinessDto } from './dto/update-owner-business.dto';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  listBusinesses(
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ) {
    return this.businessesService.listBusinesses({ category, city, search });
  }

  @Get('owner/manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  getAuthenticatedOwnerBusinesses(@Req() request: AuthenticatedRequest) {
    return this.businessesService.getOwnerBusinesses(
      request.session!.user.id,
      request.session!.user,
    );
  }

  @Get('owner/:ownerId/manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getOwnerBusinessesForAdmin(
    @Param('ownerId') ownerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.businessesService.getOwnerBusinesses(
      ownerId,
      request.session!.user,
    );
  }

  @Get(':id')
  async getBusiness(@Param('id') id: string) {
    const business = await this.businessesService.getBusiness(id);

    if (!business) {
      throw new NotFoundException(`Business ${id} was not found`);
    }

    return business;
  }

  @Get(':id/owner-technicians')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  getOwnerTechnicians(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.businessesService.getOwnerTechnicians(id, request.session!.user);
  }

  @Patch(':id/owner-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  updateOwnerBusiness(
    @Param('id') id: string,
    @Body() input: UpdateOwnerBusinessDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.businessesService.updateOwnerBusiness(
      id,
      input,
      request.session!.user,
    );
  }

  @Put(':id/owner-technicians')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  updateOwnerTechnicians(
    @Param('id') id: string,
    @Body() input: UpdateOwnerTechnicianRosterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.businessesService.updateOwnerTechnicians(
      id,
      input,
      request.session!.user,
    );
  }

  @Patch(':id/owner-media/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  uploadOwnerBusinessImage(
    @Param('id') id: string,
    @Body() input: UploadOwnerBusinessImageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.businessesService.uploadOwnerBusinessImage(
      id,
      input,
      request.session!.user,
    );
  }
}
