import { Module } from '@nestjs/common';
import { SecretsController } from './secrets.controller';
import { SecretsRepository } from './secrets.repository';
import { SecretsService } from './secrets.service';
import { SecretsVaultAdapter } from './secrets-vault.adapter';

@Module({
  controllers: [SecretsController],
  providers: [SecretsService, SecretsRepository, SecretsVaultAdapter],
})
export class SecretsModule {}
