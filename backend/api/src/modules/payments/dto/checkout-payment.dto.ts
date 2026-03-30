import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CheckoutPaymentDto {
  @IsString()
  bookingId!: string;

  @IsString()
  @IsIn(['card', 'cash'])
  method!: 'card' | 'cash';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  tipAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cardBrand?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  cardLast4?: string;
}
