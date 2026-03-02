import type React from 'react';
import type { ProjectSettings } from '../../../entities/settings/model/projectSettings';
import { AppRow as Row } from '../../../shared/ui';
import {
  ApiKeysCard,
  NotificationsCard,
  ProxyAndAlertsCards,
  StoragePolicyCard,
} from '../SettingsSections';
import type { SettingsPageActions, SettingsPageForms } from '../useSettingsPageViewModel';
import { ProjectsCardContainer } from './ProjectsCardContainer';

interface SettingsCardsGridProps {
  forms: SettingsPageForms;
  loading: boolean;
  saving: boolean;
  projectEntries: Array<[string, ProjectSettings]>;
  actions: Pick<
    SettingsPageActions,
    | 'handleSaveApiKeys'
    | 'handleSaveProxySettings'
    | 'handleSaveNotifications'
    | 'handleSaveGlobalAlerts'
    | 'handleSaveStoragePolicy'
  >;
  themePanelSlot: React.ReactNode;
}

export const SettingsCardsGrid: React.FC<SettingsCardsGridProps> = ({
  forms,
  loading,
  saving,
  projectEntries,
  actions,
  themePanelSlot,
}) => {
  return (
    <Row gutter={[16, 16]}>
      <ApiKeysCard
        form={forms.apiKeysForm}
        loading={loading}
        saving={saving}
        onSave={actions.handleSaveApiKeys}
      />
      <ProxyAndAlertsCards
        proxyForm={forms.proxyForm}
        alertsForm={forms.alertsForm}
        loading={loading}
        saving={saving}
        onSaveProxySettings={actions.handleSaveProxySettings}
        onSaveGlobalAlerts={actions.handleSaveGlobalAlerts}
      />
      <NotificationsCard
        form={forms.notificationsForm}
        loading={loading}
        saving={saving}
        onSave={actions.handleSaveNotifications}
      />
      <StoragePolicyCard
        form={forms.storagePolicyForm}
        loading={loading}
        saving={saving}
        onSave={actions.handleSaveStoragePolicy}
      />
      <ProjectsCardContainer projectEntries={projectEntries} />
      {themePanelSlot}
    </Row>
  );
};
