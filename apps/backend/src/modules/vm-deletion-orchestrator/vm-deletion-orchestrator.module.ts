import { Module } from '@nestjs/common';
import { BotsModule } from '../bots/bots.module';
import { InfraModule } from '../infra/infra.module';
import { ResourcesModule } from '../resources/resources.module';
import { VmDeletionOrchestratorController } from './vm-deletion-orchestrator.controller';
import { VmDeletionOrchestratorService } from './vm-deletion-orchestrator.service';

@Module({
  imports: [InfraModule, BotsModule, ResourcesModule],
  controllers: [VmDeletionOrchestratorController],
  providers: [VmDeletionOrchestratorService],
  exports: [VmDeletionOrchestratorService],
})
export class VmDeletionOrchestratorModule {}
