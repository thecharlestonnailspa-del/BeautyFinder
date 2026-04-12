import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAdminAccessSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
