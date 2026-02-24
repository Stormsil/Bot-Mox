import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { VmOpsController } from './vm-ops.controller';
import { VmOpsRepository } from './vm-ops.repository';
import { VmOpsService } from './vm-ops.service';

@Module({
  imports: [AgentsModule],
  providers: [VmOpsService, VmOpsRepository],
  controllers: [VmOpsController],
})
export class VmOpsModule {}
