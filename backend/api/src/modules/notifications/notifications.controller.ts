import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth.guard';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { MarkNotificationsReadDto } from './dto/mark-notifications-read.dto';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  getNotifications(
    @Query('userId') userId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.getNotifications(
      request.session!.user,
      userId,
    );
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  getNotificationPreferences(
    @Query('userId') userId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.getNotificationPreferences(
      request.session!.user,
      userId,
    );
  }

  @Put('preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  updateNotificationPreferences(
    @Body() input: UpdateNotificationPreferencesDto,
    @Query('userId') userId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.updateNotificationPreferences(
      request.session!.user,
      input,
      userId,
    );
  }

  @Post('read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  markNotificationsRead(
    @Body() input: MarkNotificationsReadDto,
    @Query('userId') userId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.markNotificationsRead(
      request.session!.user,
      input,
      userId,
    );
  }
}
