import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesLifecycleEventsHandler } from './resources.lifecycle-events.handler';
import { ResourcesRepository } from './resources.repository';
import { ResourcesService } from './resources.service';
import { ResourcesVmDeletionReadFacade } from './resources-vm-deletion-read.facade';

@Module({
  controllers: [ResourcesController],
  providers: [
    ResourcesService,
    ResourcesRepository,
    ResourcesLifecycleEventsHandler,
    ResourcesVmDeletionReadFacade,
  ],
  exports: [ResourcesVmDeletionReadFacade],
})
export class ResourcesModule {}
