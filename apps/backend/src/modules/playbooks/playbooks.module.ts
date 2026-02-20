import { Module } from '@nestjs/common';
import { PlaybooksController } from './playbooks.controller';
import { PlaybooksRepository } from './playbooks.repository';
import { PlaybooksService } from './playbooks.service';

@Module({
  controllers: [PlaybooksController],
  providers: [PlaybooksService, PlaybooksRepository],
})
export class PlaybooksModule {}
