import { Module } from '@nestjs/common';
import { InfraController } from './infra.controller';
import { InfraRepository } from './infra.repository';
import { InfraService } from './infra.service';
import { InfraVmDeletionReadFacade } from './infra-vm-deletion-read.facade';
import { InfraVmsController } from './infra-vms.controller';

@Module({
  controllers: [InfraController, InfraVmsController],
  providers: [InfraRepository, InfraService, InfraVmDeletionReadFacade],
  exports: [InfraVmDeletionReadFacade],
})
export class InfraModule {}
