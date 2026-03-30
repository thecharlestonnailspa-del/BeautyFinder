import { Injectable } from '@nestjs/common';
import type {
  NotificationPreferenceInput,
  UserSummary,
} from '@beauty-finder/types';
import {
  markNotificationsReadSchema,
  notificationPreferenceSchema,
} from '@beauty-finder/validation';
import { MarketplaceService } from '../../common/marketplace.service';
import { MarkNotificationsReadDto } from './dto/mark-notifications-read.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly marketplace: MarketplaceService) {}

  getNotifications(actor: UserSummary, userId?: string) {
    return this.marketplace.getNotifications(actor, userId);
  }

  getNotificationPreferences(actor: UserSummary, userId?: string) {
    return this.marketplace.getNotificationPreferences(actor, userId);
  }

  updateNotificationPreferences(
    actor: UserSummary,
    input: UpdateNotificationPreferencesDto,
    userId?: string,
  ) {
    const parsed = notificationPreferenceSchema.parse(
      input,
    ) as NotificationPreferenceInput;
    return this.marketplace.updateNotificationPreferences(
      actor,
      parsed,
      userId,
    );
  }

  markNotificationsRead(
    actor: UserSummary,
    input: MarkNotificationsReadDto,
    userId?: string,
  ) {
    const parsed = markNotificationsReadSchema.parse(input);
    return this.marketplace.markNotificationsRead(actor, parsed, userId);
  }
}
