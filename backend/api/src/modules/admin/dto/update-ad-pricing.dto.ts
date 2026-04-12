import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateAdPricingDto {
  @IsNumber()
  @Min(0)
  dailyPrice!: number;

  @IsNumber()
  @Min(0)
  monthlyPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
