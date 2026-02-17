import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Form,
  Row,
  Typography,
  message,
} from 'antd';
import {
  ReloadOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { ApiKeys, NotificationEvents, ProxySettings, SubscriptionSettings } from '../../types';
import {
  getApiKeys,
  getNotificationEvents,
  getProxySettings,
  updateApiKeys,
  updateNotificationEvents,
  updateProxySettings,
} from '../../services/apiKeysService';
import { getThemeSettings } from '../../services/themeService';
import {
  getProjectSettings,
  type ProjectSettings,
} from '../../services/projectSettingsService';
import {
  getDefaultSettings,
  getSubscriptionSettings,
  updateSubscriptionSettings,
} from '../../services/settingsService';
import { getStoragePolicy, updateStoragePolicy } from '../../services/storagePolicyService';
import { useThemeRuntime } from '../../theme/themeRuntime';
import { ApiKeysCard, NotificationsCard, ProjectsCard, ProxyAndAlertsCards, StoragePolicyCard } from './SettingsSections';
import { ThemeSettingsPanel } from './ThemeSettingsPanel';
import type {
  ApiKeysFormValues,
  NotificationEventsFormValues,
  ProxySettingsFormValues,
  StoragePolicyFormValues,
} from './types';
import { useThemeSettings } from './useThemeSettings';
import styles from './SettingsPage.module.css';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

const { Title } = Typography;

export const SettingsPage: React.FC = () => {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectsVisible, setProjectsVisible] = useState(false);
  const [projects, setProjects] = useState<Record<string, ProjectSettings>>({});

  const [apiKeysForm] = Form.useForm();

  const [proxyForm] = Form.useForm();

  const [notificationsForm] = Form.useForm();
  const [alertsForm] = Form.useForm();
  const [storagePolicyForm] = Form.useForm();
  const [globalAlerts, setGlobalAlerts] = useState<SubscriptionSettings>(getDefaultSettings());
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

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [keys, proxy, events, themeSettings, projectSettings, alertsSettings, storagePolicySettings] = await Promise.all([
        getApiKeys(),
        getProxySettings(),
        getNotificationEvents(),
        getThemeSettings(),
        getProjectSettings(),
        getSubscriptionSettings(),
        getStoragePolicy(),
      ]);

      theme.applyThemeSettings(themeSettings);
      setProjects(projectSettings);
      setGlobalAlerts(alertsSettings);

      // Set form values
      apiKeysForm.setFieldsValue({
        ipqs_api_key: keys.ipqs.api_key,
        ipqs_enabled: keys.ipqs.enabled,
        telegram_bot_token: keys.telegram.bot_token,
        telegram_chat_id: keys.telegram.chat_id,
        telegram_enabled: keys.telegram.enabled,
      });

      proxyForm.setFieldsValue({
        auto_check_on_add: proxy.auto_check_on_add,
        fraud_score_threshold: proxy.fraud_score_threshold,
        check_interval_hours: proxy.check_interval_hours,
      });

      notificationsForm.setFieldsValue(events);
      alertsForm.setFieldsValue({
        warning_days: alertsSettings.warning_days,
      });

      storagePolicyForm.setFieldsValue({
        operational: storagePolicySettings.operational,
        sync_enabled: Boolean(storagePolicySettings.sync?.enabled),
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [
    alertsForm,
    apiKeysForm,
    notificationsForm,
    proxyForm,
    storagePolicyForm,
    theme,
  ]);

  // Load settings on mount
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

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

      await updateApiKeys(newApiKeys);
      message.success('API keys saved');
    } catch (error) {
      console.error('Error saving API keys:', error);
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

      await updateProxySettings(newProxySettings);
      message.success('Proxy settings saved');
    } catch (error) {
      console.error('Error saving proxy settings:', error);
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

      await updateNotificationEvents(newEvents);
      message.success('Notification settings saved');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      message.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGlobalAlerts = async (values: { warning_days: number }) => {
    setSaving(true);
    try {
      const nextAlerts: SubscriptionSettings = {
        ...globalAlerts,
        warning_days: values.warning_days,
        updated_at: Date.now(),
      };
      await updateSubscriptionSettings(nextAlerts);
      setGlobalAlerts(nextAlerts);
      message.success('Global alert settings saved');
    } catch (error) {
      console.error('Error saving global alert settings:', error);
      message.error('Failed to save global alert settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStoragePolicy = async (values: StoragePolicyFormValues) => {
    setSaving(true);
    try {
      await updateStoragePolicy({
        secrets: 'local-only',
        operational: values.operational === 'local' ? 'local' : 'cloud',
        sync: {
          enabled: Boolean(values.sync_enabled),
        },
      });
      message.success('Storage policy saved');
    } catch (error) {
      console.error('Error saving storage policy:', error);
      message.error('Failed to save storage policy');
    } finally {
      setSaving(false);
    }
  };

  const projectEntries = Object.entries(projects).sort((a, b) => {
    const aName = (a[1].name || a[0]).trim();
    const bName = (b[1].name || b[0]).trim();
    return aName.localeCompare(bName);
  });

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
            void loadSettings();
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
