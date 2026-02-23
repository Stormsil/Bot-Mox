import { Module } from '@nestjs/common';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { AdminDataEncryptionController } from './admin-data-encryption.controller';
import { AdminDataEncryptionService } from './admin-data-encryption.service';

@Module({
  imports: [DbModule, AuthModule, AdminAuditModule],
  controllers: [AdminDataEncryptionController],
  providers: [AdminDataEncryptionService],
  exports: [AdminDataEncryptionService],
})
export class AdminDataEncryptionModule {}
