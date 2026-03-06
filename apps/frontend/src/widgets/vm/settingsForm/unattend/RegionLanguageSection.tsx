import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  KeyboardLayoutPair,
  UnattendProfileConfig,
} from '../../../../entities/vm/model/unattend';
import {
  getWindowsGeoLocations,
  type WindowsGeoLocation,
} from '../../../../shared/config/data/windows-geolocations';
import {
  getKeyboardGroups,
  getKeyboardLayoutsForLanguage,
  type KeyboardLanguageGroup,
} from '../../../../shared/config/data/windows-keyboards';
import {
  getWindowsLanguages,
  type WindowsLanguage,
} from '../../../../shared/config/data/windows-languages';
import {
  getWindowsTimezones,
  type WindowsTimezone,
} from '../../../../shared/config/data/windows-timezones';
import {
  AppButton as Button,
  AppForm as Form,
  AppSelect as Select,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../../../shared/ui';

const { Text } = Typography;

interface RegionLanguageSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(
    section: K,
    patch: Partial<UnattendProfileConfig[K]>,
  ) => void;
}

export const RegionLanguageSection: React.FC<RegionLanguageSectionProps> = ({
  config,
  updateConfig,
}) => {
  const [geoLocations, setGeoLocations] = useState<WindowsGeoLocation[]>([]);
  const [keyboardGroups, setKeyboardGroups] = useState<KeyboardLanguageGroup[]>([]);
  const [languages, setLanguages] = useState<WindowsLanguage[]>([]);
  const [timezones, setTimezones] = useState<WindowsTimezone[]>([]);
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(true);
  const [dictionaryLoadError, setDictionaryLoadError] = useState<string | null>(null);
  const isSubscribedRef = useRef(true);

  const loadDictionaries = useCallback(async () => {
    setIsDictionaryLoading(true);
    setDictionaryLoadError(null);

    try {
      const [loadedGeoLocations, loadedKeyboardGroups, loadedLanguages, loadedTimezones] =
        await Promise.all([
          getWindowsGeoLocations(),
          getKeyboardGroups(),
          getWindowsLanguages(),
          getWindowsTimezones(),
        ]);

      if (!isSubscribedRef.current) {
        return;
      }

      setGeoLocations(loadedGeoLocations);
      setKeyboardGroups(loadedKeyboardGroups);
      setLanguages(loadedLanguages);
      setTimezones(loadedTimezones);
    } catch (error) {
      console.error('Failed to load unattend locale dictionaries:', error);
      if (!isSubscribedRef.current) {
        return;
      }
      setDictionaryLoadError('Failed to load locale dictionaries. Please retry.');
    } finally {
      if (isSubscribedRef.current) {
        setIsDictionaryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDictionaries();

    return () => {
      isSubscribedRef.current = false;
    };
  }, [loadDictionaries]);

  const keyboards = config.locale.keyboardLayouts || [];
  const keyboardLanguageNameById = useMemo(
    () => new Map(keyboardGroups.map((group) => [group.languageId, group.name] as const)),
    [keyboardGroups],
  );
  const keyboardTagByLanguageId = useMemo(
    () => new Map(keyboardGroups.map((group) => [group.languageId, group.tag] as const)),
    [keyboardGroups],
  );
  const keyboardRowKeys = new Map<string, number>();
  const handleAddKeyboard = () => {
    if (keyboards.length >= 3) return;
    updateConfig('locale', {
      keyboardLayouts: [...keyboards, { language: '0409', layout: '00000409' }],
    });
  };

  const handleRemoveKeyboard = (index: number) => {
    updateConfig('locale', {
      keyboardLayouts: keyboards.filter((_, i) => i !== index),
    });
  };

  const handleKeyboardChange = (index: number, field: keyof KeyboardLayoutPair, value: string) => {
    const updated = keyboards.map((kb, i) => {
      if (i !== index) return kb;
      if (field === 'language') {
        // when language changes, auto-select first layout for that language
        const group = keyboardGroups.find((g) => g.languageId === value);
        const firstLayout = group?.layouts[0]?.id || kb.layout;
        return { language: value, layout: firstLayout };
      }
      return { ...kb, [field]: value };
    });
    updateConfig('locale', { keyboardLayouts: updated });
  };

  return (
    <Form layout="vertical" size="small">
      {dictionaryLoadError && (
        <Form.Item>
          <Space>
            <Text type="danger">{dictionaryLoadError}</Text>
            <Button
              size="small"
              onClick={() => {
                void loadDictionaries();
              }}
              loading={isDictionaryLoading}
            >
              Retry
            </Button>
          </Space>
        </Form.Item>
      )}

      <Form.Item label="Display Language">
        <Select
          showSearch
          loading={isDictionaryLoading}
          value={config.locale.uiLanguage}
          onChange={(value) => updateConfig('locale', { uiLanguage: value })}
          optionFilterProp="label"
          options={languages.map((l) => ({
            value: l.tag,
            label: `${l.name} — ${l.nativeName}`,
          }))}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item label="Keyboard Layouts (max 3)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keyboards.map((kb, index) => {
            const baseKey = `${kb.language}:${kb.layout}`;
            const occurrence = keyboardRowKeys.get(baseKey) || 0;
            keyboardRowKeys.set(baseKey, occurrence + 1);
            const rowKey = `${baseKey}:${occurrence}`;
            return (
              <Space key={rowKey} align="start">
                <Select
                  showSearch
                  loading={isDictionaryLoading}
                  value={kb.language}
                  onChange={(value) => handleKeyboardChange(index, 'language', value)}
                  optionFilterProp="label"
                  style={{ width: 220 }}
                  options={keyboardGroups.map((g) => ({
                    value: g.languageId,
                    label: g.name,
                  }))}
                  placeholder="Language"
                />
                <Select
                  showSearch
                  loading={isDictionaryLoading}
                  value={kb.layout}
                  onChange={(value) => handleKeyboardChange(index, 'layout', value)}
                  optionFilterProp="label"
                  style={{ width: 260 }}
                  options={getKeyboardLayoutsForLanguage(
                    keyboardGroups,
                    keyboardTagByLanguageId.get(kb.language) || '',
                  ).map((l) => ({
                    value: l.id,
                    label: l.name,
                  }))}
                  placeholder="Layout"
                />
                {keyboards.length > 1 && (
                  <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => handleRemoveKeyboard(index)}
                    size="small"
                  />
                )}
              </Space>
            );
          })}
          {keyboards.length < 3 && (
            <Button
              type="dashed"
              onClick={handleAddKeyboard}
              icon={<PlusOutlined />}
              size="small"
              style={{ width: 160 }}
            >
              Add language
            </Button>
          )}
        </div>
      </Form.Item>

      <Form.Item label="Home Location">
        <Select
          showSearch
          loading={isDictionaryLoading}
          value={config.locale.geoLocation}
          onChange={(value) => updateConfig('locale', { geoLocation: value })}
          optionFilterProp="label"
          options={geoLocations.map((g) => ({
            value: g.id,
            label: g.name,
          }))}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item label="Timezone">
        {/* Intentionally using Windows timezone IDs here: unattend.xml and provisioning expect Windows IDs, not IANA names from Intl APIs. */}
        <Select
          showSearch
          loading={isDictionaryLoading}
          value={config.locale.timeZone}
          onChange={(value) => updateConfig('locale', { timeZone: value })}
          optionFilterProp="label"
          options={timezones.map((tz) => ({
            value: tz.id,
            label: `${tz.displayName}`,
          }))}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Text type="secondary">
        Input locale preview:{' '}
        {keyboards
          .map((kb) => {
            const languageName = keyboardLanguageNameById.get(kb.language) || kb.language;
            const layoutName =
              getKeyboardLayoutsForLanguage(
                keyboardGroups,
                keyboardTagByLanguageId.get(kb.language) || '',
              ).find((layout) => layout.id === kb.layout)?.name || kb.layout;
            return `${languageName}: ${layoutName}`;
          })
          .join('; ')}
      </Text>
    </Form>
  );
};
