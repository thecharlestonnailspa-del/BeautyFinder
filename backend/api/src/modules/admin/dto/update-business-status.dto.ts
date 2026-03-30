import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { BusinessModerationStatus } from '@beauty-finder/types';

export class UpdateBusinessStatusDto {
  @IsIn(['draft', 'pending_review', 'approved', 'rejected', 'suspended'])
  status!: BusinessModerationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
