import { Module } from '@nestjs/common';
import { VmController } from './vm.controller';
import { VmRepository } from './vm.repository';
import { VmService } from './vm.service';

@Module({
  controllers: [VmController],
  providers: [VmService, VmRepository],
  exports: [VmService],
})
export class VmModule {}
