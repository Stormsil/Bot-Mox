import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';
import { RuntimeMetricsService } from './runtime-metrics.service';

@Module({
  imports: [AuthModule],
  controllers: [ObservabilityController],
  providers: [ObservabilityService, RuntimeMetricsService],
  exports: [RuntimeMetricsService],
})
export class ObservabilityModule {}
