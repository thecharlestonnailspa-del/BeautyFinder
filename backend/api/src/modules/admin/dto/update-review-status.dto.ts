import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ReviewModerationStatus } from '@beauty-finder/types';

export class UpdateReviewStatusDto {
  @IsIn(['published', 'hidden', 'flagged'])
  status!: ReviewModerationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
