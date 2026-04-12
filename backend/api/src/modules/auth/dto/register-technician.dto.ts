import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterTechnicianDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  category?: 'nail' | 'hair';

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  heroImage?: string;

  @IsString()
  @MinLength(4)
  identityCardNumber!: string;

  @IsString()
  @MinLength(4)
  ssaNumber!: string;

  @IsString()
  @MinLength(4)
  licenseNumber!: string;

  @IsString()
  @MinLength(2)
  licenseState!: string;
}
