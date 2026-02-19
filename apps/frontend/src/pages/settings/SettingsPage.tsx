import { ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { Button, Form, message, Row, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  getDefaultSettings,
  type ProjectSettings,
} from '../../entities/settings/api/settingsFacade';
import { useProjectSettingsQuery } from '../../entities/settings/api/useProjectSettingsQuery';
import {
  useUpdateApiKeysMutation,
  useUpdateNotificationEventsMutation,
  useUpdateProxySettingsMutation,
  useUpdateStoragePolicyMutation,
} from '../../entities/settings/api/useSettingsMutations';
import {
  useApiKeysQuery,
  useNotificationEventsQuery,
  useProxySettingsQuery,
  useStoragePolicyQuery,
  useThemeSettingsQuery,
} from '../../entities/settings/api/useSettingsQueries';
import { useUpdateSubscriptionSettingsMutation } from '../../entities/settings/api/useSubscriptionSettingsMutation';
import { useSubscriptionSettingsQuery } from '../../entities/settings/api/useSubscriptionSettingsQuery';
import { uiLogger } from '../../observability/uiLogger';
import { useThemeRuntime } from '../../theme/themeRuntime';
import type { ApiKeys, NotificationEvents, ProxySettings, SubscriptionSettings } from '../../types';
import styles from './SettingsPage.module.css';
import {
  ApiKeysCard,
  NotificationsCard,
  ProjectsCard,
  ProxyAndAlertsCards,
  StoragePolicyCard,
} from './SettingsSections';
import { ThemeSettingsPanel } from './ThemeSettingsPanel';
import type {
  ApiKeysFormValues,
  NotificationEventsFormValues,
  ProxySettingsFormValues,
  StoragePolicyFormValues,
} from './types';
import { useThemeSettings } from './useThemeSettings';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

const { Title } = Typography;

export const SettingsPage: React.FC = () => {
  const subscriptionSettingsQuery = useSubscriptionSettingsQuery();
  const {
    themePalettes,
    setThemePalettes,
    visualSettings,
    setVisualSettings,
    typographySettings,
    setTypographySettings,
    shapeSettings,
    setShapeSettings,
  } = useThemeRuntime();
  const [saving, setSaving] = useState(false);
  const [projectsVisible, setProjectsVisible] = useState(false);

  const [apiKeysForm] = Form.useForm();

  const [proxyForm] = Form.useForm();

  const [notificationsForm] = Form.useForm();
  const [alertsForm] = Form.useForm();
  const [storagePolicyForm] = Form.useForm();
  const apiKeysQuery = useApiKeysQuery();
  const proxySettingsQuery = useProxySettingsQuery();
  const notificationEventsQuery = useNotificationEventsQuery();
  const themeSettingsQuery = useThemeSettingsQuery();
  const projectSettingsQuery = useProjectSettingsQuery();
  const storagePolicyQuery = useStoragePolicyQuery();
  const updateApiKeysMutation = useUpdateApiKeysMutation();
  const updateProxySettingsMutation = useUpdateProxySettingsMutation();
  const updateNotificationEventsMutation = useUpdateNotificationEventsMutation();
  const updateSubscriptionSettingsMutation = useUpdateSubscriptionSettingsMutation();
  const updateStoragePolicyMutation = useUpdateStoragePolicyMutation();

  const theme = useThemeSettings({
    themePalettes,
    onThemePalettesChange: setThemePalettes,
    visualSettings,
    onVisualSettingsChange: setVisualSettings,
    typographySettings,
    onTypographySettingsChange: setTypographySettings,
    shapeSettings,
    onShapeSettingsChange: setShapeSettings,
  });

  useEffect(() => {
    if (!apiKeysQuery.data) return;
    apiKeysForm.setFieldsValue({
      ipqs_api_key: apiKeysQuery.data.ipqs.api_key,
      ipqs_enabled: apiKeysQuery.data.ipqs.enabled,
      telegram_bot_token: apiKeysQuery.data.telegram.bot_token,
      telegram_chat_id: apiKeysQuery.data.telegram.chat_id,
      telegram_enabled: apiKeysQuery.data.telegram.enabled,
    });
  }, [apiKeysForm, apiKeysQuery.data]);

  useEffect(() => {
    if (!proxySettingsQuery.data) return;
    proxyForm.setFieldsValue({
      auto_check_on_add: proxySettingsQuery.data.auto_check_on_add,
      fraud_score_threshold: proxySettingsQuery.data.fraud_score_threshold,
      check_interval_hours: proxySettingsQuery.data.check_interval_hours,
    });
  }, [proxyForm, proxySettingsQuery.data]);

  useEffect(() => {
    if (!notificationEventsQuery.data) return;
    notificationsForm.setFieldsValue(notificationEventsQuery.data);
  }, [notificationEventsQuery.data, notificationsForm]);

  useEffect(() => {
    if (!storagePolicyQuery.data) return;
    storagePolicyForm.setFieldsValue({
      operational: storagePolicyQuery.data.operational,
      sync_enabled: Boolean(storagePolicyQuery.data.sync?.enabled),
    });
  }, [storagePolicyForm, storagePolicyQuery.data]);

  useEffect(() => {
    if (!themeSettingsQuery.data) return;
    theme.applyThemeSettings(themeSettingsQuery.data);
  }, [theme, themeSettingsQuery.data]);

  useEffect(() => {
    if (!subscriptionSettingsQuery.data) {
      return;
    }

    alertsForm.setFieldsValue({
      warning_days: subscriptionSettingsQuery.data.warning_days,
    });
  }, [alertsForm, subscriptionSettingsQuery.data]);

  useEffect(() => {
    if (apiKeysQuery.error) uiLogger.error('Error loading API keys:', apiKeysQuery.error);
    if (proxySettingsQuery.error)
      uiLogger.error('Error loading proxy settings:', proxySettingsQuery.error);
    if (notificationEventsQuery.error)
      uiLogger.error('Error loading notification settings:', notificationEventsQuery.error);
    if (themeSettingsQuery.error)
      uiLogger.error('Error loading theme settings:', themeSettingsQuery.error);
    if (projectSettingsQuery.error)
      uiLogger.error('Error loading project settings:', projectSettingsQuery.error);
    if (storagePolicyQuery.error)
      uiLogger.error('Error loading storage policy:', storagePolicyQuery.error);
    if (subscriptionSettingsQuery.error) {
      uiLogger.error('Error loading subscription settings:', subscriptionSettingsQuery.error);
    }
  }, [
    apiKeysQuery.error,
    notificationEventsQuery.error,
    projectSettingsQuery.error,
    proxySettingsQuery.error,
    storagePolicyQuery.error,
    subscriptionSettingsQuery.error,
    themeSettingsQuery.error,
  ]);

  const loading =
    apiKeysQuery.isLoading ||
    proxySettingsQuery.isLoading ||
    notificationEventsQuery.isLoading ||
    themeSettingsQuery.isLoading ||
    projectSettingsQuery.isLoading ||
    storagePolicyQuery.isLoading ||
    subscriptionSettingsQuery.isLoading ||
    apiKeysQuery.isFetching ||
    proxySettingsQuery.isFetching ||
    notificationEventsQuery.isFetching ||
    themeSettingsQuery.isFetching ||
    projectSettingsQuery.isFetching ||
    storagePolicyQuery.isFetching ||
    subscriptionSettingsQuery.isFetching;

  // Save API Keys
  const handleSaveApiKeys = async (values: ApiKeysFormValues) => {
    setSaving(true);
    try {
      const newApiKeys: ApiKeys = {
        ipqs: {
          api_key: values.ipqs_api_key || '',
          enabled: Boolean(values.ipqs_enabled),
        },
        telegram: {
          bot_token: values.telegram_bot_token || '',
          chat_id: values.telegram_chat_id || '',
          enabled: Boolean(values.telegram_enabled),
        },
      };

      await updateApiKeysMutation.mutateAsync(newApiKeys);
      message.success('API keys saved');
    } catch (error) {
      uiLogger.error('Error saving API keys:', error);
      message.error('Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  // Save Proxy Settings
  const handleSaveProxySettings = async (values: ProxySettingsFormValues) => {
    setSaving(true);
    try {
      const newProxySettings: ProxySettings = {
        auto_check_on_add: Boolean(values.auto_check_on_add),
        fraud_score_threshold: Number(values.fraud_score_threshold || 0),
        check_interval_hours: Number(values.check_interval_hours || 0),
      };

      await updateProxySettingsMutation.mutateAsync(newProxySettings);
      message.success('Proxy settings saved');
    } catch (error) {
      uiLogger.error('Error saving proxy settings:', error);
      message.error('Failed to save proxy settings');
    } finally {
      setSaving(false);
    }
  };

  // Save Notification Events
  const handleSaveNotifications = async (values: NotificationEventsFormValues) => {
    setSaving(true);
    try {
      const newEvents: NotificationEvents = {
        bot_banned: Boolean(values.bot_banned),
        bot_offline: Boolean(values.bot_offline),
        bot_online: Boolean(values.bot_online),
        level_up: Boolean(values.level_up),
        profession_maxed: Boolean(values.profession_maxed),
        low_fraud_score: Boolean(values.low_fraud_score),
        daily_report: Boolean(values.daily_report),
      };

      await updateNotificationEventsMutation.mutateAsync(newEvents);
      message.success('Notification settings saved');
    } catch (error) {
      uiLogger.error('Error saving notification settings:', error);
      message.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGlobalAlerts = async (values: { warning_days: number }) => {
    setSaving(true);
    try {
      const nextAlerts: Partial<SubscriptionSettings> = {
        ...(subscriptionSettingsQuery.data || getDefaultSettings()),
        warning_days: values.warning_days,
      };
      await updateSubscriptionSettingsMutation.mutateAsync(nextAlerts);
      message.success('Global alert settings saved');
    } catch (error) {
      uiLogger.error('Error saving global alert settings:', error);
      message.error('Failed to save global alert settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStoragePolicy = async (values: StoragePolicyFormValues) => {
    setSaving(true);
    try {
      await updateStoragePolicyMutation.mutateAsync({
        secrets: 'local-only',
        operational: values.operational === 'local' ? 'local' : 'cloud',
        sync: {
          enabled: Boolean(values.sync_enabled),
        },
      });
      message.success('Storage policy saved');
    } catch (error) {
      uiLogger.error('Error saving storage policy:', error);
      message.error('Failed to save storage policy');
    } finally {
      setSaving(false);
    }
  };

  const projectEntries = useMemo(() => {
    const projects: Record<string, ProjectSettings> = projectSettingsQuery.data || {};
    return Object.entries(projects).sort((a, b) => {
      const aName = (a[1].name || a[0]).trim();
      const bName = (b[1].name || b[0]).trim();
      return aName.localeCompare(bName);
    });
  }, [projectSettingsQuery.data]);

  return (
    <div className={cx('settings-page')}>
      <div className={cx('settings-header')}>
        <Title
          level={4}
          className={cx('settings-title')}
          style={{ margin: 0, color: 'var(--boxmox-color-text-primary)' }}
        >
          <ToolOutlined className={cx('settings-title-icon')} /> Settings
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            void Promise.all([
              apiKeysQuery.refetch(),
              proxySettingsQuery.refetch(),
              notificationEventsQuery.refetch(),
              themeSettingsQuery.refetch(),
              projectSettingsQuery.refetch(),
              storagePolicyQuery.refetch(),
              subscriptionSettingsQuery.refetch(),
            ]);
          }}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <ApiKeysCard
          form={apiKeysForm}
          loading={loading}
          saving={saving}
          onSave={handleSaveApiKeys}
        />
        <ProxyAndAlertsCards
          proxyForm={proxyForm}
          alertsForm={alertsForm}
          loading={loading}
          saving={saving}
          onSaveProxySettings={handleSaveProxySettings}
          onSaveGlobalAlerts={handleSaveGlobalAlerts}
        />
        <NotificationsCard
          form={notificationsForm}
          loading={loading}
          saving={saving}
          onSave={handleSaveNotifications}
        />
        <StoragePolicyCard
          form={storagePolicyForm}
          loading={loading}
          saving={saving}
          onSave={handleSaveStoragePolicy}
        />
        <ProjectsCard
          projectsVisible={projectsVisible}
          projectEntries={projectEntries}
          onToggleVisibility={() => setProjectsVisible((prev) => !prev)}
        />
        <ThemeSettingsPanel
          selectedPresetId={theme.selectedPresetId}
          themePresetOptions={theme.themePresetOptions}
          onSelectedPresetChange={theme.setSelectedPresetId}
          onOpenThemeEditor={() => theme.setIsThemeDrawerOpen(true)}
          onApplySelectedPreset={theme.handleApplySelectedPreset}
          themePresetApplying={theme.themePresetApplying}
          isThemeDrawerOpen={theme.isThemeDrawerOpen}
          onCloseThemeEditor={() => theme.setIsThemeDrawerOpen(false)}
          themeSaving={theme.themeSaving}
          onSaveThemeColors={theme.handleSaveThemeColors}
          onDeleteSelectedPreset={theme.handleDeleteSelectedPreset}
          themePresetDeleting={theme.themePresetDeleting}
          newThemePresetName={theme.newThemePresetName}
          onNewThemePresetNameChange={theme.setNewThemePresetName}
          onSaveCurrentAsPreset={theme.handleSaveCurrentAsPreset}
          themePresetSaving={theme.themePresetSaving}
          editingThemeMode={theme.editingThemeMode}
          onEditingThemeModeChange={theme.setEditingThemeMode}
          onResetCurrentPalette={theme.handleResetCurrentPalette}
          localThemePalettes={theme.localThemePalettes}
          themeInputValues={theme.themeInputValues}
          onThemeColorChange={theme.updateThemeColor}
          onThemeInputChange={theme.handleThemeInputChange}
          onThemeInputCommit={theme.commitThemeInput}
          onPickColorFromScreen={theme.handlePickColorFromScreen}
          localTypographySettings={theme.localTypographySettings}
          localShapeSettings={theme.localShapeSettings}
          onTypographySettingsChange={theme.handleTypographySettingsChange}
          onShapeSettingsChange={theme.handleShapeSettingsChange}
          localVisualSettings={theme.localVisualSettings}
          themeAssets={theme.themeAssets}
          themeAssetsLoading={theme.themeAssetsLoading}
          themeAssetUploading={theme.themeAssetUploading}
          onRefreshThemeAssets={theme.handleRefreshThemeAssets}
          onUploadThemeAsset={theme.handleUploadThemeAsset}
          onSelectThemeBackground={theme.handleSelectThemeBackground}
          onDeleteThemeAsset={theme.handleDeleteThemeAsset}
          onVisualSettingsChange={theme.handleVisualSettingsChange}
          onSaveVisualSettings={theme.handleSaveVisualSettings}
        />
      </Row>
    </div>
  );
};

export default SettingsPage;
