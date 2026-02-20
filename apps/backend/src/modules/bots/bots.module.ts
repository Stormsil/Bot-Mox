import { Module } from '@nestjs/common';
import { BotsController } from './bots.controller';
import { BotsRepository } from './bots.repository';
import { BotsService } from './bots.service';

@Module({
  controllers: [BotsController],
  providers: [BotsService, BotsRepository],
})
export class BotsModule {}
