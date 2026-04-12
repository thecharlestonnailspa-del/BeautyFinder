import { Module } from '@nestjs/common';
import { CustomerInsightsController } from './customer-insights.controller';
import { CustomerInsightsService } from './customer-insights.service';

@Module({
  controllers: [CustomerInsightsController],
  providers: [CustomerInsightsService],
  exports: [CustomerInsightsService],
})
export class CustomerInsightsModule {}
