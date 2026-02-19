import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';
import { Button, Card, Col, Select, Typography } from 'antd';
import type React from 'react';
import styles from './SettingsPage.module.css';

const { Text } = Typography;

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

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
  );
};
