import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AdminAccessModule } from './admin-access/admin-access.module';
import { AdminAuditModule } from './admin-audit/admin-audit.module';
import { AdminDataEncryptionModule } from './admin-data-encryption/admin-data-encryption.module';
import { AdminProjectsModule } from './admin-projects/admin-projects.module';
import { AgentsModule } from './agents/agents.module';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { BotsModule } from './bots/bots.module';
import { DbModule } from './db/db.module';
import { EventingModule } from './eventing/eventing.module';
import { FinanceModule } from './finance/finance.module';
import { HealthModule } from './health/health.module';
import { InfraModule } from './infra/infra.module';
import { InfraGatewayModule } from './infra-gateway/infra-gateway.module';
import { IpqsModule } from './ipqs/ipqs.module';
import { LicenseModule } from './license/license.module';
import { ObservabilityModule } from './observability/observability.module';
import { PlaybooksModule } from './playbooks/playbooks.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { ResourcesModule } from './resources/resources.module';
import { SecretsModule } from './secrets/secrets.module';
import { SettingsModule } from './settings/settings.module';
import { ThemeAssetsModule } from './theme-assets/theme-assets.module';
import { VmModule } from './vm/vm.module';
import { VmDeletionOrchestratorModule } from './vm-deletion-orchestrator/vm-deletion-orchestrator.module';
import { VmOpsModule } from './vm-ops/vm-ops.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { WowNamesModule } from './wow-names/wow-names.module';

@Module({
  imports: [
    DbModule,
    EventEmitterModule.forRoot(),
    EventingModule,
    HealthModule,
    InfraGatewayModule,
    ObservabilityModule,
    AuthModule,
    AdminAuditModule,
    AdminAccessModule,
    AdminDataEncryptionModule,
    BillingModule,
    AdminProjectsModule,
    ArtifactsModule,
    InfraModule,
    BotsModule,
    VmDeletionOrchestratorModule,
    VmOpsModule,
    AgentsModule,
    ResourcesModule,
    SecretsModule,
    SettingsModule,
    ThemeAssetsModule,
    VmModule,
    WorkspaceModule,
    FinanceModule,
    IpqsModule,
    LicenseModule,
    ProvisioningModule,
    PlaybooksModule,
    WowNamesModule,
  ],
})
export class AppModule {}
