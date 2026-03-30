import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ) {
    return this.searchService.search({ category, city, search });
  }
}
