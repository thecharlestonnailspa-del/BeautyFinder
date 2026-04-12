import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterBusinessOwnerDto {
  @IsString()
  @MinLength(2)
  ownerName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsString()
  @MinLength(2)
  businessName!: string;

  @IsIn(['nail', 'hair'])
  category!: 'nail' | 'hair';

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(3)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsString()
  @MinLength(2)
  city!: string;

  @IsString()
  @MinLength(2)
  state!: string;

  @IsString()
  @MinLength(3)
  postalCode!: string;

  @IsOptional()
  @IsString()
  businessPhone?: string;

  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @IsString()
  @MinLength(4)
  salonLicenseNumber!: string;

  @IsString()
  @MinLength(4)
  businessLicenseNumber!: string;

  @IsString()
  @MinLength(4)
  einNumber!: string;
}
