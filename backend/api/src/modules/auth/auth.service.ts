import { Injectable } from '@nestjs/common';
import { MarketplaceService } from '../../common/marketplace.service';
import { LoginDto } from './dto/login.dto';
import { RegisterBusinessOwnerDto } from './dto/register-business-owner.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';

@Injectable()
export class AuthService {
  constructor(private readonly marketplace: MarketplaceService) {}

  login(input: LoginDto) {
    return this.marketplace.login(input);
  }

  registerCustomer(input: RegisterCustomerDto) {
    return this.marketplace.registerCustomer(input);
  }

  registerBusinessOwner(input: RegisterBusinessOwnerDto) {
    return this.marketplace.registerBusinessOwner(input);
  }

  getUser(userId: string) {
    return this.marketplace.getUserById(userId);
  }
}
