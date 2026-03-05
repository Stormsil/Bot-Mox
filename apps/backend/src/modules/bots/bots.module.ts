import { Module } from '@nestjs/common';
import { BotsController } from './bots.controller';
import { BotsRepository } from './bots.repository';
import { BotsService } from './bots.service';
import { BotsVmDeletionReadFacade } from './bots-vm-deletion-read.facade';

@Module({
  controllers: [BotsController],
  providers: [BotsService, BotsRepository, BotsVmDeletionReadFacade],
  exports: [BotsVmDeletionReadFacade],
})
export class BotsModule {}
