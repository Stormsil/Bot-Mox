import {
  CheckCircleOutlined,
  CopyOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  PlusOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

import dayjs from 'dayjs';
import type React from 'react';
import {
  AppAlert as Alert,
  AppButton as Button,
  AppCard as Card,
  AppCol as Col,
  AppDropdown as Dropdown,
  AppEmpty as Empty,
  AppFlex as Flex,
  AppPopconfirm as Popconfirm,
  AppRow as Row,
  AppSpace as Space,
  AppSpin as Spin,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../../../shared/ui';
import { TableActionButton } from '../../../../shared/ui/TableActionButton';
import { getDaysLeftColor, getLicenseStatusColor, getLicenseStatusText } from './helpers';
import styles from './license.module.css';
import type { BotLicenseProps, LicenseInfo } from './types';

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

export const LicenseEmptyCard: React.FC<LicenseEmptyCardProps> = ({
  addMenuItems,
  onAddMenuClick,
}) => (
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
      className={styles['license-empty']}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <span className={styles['empty-description']}>
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
      <Flex vertical gap={16}>
        <Flex vertical gap={4} className={styles['license-field']}>
          <Text type="secondary" className={styles['field-label']}>
            License Key
          </Text>
          <Flex align="center" gap={8} wrap>
            <Text
              code
              className={styles['license-key']}
              copyable={{ text: license.key, icon: <CopyOutlined /> }}
            >
              {license.key.substring(0, 40)}...
            </Text>
            <TableActionButton icon={<CopyOutlined />} onClick={onCopyKey} tooltip="Copy">
              Copy
            </TableActionButton>
          </Flex>
        </Flex>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Flex vertical gap={4} className={styles['license-field']}>
              <Text type="secondary" className={styles['field-label']}>
                Bot Name
              </Text>
              <div>
                <Text strong>{bot.character?.name || bot.name || bot.id.substring(0, 8)}</Text>
              </div>
            </Flex>
          </Col>

          <Col xs={24} md={12}>
            <Flex vertical gap={4} className={styles['license-field']}>
              <Text type="secondary" className={styles['field-label']}>
                Status
              </Text>
              <div>
                <Tag
                  bordered={false}
                  color={getLicenseStatusColor(license)}
                  icon={
                    license.isExpired ? (
                      <ExclamationCircleOutlined
                        style={{ color: 'var(--boxmox-color-status-danger)' }}
                      />
                    ) : license.isExpiringSoon ? (
                      <WarningOutlined style={{ color: 'var(--boxmox-color-status-warning)' }} />
                    ) : (
                      <CheckCircleOutlined
                        style={{ color: 'var(--boxmox-color-status-success)' }}
                      />
                    )
                  }
                >
                  {getLicenseStatusText(license).toUpperCase()}
                </Tag>
              </div>
            </Flex>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Flex vertical gap={4} className={styles['license-field']}>
              <Text type="secondary" className={styles['field-label']}>
                Created
              </Text>
              <div>
                <Text>{dayjs(license.created_at).format('DD.MM.YYYY')}</Text>
              </div>
            </Flex>
          </Col>

          <Col xs={24} md={12}>
            <Flex vertical gap={4} className={styles['license-field']}>
              <Text type="secondary" className={styles['field-label']}>
                Last Updated
              </Text>
              <div>
                <Text>{dayjs(license.updated_at).format('DD.MM.YYYY')}</Text>
              </div>
            </Flex>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Flex vertical gap={4} className={styles['license-field']}>
              <Text type="secondary" className={styles['field-label']}>
                Expiration Date
              </Text>
              <div>
                <Text>{dayjs(license.expires_at).format('DD.MM.YYYY')}</Text>
              </div>
            </Flex>
          </Col>

          <Col xs={24} md={12}>
            <Flex vertical gap={4} className={styles['license-field']}>
              <Text type="secondary" className={styles['field-label']}>
                Days Left
              </Text>
              <div>
                <Text strong style={{ color: getDaysLeftColor(license) }}>
                  {license.isExpired ? '0' : license.daysRemaining}
                </Text>
              </div>
            </Flex>
          </Col>
        </Row>

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
      </Flex>
    </Card>
  </>
);
