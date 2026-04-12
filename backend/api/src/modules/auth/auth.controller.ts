import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { JwtAuthGuard } from '../../common/auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterBusinessOwnerDto } from './dto/register-business-owner.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterTechnicianDto } from './dto/register-technician.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('session')
  @UseGuards(JwtAuthGuard)
  getSession(@Req() request: AuthenticatedRequest) {
    return request.session;
  }

  @Post('login')
  login(@Body() input: LoginDto) {
    return this.authService.login(input);
  }

  @Post('register/customer')
  registerCustomer(@Body() input: RegisterCustomerDto) {
    return this.authService.registerCustomer(input);
  }

  @Post('register/business')
  registerBusiness(@Body() input: RegisterBusinessOwnerDto) {
    return this.authService.registerBusinessOwner(input);
  }

  @Post('register/technician')
  registerTechnician(@Body() input: RegisterTechnicianDto) {
    return this.authService.registerTechnician(input);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() request: AuthenticatedRequest) {
    const userId = request.session?.user.id;
    const user = userId ? await this.authService.getUser(userId) : undefined;

    if (!user) {
      throw new NotFoundException('Authenticated user was not found');
    }

    return user;
  }
}
