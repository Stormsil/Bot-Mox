import { Module } from '@nestjs/common';
import { WowNamesController } from './wow-names.controller';
import { WowNamesService } from './wow-names.service';

@Module({
  controllers: [WowNamesController],
  providers: [WowNamesService],
})
export class WowNamesModule {}
