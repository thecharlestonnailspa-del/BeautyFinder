import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  getFavorites(@Req() request: AuthenticatedRequest) {
    return this.favoritesService.getFavorites(request.session!.user);
  }

  @Post(':businessId')
  addFavorite(
    @Param('businessId') businessId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.favoritesService.addFavorite(request.session!.user, businessId);
  }

  @Delete(':businessId')
  removeFavorite(
    @Param('businessId') businessId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.favoritesService.removeFavorite(
      request.session!.user,
      businessId,
    );
  }
}
