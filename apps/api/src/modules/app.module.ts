import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module';
import { AuthModule } from './auth/auth.module';
import { BotsModule } from './bots/bots.module';
import { FinanceModule } from './finance/finance.module';
import { HealthModule } from './health/health.module';
import { IpqsModule } from './ipqs/ipqs.module';
import { LicenseModule } from './license/license.module';
import { PlaybooksModule } from './playbooks/playbooks.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { ResourcesModule } from './resources/resources.module';
import { SettingsModule } from './settings/settings.module';
import { ThemeAssetsModule } from './theme-assets/theme-assets.module';
import { VmOpsModule } from './vm-ops/vm-ops.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { WowNamesModule } from './wow-names/wow-names.module';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    BotsModule,
    VmOpsModule,
    AgentsModule,
    ResourcesModule,
    SettingsModule,
    ThemeAssetsModule,
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
