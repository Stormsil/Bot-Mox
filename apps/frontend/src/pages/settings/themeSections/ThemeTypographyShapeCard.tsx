import { Card, Input, Space, Typography } from 'antd';
import type { ReactElement } from 'react';
import { cx } from '../sections/classNames';
import type { ThemeSettingsPanelProps } from '../ThemeSettingsPanel.types';

const { Text } = Typography;

type TypographyShapeProps = Pick<
  ThemeSettingsPanelProps,
  'localTypographySettings' | 'onTypographySettingsChange'
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
      </Space>
    </Card>
  );
}
