import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class MarkNotificationsReadDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notificationIds?: string[];

  @IsOptional()
  @IsBoolean()
  markAll?: boolean;
}
