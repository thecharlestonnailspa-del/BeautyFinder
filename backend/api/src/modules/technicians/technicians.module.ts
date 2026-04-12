import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';

@Module({
  imports: [CommonModule],
  controllers: [TechniciansController],
  providers: [TechniciansService],
})
export class TechniciansModule {}
