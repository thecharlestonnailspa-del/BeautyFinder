import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { Role } from '@beauty-finder/types';
import { JwtAuthGuard } from '../../common/auth.guard';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Req } from '@nestjs/common';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  getBookings(
    @Query('userId') userId: string | undefined,
    @Query('role') role: Role | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.bookingsService.getBookings(
      request.session!.user,
      userId,
      role,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  createBooking(
    @Body() input: CreateBookingDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.bookingsService.createBooking(input, request.session!.user);
  }
}
