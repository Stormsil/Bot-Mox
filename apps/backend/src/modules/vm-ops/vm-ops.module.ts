import { Module } from '@nestjs/common';
import { VmOpsController } from './vm-ops.controller';
import { VmOpsRepository } from './vm-ops.repository';
import { VmOpsService } from './vm-ops.service';

@Module({
  providers: [VmOpsService, VmOpsRepository],
  controllers: [VmOpsController],
})
export class VmOpsModule {}
