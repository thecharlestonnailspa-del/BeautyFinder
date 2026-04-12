import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePrivateTechnicianAdDto {
  @IsString()
  campaignName!: string;

  @IsIn(['homepage_spotlight', 'category_boost', 'city_boost'])
  placement!: 'homepage_spotlight' | 'category_boost' | 'city_boost';

  @IsString()
  headline!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  destinationUrl?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100000)
  budget!: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'completed', 'cancelled'])
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
}
