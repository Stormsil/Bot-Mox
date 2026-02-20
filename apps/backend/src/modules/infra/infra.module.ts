import { Module } from '@nestjs/common';
import { InfraController } from './infra.controller';
import { InfraRepository } from './infra.repository';
import { InfraService } from './infra.service';

@Module({
  controllers: [InfraController],
  providers: [InfraRepository, InfraService],
})
export class InfraModule {}
