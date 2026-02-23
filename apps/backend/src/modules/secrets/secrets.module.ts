import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminSecretsController } from './admin-secrets.controller';
import { SecretsController } from './secrets.controller';
import { SecretsRepository } from './secrets.repository';
import { SecretsService } from './secrets.service';
import { SecretsVaultAdapter } from './secrets-vault.adapter';

@Module({
  imports: [AuthModule],
  controllers: [SecretsController, AdminSecretsController],
  providers: [SecretsService, SecretsRepository, SecretsVaultAdapter],
})
export class SecretsModule {}
