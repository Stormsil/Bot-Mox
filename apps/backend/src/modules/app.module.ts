import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { AuthModule } from './auth/auth.module';
import { BotsModule } from './bots/bots.module';
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
import { VmOpsModule } from './vm-ops/vm-ops.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { WowNamesModule } from './wow-names/wow-names.module';

@Module({
  imports: [
    HealthModule,
    InfraGatewayModule,
    ObservabilityModule,
    AuthModule,
    ArtifactsModule,
    InfraModule,
    BotsModule,
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
