import React from 'react';
import { Button, Form, Select, Space, Typography } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { UnattendProfileConfig, KeyboardLayoutPair } from '../../../../services/unattendProfileService';
import { WINDOWS_LANGUAGES } from '../../../../data/windows-languages';
import { KEYBOARD_GROUPS, getKeyboardLayoutsForLanguage } from '../../../../data/windows-keyboards';
import { WINDOWS_TIMEZONES } from '../../../../data/windows-timezones';
import { WINDOWS_GEOLOCATIONS } from '../../../../data/windows-geolocations';

const { Text } = Typography;

interface RegionLanguageSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(section: K, patch: Partial<UnattendProfileConfig[K]>) => void;
}

export const RegionLanguageSection: React.FC<RegionLanguageSectionProps> = ({ config, updateConfig }) => {
  const keyboards = config.locale.keyboardLayouts || [];
  const keyboardLanguageNameById = new Map(KEYBOARD_GROUPS.map((group) => [group.languageId, group.name] as const));

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
        const group = KEYBOARD_GROUPS.find((g) => g.languageId === value);
        const firstLayout = group?.layouts[0]?.id || kb.layout;
        return { language: value, layout: firstLayout };
      }
      return { ...kb, [field]: value };
    });
    updateConfig('locale', { keyboardLayouts: updated });
  };

  return (
    <Form layout="vertical" size="small">
      <Form.Item label="Display Language">
        <Select
          showSearch
          value={config.locale.uiLanguage}
          onChange={(value) => updateConfig('locale', { uiLanguage: value })}
          optionFilterProp="label"
          options={WINDOWS_LANGUAGES.map((l) => ({
            value: l.tag,
            label: `${l.name} — ${l.nativeName}`,
          }))}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item label="Keyboard Layouts (max 3)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keyboards.map((kb, index) => (
            <Space key={index} align="start">
              <Select
                showSearch
                value={kb.language}
                onChange={(value) => handleKeyboardChange(index, 'language', value)}
                optionFilterProp="label"
                style={{ width: 220 }}
                options={KEYBOARD_GROUPS.map((g) => ({
                  value: g.languageId,
                  label: g.name,
                }))}
                placeholder="Language"
              />
              <Select
                showSearch
                value={kb.layout}
                onChange={(value) => handleKeyboardChange(index, 'layout', value)}
                optionFilterProp="label"
                style={{ width: 260 }}
                options={getKeyboardLayoutsForLanguage(
                  KEYBOARD_GROUPS.find((g) => g.languageId === kb.language)?.tag || ''
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
          ))}
          {keyboards.length < 3 && (
            <Button type="dashed" onClick={handleAddKeyboard} icon={<PlusOutlined />} size="small" style={{ width: 160 }}>
              Add language
            </Button>
          )}
        </div>
      </Form.Item>

      <Form.Item label="Home Location">
        <Select
          showSearch
          value={config.locale.geoLocation}
          onChange={(value) => updateConfig('locale', { geoLocation: value })}
          optionFilterProp="label"
          options={WINDOWS_GEOLOCATIONS.map((g) => ({
            value: g.id,
            label: g.name,
          }))}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item label="Timezone">
        <Select
          showSearch
          value={config.locale.timeZone}
          onChange={(value) => updateConfig('locale', { timeZone: value })}
          optionFilterProp="label"
          options={WINDOWS_TIMEZONES.map((tz) => ({
            value: tz.id,
            label: `${tz.displayName}`,
          }))}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Text type="secondary">
        Input locale preview: {keyboards.map((kb) => {
          const languageName = keyboardLanguageNameById.get(kb.language) || kb.language;
          const layoutName = getKeyboardLayoutsForLanguage(
            KEYBOARD_GROUPS.find((g) => g.languageId === kb.language)?.tag || ''
          ).find((layout) => layout.id === kb.layout)?.name || kb.layout;
          return `${languageName}: ${layoutName}`;
        }).join('; ')}
      </Text>
    </Form>
  );
};
