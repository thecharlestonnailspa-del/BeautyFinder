import { Injectable } from '@nestjs/common';
import type { Role, UserSummary } from '@beauty-finder/types';
import { checkoutPaymentSchema } from '@beauty-finder/validation';
import { MarketplaceService } from '../../common/marketplace.service';
import { CheckoutPaymentDto } from './dto/checkout-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly marketplace: MarketplaceService) {}

  getPayments(actor: UserSummary, userId?: string, role?: Role) {
    return this.marketplace.getPayments(actor, userId, role);
  }

  checkoutPayment(input: CheckoutPaymentDto, actor: UserSummary) {
    const parsed = checkoutPaymentSchema.parse(input);
    return this.marketplace.checkoutPayment(parsed, actor);
  }
}
