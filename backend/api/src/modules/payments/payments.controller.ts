import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Role } from '@beauty-finder/types';
import { JwtAuthGuard } from '../../common/auth.guard';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CheckoutPaymentDto } from './dto/checkout-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  getPayments(
    @Query('userId') userId: string | undefined,
    @Query('role') role: Role | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentsService.getPayments(
      request.session!.user,
      userId,
      role,
    );
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'owner', 'admin')
  checkoutPayment(
    @Body() input: CheckoutPaymentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentsService.checkoutPayment(input, request.session!.user);
  }
}
