import { BgColorsOutlined, SaveOutlined } from '@ant-design/icons';

import type React from 'react';
import { bindCssModuleCx } from '../../shared/lib/classNames';
import {
  AppButton as Button,
  AppDrawer as Drawer,
  AppFlex as Flex,
  AppSegmented as Segmented,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../shared/ui';
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

const cx = bindCssModuleCx(styles);

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

        <Flex
          className={cx('theme-settings-toolbar')}
          align="center"
          justify="space-between"
          gap={12}
          wrap
        >
          <Segmented
            value={props.editingThemeMode}
            options={[
              { label: 'Light Theme', value: 'light' },
              { label: 'Dark Theme', value: 'dark' },
            ]}
            onChange={(value) => props.onEditingThemeModeChange(value as ThemeMode)}
          />
          <Button onClick={props.onResetCurrentPalette}>Reset Selected Theme</Button>
        </Flex>

        <Text type="secondary" className={cx('theme-settings-hint')}>
          Colors are stored separately for light/dark mode and are saved to the backend.
        </Text>

        <ThemeColorsGrid {...props} />
      </Drawer>
    </>
  );
};
