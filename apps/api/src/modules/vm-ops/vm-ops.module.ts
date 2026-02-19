import { Module } from '@nestjs/common';
import { VmOpsController } from './vm-ops.controller';
import { VmOpsService } from './vm-ops.service';

@Module({
  providers: [VmOpsService],
  controllers: [VmOpsController],
})
export class VmOpsModule {}
