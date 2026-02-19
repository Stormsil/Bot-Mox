import { Module } from '@nestjs/common';
import { IpqsController } from './ipqs.controller';
import { IpqsService } from './ipqs.service';

@Module({
  controllers: [IpqsController],
  providers: [IpqsService],
  exports: [IpqsService],
})
export class IpqsModule {}
