import { Module } from '@nestjs/common';
import { InfraController } from './infra.controller';
import { InfraRepository } from './infra.repository';
import { InfraService } from './infra.service';
import { InfraVmsController } from './infra-vms.controller';

@Module({
  controllers: [InfraController, InfraVmsController],
  providers: [InfraRepository, InfraService],
})
export class InfraModule {}
