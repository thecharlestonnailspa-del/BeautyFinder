import { Injectable } from '@nestjs/common';
import { MarketplaceService } from '../../common/marketplace.service';

@Injectable()
export class UsersService {
  constructor(private readonly marketplace: MarketplaceService) {}

  listUsers() {
    return this.marketplace.listUsers();
  }

  getUser(id: string) {
    return this.marketplace.getUserById(id);
  }
}
