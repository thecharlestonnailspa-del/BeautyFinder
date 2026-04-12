import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordBusinessPageViewDto {
  @IsOptional()
  @IsString()
  selectedServiceId?: string;

  @IsOptional()
  @IsString()
  selectedServiceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsInt()
  @Min(1)
  @Max(3600)
  dwellSeconds!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colorSignals?: string[];

  @IsOptional()
  @IsString()
  source?: string;
}
