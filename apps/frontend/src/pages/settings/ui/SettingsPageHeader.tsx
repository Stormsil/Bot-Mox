import { ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { Button, Flex, Typography } from 'antd';
import type React from 'react';
import { bindCssModuleCx } from '../../../shared/lib/classNames';
import styles from '../SettingsPage.module.css';

const cx = bindCssModuleCx(styles);
const { Title } = Typography;

interface SettingsPageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export const SettingsPageHeader: React.FC<SettingsPageHeaderProps> = ({ loading, onRefresh }) => {
  return (
    <Flex className={cx('settings-header')} align="center" justify="space-between">
      <Title
        level={4}
        className={cx('settings-title')}
        style={{ margin: 0, color: 'var(--boxmox-color-text-primary)' }}
      >
        <ToolOutlined className={cx('settings-title-icon')} /> Settings
      </Title>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        Refresh
      </Button>
    </Flex>
  );
};
