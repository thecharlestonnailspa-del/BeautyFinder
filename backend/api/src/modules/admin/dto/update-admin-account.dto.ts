import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UserStatus } from '@beauty-finder/types';

export class UpdateAdminAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsIn(['active', 'pending', 'suspended', 'deleted'])
  status?: UserStatus;
}
