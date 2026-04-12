import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OwnerTechnicianDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsBoolean()
  isActive!: boolean;
}

export class UpdateOwnerTechnicianRosterDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerTechnicianDto)
  technicians!: OwnerTechnicianDto[];
}
