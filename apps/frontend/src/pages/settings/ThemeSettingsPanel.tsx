import { BgColorsOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Drawer, Segmented, Space, Typography } from 'antd';
import type React from 'react';
import type { ThemeMode } from '../../theme/themePalette';
import styles from './SettingsPage.module.css';
import { ThemeQuickCard } from './ThemeQuickCard';
import type { ThemeSettingsPanelProps } from './ThemeSettingsPanel.types';
import {
  ThemeColorsGrid,
  ThemePresetPanel,
  ThemeTypographyShapeCard,
  ThemeVisualBackgroundCard,
} from './ThemeSettingsSections';

const { Text } = Typography;

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

export const ThemeSettingsPanel: React.FC<ThemeSettingsPanelProps> = (props) => {
  return (
    <>
      <ThemeQuickCard
        selectedPresetId={props.selectedPresetId}
        themePresetOptions={props.themePresetOptions}
        onSelectedPresetChange={props.onSelectedPresetChange}
        onOpenThemeEditor={props.onOpenThemeEditor}
        onApplySelectedPreset={props.onApplySelectedPreset}
        themePresetApplying={props.themePresetApplying}
      />

      <Drawer
        title={
          <Space>
            <BgColorsOutlined />
            <span>Theme Colors</span>
          </Space>
        }
        placement="right"
        width={640}
        className={cx('theme-settings-drawer')}
        open={props.isThemeDrawerOpen}
        onClose={props.onCloseThemeEditor}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
          body: { background: 'var(--boxmox-color-surface-panel)' },
        }}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={props.themeSaving}
            onClick={props.onSaveThemeColors}
          >
            Save
          </Button>
        }
      >
        <ThemePresetPanel {...props} />
        <ThemeTypographyShapeCard {...props} />
        <ThemeVisualBackgroundCard {...props} />

        <div className={cx('theme-settings-toolbar')}>
          <Segmented
            value={props.editingThemeMode}
            options={[
              { label: 'Light Theme', value: 'light' },
              { label: 'Dark Theme', value: 'dark' },
            ]}
            onChange={(value) => props.onEditingThemeModeChange(value as ThemeMode)}
          />
          <Button onClick={props.onResetCurrentPalette}>Reset Selected Theme</Button>
        </div>

        <Text type="secondary" className={cx('theme-settings-hint')}>
          Colors are stored separately for light/dark mode and are saved to the backend.
        </Text>

        <ThemeColorsGrid {...props} />
      </Drawer>
    </>
  );
};
