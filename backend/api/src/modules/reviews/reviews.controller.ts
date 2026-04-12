import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/auth.types';
import { JwtAuthGuard } from '../../common/auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  getReviews(@Query('businessId') businessId: string) {
    return this.reviewsService.getReviews(businessId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createReview(
    @Body() input: CreateReviewDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reviewsService.createReview(input, request.session!.user);
  }
}
