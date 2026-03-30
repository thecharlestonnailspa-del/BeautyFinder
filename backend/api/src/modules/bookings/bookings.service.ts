import { Injectable } from '@nestjs/common';
import type { Role, UserSummary } from '@beauty-finder/types';
import { createBookingSchema } from '@beauty-finder/validation';
import { MarketplaceService } from '../../common/marketplace.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly marketplace: MarketplaceService) {}

  getBookings(actor: UserSummary, userId?: string, role?: Role) {
    return this.marketplace.getBookings(actor, userId, role);
  }

  createBooking(input: CreateBookingDto, actor: UserSummary) {
    const parsed = createBookingSchema.parse(input);
    return this.marketplace.createBooking(parsed, actor);
  }
}
