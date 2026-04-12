import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdatePrivateTechnicianAdDto {
  @IsOptional()
  @IsString()
  campaignName?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  destinationUrl?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100000)
  budget?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'completed', 'cancelled'])
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
}
