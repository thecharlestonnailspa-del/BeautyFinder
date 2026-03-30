import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  senderId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}
