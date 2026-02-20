import { Module } from '@nestjs/common';
import { LicenseRepository } from '../license/license.repository';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsRepository } from './artifacts.repository';
import { ArtifactsService } from './artifacts.service';

@Module({
  controllers: [ArtifactsController],
  providers: [ArtifactsRepository, LicenseRepository, ArtifactsService],
})
export class ArtifactsModule {}
