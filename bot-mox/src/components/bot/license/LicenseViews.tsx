import React from 'react';
import {
  CheckCircleOutlined,
  CopyOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  PlusOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Dropdown, Empty, Popconfirm, Space, Spin, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { MenuProps } from 'antd';
import { TableActionButton } from '../../ui/TableActionButton';
import { getDaysLeftColor, getLicenseStatusColor, getLicenseStatusText } from './helpers';
import type { BotLicenseProps, LicenseInfo } from './types';
import styles from './license.module.css';

const { Text } = Typography;

export const LicenseLoadingCard: React.FC = () => (
  <div className={styles['bot-license']}>
    <Card className={styles['license-card']}>
      <Spin size="large" />
    </Card>
  </div>
);

interface LicenseEmptyCardProps {
  addMenuItems: MenuProps['items'];
  onAddMenuClick: MenuProps['onClick'];
}

export const LicenseEmptyCard: React.FC<LicenseEmptyCardProps> = ({ addMenuItems, onAddMenuClick }) => (
  <Card
    className={styles['license-card']}
    title={
      <Space>
        <KeyOutlined />
        <span>License Information</span>
      </Space>
    }
    extra={
      <Dropdown menu={{ items: addMenuItems, onClick: onAddMenuClick }}>
        <Button type="primary" size="small" icon={<PlusOutlined />}>
          Add
        </Button>
      </Dropdown>
    }
  >
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <span>
          <Text type="secondary">No license assigned to this bot</Text>
        </span>
      }
    />
  </Card>
);

interface LicenseDetailsCardProps {
  bot: BotLicenseProps['bot'];
  license: LicenseInfo;
  onEdit: () => void;
  onCopyKey: () => void;
  onUnassign: () => Promise<void>;
}

export const LicenseDetailsCard: React.FC<LicenseDetailsCardProps> = ({
  bot,
  license,
  onEdit,
  onCopyKey,
  onUnassign,
}) => (
  <>
    {(license.isExpired || license.isExpiringSoon) && (
      <Alert
        className={styles['license-alert']}
        message={license.isExpired ? 'License Expired' : 'License Expiring Soon'}
        description={
          license.isExpired
            ? 'This license has expired. The bot may stop functioning. Please renew the license.'
            : `This license will expire in ${license.daysRemaining} day(s). Please renew soon to avoid interruption.`
        }
        type={license.isExpired ? 'error' : 'warning'}
        showIcon
        icon={<WarningOutlined />}
      />
    )}

    <Card
      className={styles['license-card']}
      title={
        <Space>
          <KeyOutlined />
          <span>License Information</span>
        </Space>
      }
      extra={
        <Space>
          <TableActionButton icon={<EditOutlined />} onClick={onEdit} tooltip="Edit">
            Edit
          </TableActionButton>
          <Popconfirm
            title="Unassign License?"
            description="This will remove the bot from this license. The license will be deleted if no bots remain."
            onConfirm={() => void onUnassign()}
            okText="Unassign"
            cancelText="Cancel"
          >
            <TableActionButton danger tooltip="Unassign">
              Unassign
            </TableActionButton>
          </Popconfirm>
        </Space>
      }
    >
      <div className={styles['license-content']}>
        <div className={styles['license-field']}>
          <Text type="secondary" className={styles['field-label']}>
            License Key
          </Text>
          <div className={styles['license-key-container']}>
            <Text className={styles['license-key']} copyable={{ text: license.key, icon: <CopyOutlined /> }}>
              {license.key.substring(0, 40)}...
            </Text>
            <TableActionButton icon={<CopyOutlined />} onClick={onCopyKey} tooltip="Copy">
              Copy
            </TableActionButton>
          </div>
        </div>

        <div className={styles['license-row']}>
          <div className={styles['license-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Bot Name
            </Text>
            <div>
              <Text strong>{bot.character?.name || bot.name || bot.id.substring(0, 8)}</Text>
            </div>
          </div>

          <div className={styles['license-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Status
            </Text>
            <div>
              <Tag
                color={getLicenseStatusColor(license)}
                icon={
                  license.isExpired ? (
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  ) : license.isExpiringSoon ? (
                    <WarningOutlined style={{ color: '#faad14' }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  )
                }
              >
                {getLicenseStatusText(license)}
              </Tag>
            </div>
          </div>
        </div>

        <div className={styles['license-row']}>
          <div className={styles['license-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Created
            </Text>
            <div>
              <Text>{dayjs(license.created_at).format('DD.MM.YYYY')}</Text>
            </div>
          </div>

          <div className={styles['license-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Last Updated
            </Text>
            <div>
              <Text>{dayjs(license.updated_at).format('DD.MM.YYYY')}</Text>
            </div>
          </div>
        </div>

        <div className={styles['license-row']}>
          <div className={styles['license-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Expiration Date
            </Text>
            <div>
              <Text>{dayjs(license.expires_at).format('DD.MM.YYYY')}</Text>
            </div>
          </div>

          <div className={styles['license-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Days Left
            </Text>
            <div>
              <Text strong style={{ color: getDaysLeftColor(license) }}>
                {license.isExpired ? '0' : license.daysRemaining}
              </Text>
            </div>
          </div>
        </div>

        {license.isExpired && (
          <div className={styles['license-actions']}>
            <Alert
              message="Action Required"
              description="Please renew this license to continue bot operation."
              type="error"
              showIcon
            />
          </div>
        )}
      </div>
    </Card>
  </>
);
