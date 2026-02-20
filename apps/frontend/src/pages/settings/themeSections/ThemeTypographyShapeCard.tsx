import { Card, Input, InputNumber, Space, Typography } from 'antd';
import type { ReactElement } from 'react';
import { cx } from '../sections/classNames';
import type { ThemeSettingsPanelProps } from '../ThemeSettingsPanel.types';

const { Text } = Typography;

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
