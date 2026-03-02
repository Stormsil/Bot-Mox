import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';

import type React from 'react';
import { bindCssModuleCx } from '../../shared/lib/classNames';
import {
  AppButton as Button,
  AppCard as Card,
  AppCol as Col,
  AppFlex as Flex,
  AppSelect as Select,
  AppTypography as Typography,
} from '../../shared/ui';
import styles from './SettingsPage.module.css';

const { Text } = Typography;

const cx = bindCssModuleCx(styles);

interface ThemeQuickCardProps {
  selectedPresetId?: string;
  themePresetOptions: Array<{ label: string; value: string }>;
  onSelectedPresetChange: (value?: string) => void;
  onOpenThemeEditor: () => void;
  onApplySelectedPreset: () => void;
  themePresetApplying: boolean;
}

export const ThemeQuickCard: React.FC<ThemeQuickCardProps> = ({
  selectedPresetId,
  themePresetOptions,
  onSelectedPresetChange,
  onOpenThemeEditor,
  onApplySelectedPreset,
  themePresetApplying,
}) => {
  return (
    <Col span={24}>
      <Card className={cx('settings-card theme-quick-card')}>
        <Flex
          className={cx('theme-quick-card-content')}
          align="center"
          justify="space-between"
          gap={12}
          wrap
        >
          <div>
            <Text strong>
              <BgColorsOutlined /> Theme Colors
            </Text>
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              Save themes to database and apply in a few clicks.
            </Text>
          </div>
          <Flex className={cx('theme-quick-actions')} align="center" gap={8} wrap>
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
          </Flex>
        </Flex>
      </Card>
    </Col>
  );
};
