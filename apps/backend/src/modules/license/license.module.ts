import { Module } from '@nestjs/common';
import { LicenseController } from './license.controller';
import { LicenseRepository } from './license.repository';
import { LicenseService } from './license.service';

@Module({
  controllers: [LicenseController],
  providers: [LicenseRepository, LicenseService],
})
export class LicenseModule {}
