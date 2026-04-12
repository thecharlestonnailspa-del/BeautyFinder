import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateOwnerServiceDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(5000)
  price!: number;

  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateOwnerStaffDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}

export class UpdatePromotionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent!: number;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class UpdateOwnerBusinessDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  heroImage?: string;

  @IsOptional()
  @IsString()
  businessLogo?: string;

  @IsOptional()
  @IsString()
  businessBanner?: string;

  @IsOptional()
  @IsString()
  ownerAvatar?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  galleryImages?: string[];

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePromotionDto)
  promotion?: UpdatePromotionDto | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOwnerServiceDto)
  services?: UpdateOwnerServiceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOwnerStaffDto)
  staff?: UpdateOwnerStaffDto[];
}
