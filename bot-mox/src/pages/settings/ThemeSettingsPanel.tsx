import {
  BgColorsOutlined,
  CheckOutlined,
  DeleteOutlined,
  HighlightOutlined,
  PictureOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  ColorPicker,
  Drawer,
  Empty,
  Input,
  InputNumber,
  List,
  Popconfirm,
  Segmented,
  Select,
  Slider,
  Space,
  Switch,
  Typography,
  Upload,
} from 'antd';
import type React from 'react';
import { TableActionButton } from '../../components/ui/TableActionButton';
import type { ThemeBackgroundAsset } from '../../entities/settings/model/theme';
import {
  THEME_COLOR_DEFINITIONS,
  type ThemeColorVariable,
  type ThemeMode,
  type ThemePalettes,
  type ThemeShapeSettings,
  type ThemeTypographySettings,
  type ThemeVisualSettings,
} from '../../theme/themePalette';
import styles from './SettingsPage.module.css';

const { Text } = Typography;

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

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
    options?: { syncApp?: boolean },
  ) => void;
  onThemeInputChange: (mode: ThemeMode, cssVar: ThemeColorVariable, value: string) => void;
  onThemeInputCommit: (mode: ThemeMode, cssVar: ThemeColorVariable) => void;
  onPickColorFromScreen: (mode: ThemeMode, cssVar: ThemeColorVariable) => Promise<void> | void;

  localTypographySettings: ThemeTypographySettings;
  localShapeSettings: ThemeShapeSettings;
  onTypographySettingsChange: (patch: Partial<ThemeTypographySettings>) => void;
  onShapeSettingsChange: (patch: Partial<ThemeShapeSettings>) => void;

  localVisualSettings: ThemeVisualSettings;
  themeAssets: ThemeBackgroundAsset[];
  themeAssetsLoading: boolean;
  themeAssetUploading: boolean;
  onRefreshThemeAssets: () => Promise<void> | void;
  onUploadThemeAsset: (file: File) => Promise<void> | void;
  onSelectThemeBackground: (assetId?: string) => void;
  onDeleteThemeAsset: (assetId: string) => Promise<void> | void;
  onVisualSettingsChange: (patch: Partial<ThemeVisualSettings>) => void;
  onSaveVisualSettings: () => Promise<void> | void;
}

function formatBytes(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = sizeBytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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
  localTypographySettings,
  localShapeSettings,
  onTypographySettingsChange,
  onShapeSettingsChange,
  localVisualSettings,
  themeAssets,
  themeAssetsLoading,
  themeAssetUploading,
  onRefreshThemeAssets,
  onUploadThemeAsset,
  onSelectThemeBackground,
  onDeleteThemeAsset,
  onVisualSettingsChange,
  onSaveVisualSettings,
}) => {
  return (
    <>
      <Col span={24}>
        <Card
          className={cx('settings-card theme-quick-card')}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <div className={cx('theme-quick-card-content')}>
            <div>
              <Text strong>
                <BgColorsOutlined /> Theme Colors
              </Text>
              <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                Save themes to database and apply in a few clicks.
              </Text>
            </div>
            <div className={cx('theme-quick-actions')}>
              <Select
                placeholder="Select saved theme"
                value={selectedPresetId}
                options={themePresetOptions}
                onChange={(value) => onSelectedPresetChange(value)}
                allowClear
                className={cx('theme-preset-select')}
              />
              <Button
                icon={<CheckOutlined />}
                onClick={onApplySelectedPreset}
                loading={themePresetApplying}
                disabled={!selectedPresetId}
              >
                Apply
              </Button>
              <Button type="primary" icon={<BgColorsOutlined />} onClick={onOpenThemeEditor}>
                Open Theme Editor
              </Button>
            </div>
          </div>
        </Card>
      </Col>

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
        open={isThemeDrawerOpen}
        onClose={onCloseThemeEditor}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
          body: {
            background: 'var(--boxmox-color-surface-panel)',
          },
        }}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={themeSaving}
            onClick={onSaveThemeColors}
          >
            Save
          </Button>
        }
      >
        <div className={cx('theme-preset-panel')}>
          <Text strong className={cx('theme-preset-title')}>
            Saved Themes
          </Text>
          <div className={cx('theme-preset-row')}>
            <Select
              placeholder="Select saved theme"
              value={selectedPresetId}
              options={themePresetOptions}
              onChange={(value) => onSelectedPresetChange(value)}
              allowClear
              className={cx('theme-preset-select')}
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
          <div className={cx('theme-preset-row')}>
            <Input
              placeholder="New theme name"
              value={newThemePresetName}
              onChange={(event) => onNewThemePresetNameChange(event.target.value)}
              onPressEnter={onSaveCurrentAsPreset}
              className={cx('theme-preset-name-input')}
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

        <Card className={cx('settings-card')} size="small" title="Typography & Shape">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">These settings are global and apply across the whole UI.</Text>

            <div className={cx('theme-form-grid')}>
              <div className={cx('theme-form-item')}>
                <Text type="secondary">Primary font</Text>
                <Input
                  value={localTypographySettings.fontPrimary}
                  onChange={(event) =>
                    onTypographySettingsChange({ fontPrimary: event.target.value })
                  }
                  placeholder='e.g. "Roboto Condensed", system-ui, sans-serif'
                />
              </div>

              <div className={cx('theme-form-item')}>
                <Text type="secondary">Condensed font</Text>
                <Input
                  value={localTypographySettings.fontCondensed}
                  onChange={(event) =>
                    onTypographySettingsChange({ fontCondensed: event.target.value })
                  }
                  placeholder='e.g. "Roboto Condensed", system-ui, sans-serif'
                />
              </div>

              <div className={cx('theme-form-item')}>
                <Text type="secondary">Monospace font</Text>
                <Input
                  value={localTypographySettings.fontMono}
                  onChange={(event) => onTypographySettingsChange({ fontMono: event.target.value })}
                  placeholder='e.g. ui-monospace, "Cascadia Mono", monospace'
                />
              </div>
            </div>

            <div className={cx('theme-shape-grid')}>
              <div className={cx('theme-form-item')}>
                <Text type="secondary">Radius none (px)</Text>
                <InputNumber
                  min={0}
                  max={24}
                  step={1}
                  value={localShapeSettings.radiusNone}
                  onChange={(value) => onShapeSettingsChange({ radiusNone: Number(value ?? 0) })}
                />
              </div>

              <div className={cx('theme-form-item')}>
                <Text type="secondary">Radius small (px)</Text>
                <InputNumber
                  min={0}
                  max={24}
                  step={1}
                  value={localShapeSettings.radiusSm}
                  onChange={(value) => onShapeSettingsChange({ radiusSm: Number(value ?? 0) })}
                />
              </div>

              <div className={cx('theme-form-item')}>
                <Text type="secondary">Radius medium (px)</Text>
                <InputNumber
                  min={0}
                  max={24}
                  step={1}
                  value={localShapeSettings.radiusMd}
                  onChange={(value) => onShapeSettingsChange({ radiusMd: Number(value ?? 0) })}
                />
              </div>

              <div className={cx('theme-form-item')}>
                <Text type="secondary">Radius large (px)</Text>
                <InputNumber
                  min={0}
                  max={24}
                  step={1}
                  value={localShapeSettings.radiusLg}
                  onChange={(value) => onShapeSettingsChange({ radiusLg: Number(value ?? 0) })}
                />
              </div>
            </div>
          </Space>
        </Card>

        <Card
          className={cx('settings-card')}
          size="small"
          title={
            <>
              <PictureOutlined /> Visual Background
            </>
          }
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div className={cx('theme-visual-row')}>
              <Text>Enable visual background</Text>
              <Switch
                checked={localVisualSettings.enabled}
                onChange={(checked) =>
                  onVisualSettingsChange({ enabled: checked, mode: checked ? 'image' : 'none' })
                }
              />
            </div>

            <div className={cx('theme-visual-row')}>
              <Text>Background image</Text>
              <Space wrap>
                <Upload
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    void onUploadThemeAsset(file as File);
                    return Upload.LIST_IGNORE;
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={themeAssetUploading}>
                    Upload
                  </Button>
                </Upload>
                <Button onClick={() => void onRefreshThemeAssets()} loading={themeAssetsLoading}>
                  Refresh
                </Button>
              </Space>
            </div>

            {themeAssets.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No uploaded backgrounds" />
            ) : (
              <List
                size="small"
                className={cx('theme-assets-list')}
                dataSource={themeAssets}
                loading={themeAssetsLoading}
                renderItem={(asset) => {
                  const selected = asset.id === localVisualSettings.backgroundAssetId;
                  return (
                    <List.Item
                      actions={[
                        <Button
                          key="select"
                          type={selected ? 'primary' : 'default'}
                          size="small"
                          onClick={() => onSelectThemeBackground(asset.id)}
                        >
                          {selected ? 'Selected' : 'Select'}
                        </Button>,
                        <Popconfirm
                          key="delete"
                          title="Delete this image?"
                          onConfirm={() => void onDeleteThemeAsset(asset.id)}
                        >
                          <Button danger size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          asset.image_url ? (
                            <img
                              src={asset.image_url}
                              className={cx('theme-asset-thumb')}
                              alt="theme background"
                            />
                          ) : (
                            <PictureOutlined />
                          )
                        }
                        title={asset.object_key.split('/').pop() || asset.id}
                        description={`${formatBytes(asset.size_bytes)}${asset.width && asset.height ? ` • ${asset.width}x${asset.height}` : ''}`}
                      />
                    </List.Item>
                  );
                }}
              />
            )}

            <div className={cx('theme-visual-slider')}>
              <Text type="secondary">Overlay opacity</Text>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={localVisualSettings.overlayOpacity}
                onChange={(value) => onVisualSettingsChange({ overlayOpacity: value })}
              />
            </div>

            <div className={cx('theme-visual-slider')}>
              <Text type="secondary">Background blur (px)</Text>
              <Slider
                min={0}
                max={24}
                step={1}
                value={localVisualSettings.blurPx}
                onChange={(value) => onVisualSettingsChange({ blurPx: value })}
              />
            </div>

            <div className={cx('theme-visual-slider')}>
              <Text type="secondary">Dim strength</Text>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={localVisualSettings.dimStrength}
                onChange={(value) => onVisualSettingsChange({ dimStrength: value })}
              />
            </div>

            <div className={cx('theme-visual-row')}>
              <Text type="secondary">Overlay color (light)</Text>
              <ColorPicker
                value={localVisualSettings.overlayColorLight}
                format="hex"
                disabledAlpha
                showText
                onChangeComplete={(color) =>
                  onVisualSettingsChange({ overlayColorLight: color.toHexString() })
                }
              />
            </div>

            <div className={cx('theme-visual-row')}>
              <Text type="secondary">Overlay color (dark)</Text>
              <ColorPicker
                value={localVisualSettings.overlayColorDark}
                format="hex"
                disabledAlpha
                showText
                onChangeComplete={(color) =>
                  onVisualSettingsChange({ overlayColorDark: color.toHexString() })
                }
              />
            </div>

            <div className={cx('theme-visual-row')}>
              <Text type="secondary">Position</Text>
              <Segmented
                value={localVisualSettings.backgroundPosition}
                options={[
                  { label: 'Center', value: 'center' },
                  { label: 'Top', value: 'top' },
                ]}
                onChange={(value) =>
                  onVisualSettingsChange({
                    backgroundPosition: value as ThemeVisualSettings['backgroundPosition'],
                  })
                }
              />
            </div>

            <div className={cx('theme-visual-row')}>
              <Text type="secondary">Size</Text>
              <Segmented
                value={localVisualSettings.backgroundSize}
                options={[
                  { label: 'Cover', value: 'cover' },
                  { label: 'Contain', value: 'contain' },
                  { label: 'Auto', value: 'auto' },
                ]}
                onChange={(value) =>
                  onVisualSettingsChange({
                    backgroundSize: value as ThemeVisualSettings['backgroundSize'],
                  })
                }
              />
            </div>

            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => void onSaveVisualSettings()}
              loading={themeSaving}
            >
              Save Visual Settings
            </Button>
          </Space>
        </Card>

        <div className={cx('theme-settings-toolbar')}>
          <Segmented
            value={editingThemeMode}
            options={[
              { label: 'Light Theme', value: 'light' },
              { label: 'Dark Theme', value: 'dark' },
            ]}
            onChange={(value) => onEditingThemeModeChange(value as ThemeMode)}
          />
          <Button onClick={onResetCurrentPalette}>Reset Selected Theme</Button>
        </div>

        <Text type="secondary" className={cx('theme-settings-hint')}>
          Colors are stored separately for light/dark mode and are saved to the backend.
        </Text>

        <div className={cx('theme-colors-grid')}>
          {THEME_COLOR_DEFINITIONS.map(({ cssVar, label }) => (
            <div key={cssVar} className={cx('theme-color-row')}>
              <div className={cx('theme-color-labels')}>
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
                    onThemeColorChange(editingThemeMode, cssVar, color.toHexString(), {
                      syncApp: false,
                    })
                  }
                  onChangeComplete={(color) =>
                    onThemeColorChange(editingThemeMode, cssVar, color.toHexString(), {
                      syncApp: true,
                    })
                  }
                />
                <Input
                  value={themeInputValues[editingThemeMode][cssVar]}
                  onChange={(event) =>
                    onThemeInputChange(editingThemeMode, cssVar, event.target.value)
                  }
                  onBlur={() => onThemeInputCommit(editingThemeMode, cssVar)}
                  onPressEnter={() => onThemeInputCommit(editingThemeMode, cssVar)}
                  className={cx('theme-color-input')}
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
