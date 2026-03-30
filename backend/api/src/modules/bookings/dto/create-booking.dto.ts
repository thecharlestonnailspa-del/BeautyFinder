import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  customerId!: string;

  @IsString()
  ownerId!: string;

  @IsString()
  businessId!: string;

  @IsString()
  serviceId!: string;

  @IsString()
  serviceName!: string;

  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
