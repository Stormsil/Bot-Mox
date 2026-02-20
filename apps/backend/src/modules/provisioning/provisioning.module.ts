import { Module } from '@nestjs/common';
import { ProvisioningController } from './provisioning.controller';
import { ProvisioningRepository } from './provisioning.repository';
import { ProvisioningService } from './provisioning.service';

@Module({
  controllers: [ProvisioningController],
  providers: [ProvisioningRepository, ProvisioningService],
})
export class ProvisioningModule {}
