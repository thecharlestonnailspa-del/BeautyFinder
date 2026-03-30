import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AdminConversationCaseStatus } from '@beauty-finder/types';

export class UpdateConversationCaseStatusDto {
  @IsIn(['open', 'watched', 'resolved'])
  status!: AdminConversationCaseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
