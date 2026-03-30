import { IsBase64, IsOptional, IsString, Matches } from 'class-validator';

export class UploadOwnerBusinessImageDto {
  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @Matches(/^image\/(png|jpeg|jpg|webp|gif|avif|heic|heif)$/i)
  contentType?: string;

  @IsString()
  @IsBase64()
  base64!: string;
}
