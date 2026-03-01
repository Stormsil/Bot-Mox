import { Module } from '@nestjs/common';
import { VmHardwareService } from './hardware-generator/vm-hardware.service';
import { VmController } from './vm.controller';
import { VmRepository } from './vm.repository';
import { VmService } from './vm.service';

@Module({
  controllers: [VmController],
  providers: [VmService, VmRepository, VmHardwareService],
  exports: [VmService, VmHardwareService],
})
export class VmModule {}
