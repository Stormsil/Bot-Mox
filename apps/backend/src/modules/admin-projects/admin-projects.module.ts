import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminProjectsController } from './admin-projects.controller';
import { AdminProjectsRepository } from './admin-projects.repository';
import { AdminProjectsService } from './admin-projects.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminProjectsController],
  providers: [AdminProjectsService, AdminProjectsRepository],
})
export class AdminProjectsModule {}
