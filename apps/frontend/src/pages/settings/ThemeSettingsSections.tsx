import {
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
  ColorPicker,
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
import type { ReactElement } from 'react';
import { TableActionButton } from '../../components/ui/TableActionButton';
import { THEME_COLOR_DEFINITIONS, type ThemeVisualSettings } from '../../theme/themePalette';
import styles from './SettingsPage.module.css';
import type { ThemeSettingsPanelProps } from './ThemeSettingsPanel.types';
import { formatBytes } from './themePanel.helpers';

const { Text } = Typography;

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

type PresetProps = Pick<
  ThemeSettingsPanelProps,
  | 'selectedPresetId'
  | 'themePresetOptions'
  | 'onSelectedPresetChange'
  | 'onApplySelectedPreset'
  | 'themePresetApplying'
  | 'onDeleteSelectedPreset'
  | 'themePresetDeleting'
  | 'newThemePresetName'
  | 'onNewThemePresetNameChange'
  | 'onSaveCurrentAsPreset'
  | 'themePresetSaving'
>;

export function ThemePresetPanel(props: PresetProps): ReactElement {
  return (
    <div className={cx('theme-preset-panel')}>
      <Text strong className={cx('theme-preset-title')}>
        Saved Themes
      </Text>
      <div className={cx('theme-preset-row')}>
        <Select
          placeholder="Select saved theme"
          value={props.selectedPresetId}
          options={props.themePresetOptions}
          onChange={(value) => props.onSelectedPresetChange(value)}
          allowClear
          className={cx('theme-preset-select')}
        />
        <Button
          icon={<CheckOutlined />}
          onClick={props.onApplySelectedPreset}
          loading={props.themePresetApplying}
          disabled={!props.selectedPresetId}
        >
          Apply
        </Button>
        <Popconfirm
          title="Delete selected theme?"
          okText="Delete"
          cancelText="Cancel"
          onConfirm={props.onDeleteSelectedPreset}
          disabled={!props.selectedPresetId}
        >
          <TableActionButton
            buttonType="default"
            buttonSize="middle"
            icon={<DeleteOutlined />}
            danger
            loading={props.themePresetDeleting}
            disabled={!props.selectedPresetId}
          >
            Delete
          </TableActionButton>
        </Popconfirm>
      </div>
      <div className={cx('theme-preset-row')}>
        <Input
          placeholder="New theme name"
          value={props.newThemePresetName}
          onChange={(event) => props.onNewThemePresetNameChange(event.target.value)}
          onPressEnter={props.onSaveCurrentAsPreset}
          className={cx('theme-preset-name-input')}
        />
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={props.themePresetSaving}
          onClick={props.onSaveCurrentAsPreset}
        >
          Save As Theme
        </Button>
      </div>
    </div>
  );
}

type TypographyShapeProps = Pick<
  ThemeSettingsPanelProps,
  | 'localTypographySettings'
  | 'localShapeSettings'
  | 'onTypographySettingsChange'
  | 'onShapeSettingsChange'
>;

export function ThemeTypographyShapeCard(props: TypographyShapeProps): ReactElement {
  return (
    <Card className={cx('settings-card')} size="small" title="Typography & Shape">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text type="secondary">These settings are global and apply across the whole UI.</Text>
        <div className={cx('theme-form-grid')}>
          <div className={cx('theme-form-item')}>
            <Text type="secondary">Primary font</Text>
            <Input
              value={props.localTypographySettings.fontPrimary}
              onChange={(event) =>
                props.onTypographySettingsChange({ fontPrimary: event.target.value })
              }
              placeholder='e.g. "Roboto Condensed", system-ui, sans-serif'
            />
          </div>
          <div className={cx('theme-form-item')}>
            <Text type="secondary">Condensed font</Text>
            <Input
              value={props.localTypographySettings.fontCondensed}
              onChange={(event) =>
                props.onTypographySettingsChange({ fontCondensed: event.target.value })
              }
              placeholder='e.g. "Roboto Condensed", system-ui, sans-serif'
            />
          </div>
          <div className={cx('theme-form-item')}>
            <Text type="secondary">Monospace font</Text>
            <Input
              value={props.localTypographySettings.fontMono}
              onChange={(event) =>
                props.onTypographySettingsChange({ fontMono: event.target.value })
              }
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
              value={props.localShapeSettings.radiusNone}
              onChange={(value) => props.onShapeSettingsChange({ radiusNone: Number(value ?? 0) })}
            />
          </div>
          <div className={cx('theme-form-item')}>
            <Text type="secondary">Radius small (px)</Text>
            <InputNumber
              min={0}
              max={24}
              step={1}
              value={props.localShapeSettings.radiusSm}
              onChange={(value) => props.onShapeSettingsChange({ radiusSm: Number(value ?? 0) })}
            />
          </div>
          <div className={cx('theme-form-item')}>
            <Text type="secondary">Radius medium (px)</Text>
            <InputNumber
              min={0}
              max={24}
              step={1}
              value={props.localShapeSettings.radiusMd}
              onChange={(value) => props.onShapeSettingsChange({ radiusMd: Number(value ?? 0) })}
            />
          </div>
          <div className={cx('theme-form-item')}>
            <Text type="secondary">Radius large (px)</Text>
            <InputNumber
              min={0}
              max={24}
              step={1}
              value={props.localShapeSettings.radiusLg}
              onChange={(value) => props.onShapeSettingsChange({ radiusLg: Number(value ?? 0) })}
            />
          </div>
        </div>
      </Space>
    </Card>
  );
}

type VisualProps = Pick<
  ThemeSettingsPanelProps,
  | 'localVisualSettings'
  | 'themeAssets'
  | 'themeAssetsLoading'
  | 'themeAssetUploading'
  | 'onUploadThemeAsset'
  | 'onRefreshThemeAssets'
  | 'onSelectThemeBackground'
  | 'onDeleteThemeAsset'
  | 'onVisualSettingsChange'
  | 'onSaveVisualSettings'
  | 'themeSaving'
>;

export function ThemeVisualBackgroundCard(props: VisualProps): ReactElement {
  return (
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
            checked={props.localVisualSettings.enabled}
            onChange={(checked) =>
              props.onVisualSettingsChange({ enabled: checked, mode: checked ? 'image' : 'none' })
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
                void props.onUploadThemeAsset(file as File);
                return Upload.LIST_IGNORE;
              }}
            >
              <Button icon={<UploadOutlined />} loading={props.themeAssetUploading}>
                Upload
              </Button>
            </Upload>
            <Button
              onClick={() => void props.onRefreshThemeAssets()}
              loading={props.themeAssetsLoading}
            >
              Refresh
            </Button>
          </Space>
        </div>

        {props.themeAssets.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No uploaded backgrounds" />
        ) : (
          <List
            size="small"
            className={cx('theme-assets-list')}
            dataSource={props.themeAssets}
            loading={props.themeAssetsLoading}
            renderItem={(asset) => {
              const selected = asset.id === props.localVisualSettings.backgroundAssetId;
              return (
                <List.Item
                  actions={[
                    <Button
                      key="select"
                      type={selected ? 'primary' : 'default'}
                      size="small"
                      onClick={() => props.onSelectThemeBackground(asset.id)}
                    >
                      {selected ? 'Selected' : 'Select'}
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="Delete this image?"
                      onConfirm={() => void props.onDeleteThemeAsset(asset.id)}
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
            value={props.localVisualSettings.overlayOpacity}
            onChange={(value) => props.onVisualSettingsChange({ overlayOpacity: value })}
          />
        </div>
        <div className={cx('theme-visual-slider')}>
          <Text type="secondary">Background blur (px)</Text>
          <Slider
            min={0}
            max={24}
            step={1}
            value={props.localVisualSettings.blurPx}
            onChange={(value) => props.onVisualSettingsChange({ blurPx: value })}
          />
        </div>
        <div className={cx('theme-visual-slider')}>
          <Text type="secondary">Dim strength</Text>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={props.localVisualSettings.dimStrength}
            onChange={(value) => props.onVisualSettingsChange({ dimStrength: value })}
          />
        </div>

        <div className={cx('theme-visual-row')}>
          <Text type="secondary">Overlay color (light)</Text>
          <ColorPicker
            value={props.localVisualSettings.overlayColorLight}
            format="hex"
            disabledAlpha
            showText
            onChangeComplete={(color) =>
              props.onVisualSettingsChange({ overlayColorLight: color.toHexString() })
            }
          />
        </div>
        <div className={cx('theme-visual-row')}>
          <Text type="secondary">Overlay color (dark)</Text>
          <ColorPicker
            value={props.localVisualSettings.overlayColorDark}
            format="hex"
            disabledAlpha
            showText
            onChangeComplete={(color) =>
              props.onVisualSettingsChange({ overlayColorDark: color.toHexString() })
            }
          />
        </div>

        <div className={cx('theme-visual-row')}>
          <Text type="secondary">Position</Text>
          <Segmented
            value={props.localVisualSettings.backgroundPosition}
            options={[
              { label: 'Center', value: 'center' },
              { label: 'Top', value: 'top' },
            ]}
            onChange={(value) =>
              props.onVisualSettingsChange({
                backgroundPosition: value as ThemeVisualSettings['backgroundPosition'],
              })
            }
          />
        </div>
        <div className={cx('theme-visual-row')}>
          <Text type="secondary">Size</Text>
          <Segmented
            value={props.localVisualSettings.backgroundSize}
            options={[
              { label: 'Cover', value: 'cover' },
              { label: 'Contain', value: 'contain' },
              { label: 'Auto', value: 'auto' },
            ]}
            onChange={(value) =>
              props.onVisualSettingsChange({
                backgroundSize: value as ThemeVisualSettings['backgroundSize'],
              })
            }
          />
        </div>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={() => void props.onSaveVisualSettings()}
          loading={props.themeSaving}
        >
          Save Visual Settings
        </Button>
      </Space>
    </Card>
  );
}

type ColorsProps = Pick<
  ThemeSettingsPanelProps,
  | 'editingThemeMode'
  | 'localThemePalettes'
  | 'themeInputValues'
  | 'onThemeColorChange'
  | 'onThemeInputChange'
  | 'onThemeInputCommit'
  | 'onPickColorFromScreen'
>;

export function ThemeColorsGrid(props: ColorsProps): ReactElement {
  return (
    <div className={cx('theme-colors-grid')}>
      {THEME_COLOR_DEFINITIONS.map(({ cssVar, label }) => (
        <div key={cssVar} className={cx('theme-color-row')}>
          <div className={cx('theme-color-labels')}>
            <Text strong>{label}</Text>
            <Text code>{cssVar}</Text>
          </div>
          <Space wrap>
            <ColorPicker
              value={props.localThemePalettes[props.editingThemeMode][cssVar]}
              format="hex"
              disabledAlpha
              showText
              onChange={(color) =>
                props.onThemeColorChange(props.editingThemeMode, cssVar, color.toHexString(), {
                  syncApp: false,
                })
              }
              onChangeComplete={(color) =>
                props.onThemeColorChange(props.editingThemeMode, cssVar, color.toHexString(), {
                  syncApp: true,
                })
              }
            />
            <Input
              value={props.themeInputValues[props.editingThemeMode][cssVar]}
              onChange={(event) =>
                props.onThemeInputChange(props.editingThemeMode, cssVar, event.target.value)
              }
              onBlur={() => props.onThemeInputCommit(props.editingThemeMode, cssVar)}
              onPressEnter={() => props.onThemeInputCommit(props.editingThemeMode, cssVar)}
              className={cx('theme-color-input')}
              placeholder="#000000"
            />
            <Button
              icon={<HighlightOutlined />}
              onClick={() => void props.onPickColorFromScreen(props.editingThemeMode, cssVar)}
            >
              Pick Screen Color
            </Button>
          </Space>
        </div>
      ))}
    </div>
  );
}
