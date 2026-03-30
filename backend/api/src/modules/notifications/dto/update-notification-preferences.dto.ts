import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  bookingCreated?: boolean;

  @IsOptional()
  @IsBoolean()
  bookingConfirmed?: boolean;

  @IsOptional()
  @IsBoolean()
  messageReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentReceipt?: boolean;

  @IsOptional()
  @IsBoolean()
  reviewReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  system?: boolean;
}
