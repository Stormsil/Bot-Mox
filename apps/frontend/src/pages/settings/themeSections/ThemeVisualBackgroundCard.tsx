import { DeleteOutlined, PictureOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  ColorPicker,
  Empty,
  List,
  Popconfirm,
  Segmented,
  Slider,
  Space,
  Switch,
  Typography,
  Upload,
} from 'antd';
import type { ReactElement } from 'react';
import type { ThemeVisualSettings } from '../../../theme/themePalette';
import { cx } from '../sections/classNames';
import type { ThemeSettingsPanelProps } from '../ThemeSettingsPanel.types';
import { formatBytes } from '../themePanel.helpers';

const { Text } = Typography;

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
