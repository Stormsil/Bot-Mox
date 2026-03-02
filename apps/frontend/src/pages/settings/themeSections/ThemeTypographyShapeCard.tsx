import type { ReactElement } from 'react';
import {
  AppCard as Card,
  AppCol as Col,
  AppFlex as Flex,
  AppInput as Input,
  AppRow as Row,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../../shared/ui';
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
        <Row className={cx('theme-form-grid')} gutter={[10, 10]}>
          <Col span={24}>
            <Flex className={cx('theme-form-item')} vertical gap={6}>
              <Text type="secondary">Primary font</Text>
              <Input
                value={props.localTypographySettings.fontPrimary}
                onChange={(event) =>
                  props.onTypographySettingsChange({ fontPrimary: event.target.value })
                }
                placeholder='e.g. "Roboto Condensed", system-ui, sans-serif'
              />
            </Flex>
          </Col>
          <Col span={24}>
            <Flex className={cx('theme-form-item')} vertical gap={6}>
              <Text type="secondary">Condensed font</Text>
              <Input
                value={props.localTypographySettings.fontCondensed}
                onChange={(event) =>
                  props.onTypographySettingsChange({ fontCondensed: event.target.value })
                }
                placeholder='e.g. "Roboto Condensed", system-ui, sans-serif'
              />
            </Flex>
          </Col>
          <Col span={24}>
            <Flex className={cx('theme-form-item')} vertical gap={6}>
              <Text type="secondary">Monospace font</Text>
              <Input
                value={props.localTypographySettings.fontMono}
                onChange={(event) =>
                  props.onTypographySettingsChange({ fontMono: event.target.value })
                }
                placeholder='e.g. ui-monospace, "Cascadia Mono", monospace'
              />
            </Flex>
          </Col>
        </Row>
      </Space>
    </Card>
  );
}
