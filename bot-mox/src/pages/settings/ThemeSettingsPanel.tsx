import React from 'react';
import {
  Button,
  Card,
  Col,
  ColorPicker,
  Drawer,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Typography,
} from 'antd';
import {
  BgColorsOutlined,
  CheckOutlined,
  DeleteOutlined,
  HighlightOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  THEME_COLOR_DEFINITIONS,
  type ThemeColorVariable,
  type ThemeMode,
  type ThemePalettes,
} from '../../theme/themePalette';
import { TableActionButton } from '../../components/ui/TableActionButton';

const { Text } = Typography;

interface ThemeSettingsPanelProps {
  selectedPresetId?: string;
  themePresetOptions: Array<{ label: string; value: string }>;
  onSelectedPresetChange: (value?: string) => void;
  onOpenThemeEditor: () => void;
  onApplySelectedPreset: () => void;
  themePresetApplying: boolean;

  isThemeDrawerOpen: boolean;
  onCloseThemeEditor: () => void;
  themeSaving: boolean;
  onSaveThemeColors: () => void;

  onDeleteSelectedPreset: () => void;
  themePresetDeleting: boolean;
  newThemePresetName: string;
  onNewThemePresetNameChange: (value: string) => void;
  onSaveCurrentAsPreset: () => void;
  themePresetSaving: boolean;

  editingThemeMode: ThemeMode;
  onEditingThemeModeChange: (mode: ThemeMode) => void;
  onResetCurrentPalette: () => void;

  localThemePalettes: ThemePalettes;
  themeInputValues: ThemePalettes;
  onThemeColorChange: (
    mode: ThemeMode,
    cssVar: ThemeColorVariable,
    rawColor: string,
    options?: { syncApp?: boolean }
  ) => void;
  onThemeInputChange: (mode: ThemeMode, cssVar: ThemeColorVariable, value: string) => void;
  onThemeInputCommit: (mode: ThemeMode, cssVar: ThemeColorVariable) => void;
  onPickColorFromScreen: (mode: ThemeMode, cssVar: ThemeColorVariable) => Promise<void> | void;
}

export const ThemeSettingsPanel: React.FC<ThemeSettingsPanelProps> = ({
  selectedPresetId,
  themePresetOptions,
  onSelectedPresetChange,
  onOpenThemeEditor,
  onApplySelectedPreset,
  themePresetApplying,
  isThemeDrawerOpen,
  onCloseThemeEditor,
  themeSaving,
  onSaveThemeColors,
  onDeleteSelectedPreset,
  themePresetDeleting,
  newThemePresetName,
  onNewThemePresetNameChange,
  onSaveCurrentAsPreset,
  themePresetSaving,
  editingThemeMode,
  onEditingThemeModeChange,
  onResetCurrentPalette,
  localThemePalettes,
  themeInputValues,
  onThemeColorChange,
  onThemeInputChange,
  onThemeInputCommit,
  onPickColorFromScreen,
}) => {
  return (
    <>
      <Col span={24}>
        <Card className="settings-card theme-quick-card">
          <div className="theme-quick-card-content">
            <div>
              <Text strong>
                <BgColorsOutlined /> Theme Colors
              </Text>
              <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                Save themes to database and apply in a few clicks.
              </Text>
            </div>
            <div className="theme-quick-actions">
              <Select
                placeholder="Select saved theme"
                value={selectedPresetId}
                options={themePresetOptions}
                onChange={(value) => onSelectedPresetChange(value)}
                allowClear
                className="theme-preset-select"
              />
              <Button
                icon={<CheckOutlined />}
                onClick={onApplySelectedPreset}
                loading={themePresetApplying}
                disabled={!selectedPresetId}
              >
                Apply
              </Button>
              <Button
                type="primary"
                icon={<BgColorsOutlined />}
                onClick={onOpenThemeEditor}
              >
                Open Theme Editor
              </Button>
            </div>
          </div>
        </Card>
      </Col>

      <Drawer
        title={(
          <Space>
            <BgColorsOutlined />
            <span>Theme Colors</span>
          </Space>
        )}
        placement="right"
        width={560}
        className="theme-settings-drawer"
        open={isThemeDrawerOpen}
        onClose={onCloseThemeEditor}
        extra={(
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={themeSaving}
            onClick={onSaveThemeColors}
          >
            Save
          </Button>
        )}
      >
        <div className="theme-preset-panel">
          <Text strong className="theme-preset-title">Saved Themes</Text>
          <div className="theme-preset-row">
            <Select
              placeholder="Select saved theme"
              value={selectedPresetId}
              options={themePresetOptions}
              onChange={(value) => onSelectedPresetChange(value)}
              allowClear
              className="theme-preset-select"
            />
            <Button
              icon={<CheckOutlined />}
              onClick={onApplySelectedPreset}
              loading={themePresetApplying}
              disabled={!selectedPresetId}
            >
              Apply
            </Button>
            <Popconfirm
              title="Delete selected theme?"
              okText="Delete"
              cancelText="Cancel"
              onConfirm={onDeleteSelectedPreset}
              disabled={!selectedPresetId}
            >
              <TableActionButton
                buttonType="default"
                buttonSize="middle"
                icon={<DeleteOutlined />}
                danger
                loading={themePresetDeleting}
                disabled={!selectedPresetId}
              >
                Delete
              </TableActionButton>
            </Popconfirm>
          </div>
          <div className="theme-preset-row">
            <Input
              placeholder="New theme name"
              value={newThemePresetName}
              onChange={(event) => onNewThemePresetNameChange(event.target.value)}
              onPressEnter={onSaveCurrentAsPreset}
              className="theme-preset-name-input"
            />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={themePresetSaving}
              onClick={onSaveCurrentAsPreset}
            >
              Save As Theme
            </Button>
          </div>
        </div>

        <div className="theme-settings-toolbar">
          <Segmented
            value={editingThemeMode}
            options={[
              { label: 'Light Theme', value: 'light' },
              { label: 'Dark Theme', value: 'dark' },
            ]}
            onChange={(value) => onEditingThemeModeChange(value as ThemeMode)}
          />
          <Button onClick={onResetCurrentPalette}>
            Reset Selected Theme
          </Button>
        </div>

        <Text type="secondary" className="theme-settings-hint">
          Colors are stored separately for light/dark mode and are saved to Firebase.
        </Text>

        <div className="theme-colors-grid">
          {THEME_COLOR_DEFINITIONS.map(({ cssVar, label }) => (
            <div key={cssVar} className="theme-color-row">
              <div className="theme-color-labels">
                <Text strong>{label}</Text>
                <Text code>{cssVar}</Text>
              </div>
              <Space wrap>
                <ColorPicker
                  value={localThemePalettes[editingThemeMode][cssVar]}
                  format="hex"
                  disabledAlpha
                  showText
                  onChange={(color) =>
                    onThemeColorChange(editingThemeMode, cssVar, color.toHexString(), { syncApp: false })
                  }
                  onChangeComplete={(color) =>
                    onThemeColorChange(editingThemeMode, cssVar, color.toHexString(), { syncApp: true })
                  }
                />
                <Input
                  value={themeInputValues[editingThemeMode][cssVar]}
                  onChange={(event) =>
                    onThemeInputChange(editingThemeMode, cssVar, event.target.value)
                  }
                  onBlur={() => onThemeInputCommit(editingThemeMode, cssVar)}
                  onPressEnter={() => onThemeInputCommit(editingThemeMode, cssVar)}
                  className="theme-color-input"
                  placeholder="#000000"
                />
                <Button
                  icon={<HighlightOutlined />}
                  onClick={() => {
                    void onPickColorFromScreen(editingThemeMode, cssVar);
                  }}
                >
                  Pick Screen Color
                </Button>
              </Space>
            </div>
          ))}
        </div>
      </Drawer>
    </>
  );
};
