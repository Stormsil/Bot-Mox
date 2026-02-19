import {
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { Button, Card, Input, message, Space, Spin, Typography, Upload } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUnattendProfile,
  DEFAULT_PROFILE_CONFIG,
  deleteUnattendProfile,
  listUnattendProfiles,
  migrateProfileConfig,
  type UnattendProfile,
  type UnattendProfileConfig,
  updateUnattendProfile,
} from '../../../entities/vm/api/unattendProfileFacade';
import {
  buildFinalUnattendXml,
  DEFAULT_UNATTEND_XML_TEMPLATE,
  triggerXmlDownload,
  validateUnattendXml,
} from '../../../utils/unattendXml';
import styles from './UnattendTab.module.css';
import { AccountSection } from './unattend/AccountSection';
import { BloatwareSection } from './unattend/BloatwareSection';
import { CustomScriptSection } from './unattend/CustomScriptSection';
import { DesktopIconsSection } from './unattend/DesktopIconsSection';
import { RegionLanguageSection } from './unattend/RegionLanguageSection';
import { VisualEffectsSection } from './unattend/VisualEffectsSection';
import { WindowsSettingsSection } from './unattend/WindowsSettingsSection';

const { Text, Title } = Typography;

export const UnattendTab: React.FC = () => {
  const cardRadiusStyle: React.CSSProperties = { borderRadius: 2 };
  const [profiles, setProfiles] = useState<UnattendProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [config, setConfig] = useState<UnattendProfileConfig>(
    structuredClone(DEFAULT_PROFILE_CONFIG),
  );
  const [xmlValidationError, setXmlValidationError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const profileNameRef = useRef(profileName);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    profileNameRef.current = profileName;
  }, [profileName]);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const envelope = await listUnattendProfiles();
      const loaded = envelope.data || [];
      setProfiles(loaded);

      if (!selectedIdRef.current && !profileNameRef.current && loaded.length > 0) {
        const preferred = loaded.find((profile) => profile.is_default) || loaded[0];
        if (preferred) {
          setSelectedId(preferred.id);
          setProfileName(preferred.name);
          setConfig(migrateProfileConfig(preferred.config));
        }
      }
    } catch {
      message.error('Failed to load profiles');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfiles();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadProfiles]);

  const selectProfile = useCallback((profile: UnattendProfile) => {
    setSelectedId(profile.id);
    setProfileName(profile.name);
    setConfig(migrateProfileConfig(profile.config));
    setXmlValidationError(null);
  }, []);

  const handleNew = useCallback(() => {
    setSelectedId(null);
    setProfileName('New Profile');
    setConfig(structuredClone(DEFAULT_PROFILE_CONFIG));
    setXmlValidationError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!profileName.trim()) {
      message.warning('Profile name is required');
      return;
    }
    setSaving(true);
    try {
      if (selectedId) {
        await updateUnattendProfile(selectedId, { name: profileName, config });
        message.success('Profile updated');
      } else {
        const envelope = await createUnattendProfile({ name: profileName, config });
        setSelectedId(envelope.data?.id || null);
        message.success('Profile created');
      }
      await loadProfiles();
    } catch {
      message.error('Failed to save profile');
    }
    setSaving(false);
  }, [selectedId, profileName, config, loadProfiles]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    try {
      await deleteUnattendProfile(selectedId);
      message.success('Profile deleted');
      setSelectedId(null);
      setProfileName('');
      setConfig(structuredClone(DEFAULT_PROFILE_CONFIG));
      setXmlValidationError(null);
      await loadProfiles();
    } catch {
      message.error('Failed to delete profile');
    }
  }, [selectedId, loadProfiles]);

  const updateConfig = useCallback(
    <K extends keyof UnattendProfileConfig>(
      section: K,
      patch: Partial<UnattendProfileConfig[K]>,
    ) => {
      setConfig((prev) => {
        const currentSection = prev[section];
        if (
          !currentSection ||
          typeof currentSection !== 'object' ||
          Array.isArray(currentSection)
        ) {
          return prev;
        }

        return {
          ...prev,
          [section]: {
            ...(currentSection as unknown as Record<string, unknown>),
            ...(patch as Record<string, unknown>),
          },
        };
      });
    },
    [],
  );

  const templateXml = useMemo(
    () =>
      String(config.xmlTemplate || DEFAULT_UNATTEND_XML_TEMPLATE).trim() ||
      DEFAULT_UNATTEND_XML_TEMPLATE,
    [config.xmlTemplate],
  );

  const finalXml = useMemo(() => buildFinalUnattendXml(templateXml, config), [templateXml, config]);

  const handleImportTemplate: UploadProps['beforeUpload'] = async (file) => {
    try {
      const importedXml = await file.text();
      const validation = validateUnattendXml(importedXml);
      if (!validation.valid) {
        setXmlValidationError(validation.error);
        message.error('Invalid XML file');
        return false;
      }

      setConfig((prev) => ({ ...prev, xmlTemplate: importedXml }));
      setXmlValidationError(null);
      message.success('XML template imported');
    } catch {
      message.error('Failed to import XML template');
    }
    return false;
  };

  const handleResetTemplate = useCallback(() => {
    setConfig((prev) => ({ ...prev, xmlTemplate: DEFAULT_UNATTEND_XML_TEMPLATE }));
    setXmlValidationError(null);
    message.success('Template reset to default');
  }, []);

  const handleExportTemplate = useCallback(() => {
    triggerXmlDownload(`${profileName || 'unattend-profile'}-template.xml`, templateXml);
  }, [profileName, templateXml]);

  const handleExportFinal = useCallback(() => {
    triggerXmlDownload(`${profileName || 'unattend-profile'}-final.xml`, finalXml);
  }, [finalXml, profileName]);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Button
          icon={<PlusOutlined />}
          size="small"
          onClick={handleNew}
          block
          style={{ marginBottom: 8 }}
        >
          New Profile
        </Button>

        {loading ? (
          <Spin size="small" />
        ) : profiles.length === 0 ? (
          <Text type="secondary">No profiles yet.</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {profiles.map((profile) => (
              <Button
                key={profile.id}
                type={selectedId === profile.id ? 'primary' : 'default'}
                size="small"
                onClick={() => selectProfile(profile)}
                block
                title={profile.name}
              >
                {profile.name}
                {profile.is_default && ' ★'}
              </Button>
            ))}
          </div>
        )}
      </aside>

      <section className={styles.main}>
        <Card size="small" style={cardRadiusStyle}>
          <div className={styles.head}>
            <div className={styles.headTitle}>
              <Title level={5} style={{ margin: 0 }}>
                Unattend Profile
              </Title>
              <Text type="secondary">
                Editable patch over a base XML template (import/export supported).
              </Text>
            </div>
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                size="small"
              >
                {selectedId ? 'Update' : 'Create'}
              </Button>
              {selectedId && (
                <Button danger icon={<DeleteOutlined />} onClick={handleDelete} size="small">
                  Delete
                </Button>
              )}
            </Space>
          </div>

          <Input
            placeholder="Profile name"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            size="small"
            style={{ marginTop: 12 }}
          />
        </Card>

        <Card size="small" title="XML Template" className={styles.sectionCard} style={cardRadiusStyle}>
          <Space wrap>
            <Upload
              beforeUpload={handleImportTemplate}
              showUploadList={false}
              accept=".xml,text/xml,application/xml"
            >
              <Button size="small" icon={<UploadOutlined />}>
                Import XML
              </Button>
            </Upload>
            <Button size="small" icon={<DownloadOutlined />} onClick={handleExportTemplate}>
              Export Template
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleExportFinal}
              type="primary"
            >
              Export Final XML
            </Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={handleResetTemplate}>
              Reset Default
            </Button>
          </Space>

          {xmlValidationError ? (
            <div className={styles.error}>{xmlValidationError}</div>
          ) : (
            <Text type="secondary" style={{ display: 'block', marginTop: 10 }}>
              Base template is kept in profile. Section settings below modify the final XML output.
            </Text>
          )}
        </Card>

        <Card id="unattend-region" size="small" title="Region & Language" className={styles.sectionCard} style={cardRadiusStyle}>
          <RegionLanguageSection config={config} updateConfig={updateConfig} />
        </Card>

        <Card id="unattend-account" size="small" title="Account" className={styles.sectionCard} style={cardRadiusStyle}>
          <AccountSection config={config} updateConfig={updateConfig} />
        </Card>

        <Card id="unattend-visual" size="small" title="Visual Effects" className={styles.sectionCard} style={cardRadiusStyle}>
          <VisualEffectsSection config={config} updateConfig={updateConfig} />
        </Card>

        <Card id="unattend-desktop" size="small" title="Desktop & Icons" className={styles.sectionCard} style={cardRadiusStyle}>
          <DesktopIconsSection config={config} updateConfig={updateConfig} />
        </Card>

        <Card id="unattend-bloatware" size="small" title="Bloatware & Capabilities" className={styles.sectionCard} style={cardRadiusStyle}>
          <BloatwareSection config={config} updateConfig={updateConfig} />
        </Card>

        <Card id="unattend-windows" size="small" title="Windows Settings" className={styles.sectionCard} style={cardRadiusStyle}>
          <WindowsSettingsSection config={config} updateConfig={updateConfig} />
        </Card>

        <Card id="unattend-script" size="small" title="Custom Script" className={styles.sectionCard} style={cardRadiusStyle}>
          <CustomScriptSection config={config} updateConfig={updateConfig} />
        </Card>
      </section>
    </div>
  );
};
