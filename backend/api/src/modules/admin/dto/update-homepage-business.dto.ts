import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateHomepageBusinessDto {
  @IsBoolean()
  featuredOnHomepage!: boolean;

  @IsInt()
  @Min(1)
  homepageRank!: number;
}
