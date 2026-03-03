import { SafetyCertificateOutlined } from '@ant-design/icons';

import type React from 'react';
import {
  getFraudScoreColor,
  getFraudScoreLabel,
} from '../../../../entities/resources/api/ipqsFacade';
import type { IPQSResponse } from '../../../../entities/resources/model/types';
import {
  AppAlert as Alert,
  AppFlex as Flex,
  AppProgress as Progress,
  AppSpace as Space,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../../../shared/ui';
import styles from './proxy.module.css';

const { Text } = Typography;

interface ProxyIpqsResultsProps {
  ipqsData: IPQSResponse | null;
}

export const ProxyIpqsResults: React.FC<ProxyIpqsResultsProps> = ({ ipqsData }) => {
  if (!ipqsData) {
    return null;
  }

  const fraudScoreColor = getFraudScoreColor(ipqsData.fraud_score);
  const fraudScoreLabel = getFraudScoreLabel(ipqsData.fraud_score);

  return (
    <Alert
      message={
        <Space>
          <SafetyCertificateOutlined />
          <span>IPQS Check Results</span>
        </Space>
      }
      description={
        <Flex vertical gap={8}>
          <Flex justify="space-between" align="center" className={styles['ipqs-row-divider']}>
            <Text type="secondary">Fraud Score:</Text>
            <Space size={12} align="center">
              <Progress
                percent={ipqsData.fraud_score}
                size="small"
                strokeColor={fraudScoreColor}
                trailColor="var(--botmox-color-surface-muted)"
                style={{ width: 120 }}
              />
              <Text strong style={{ color: fraudScoreColor }}>
                {fraudScoreLabel}
              </Text>
            </Space>
          </Flex>

          <Flex justify="space-between" align="center">
            <Text type="secondary">Country:</Text>
            <Text>
              {ipqsData.country_code || 'Unknown'} {ipqsData.city ? `- ${ipqsData.city}` : ''}
            </Text>
          </Flex>

          {(ipqsData.vpn || ipqsData.proxy || ipqsData.tor || ipqsData.bot_status) && (
            <Space size={8} wrap className={styles['ipqs-flags-panel']}>
              {ipqsData.vpn && <Tag intent="warning">VPN</Tag>}
              {ipqsData.proxy && <Tag intent="error">Proxy</Tag>}
              {ipqsData.tor && <Tag intent="info">TOR</Tag>}
              {ipqsData.bot_status && <Tag intent="info">Bot</Tag>}
            </Space>
          )}
        </Flex>
      }
      type={ipqsData.fraud_score > 75 ? 'error' : ipqsData.fraud_score > 50 ? 'warning' : 'success'}
      showIcon
      style={{ marginTop: 16, marginBottom: 16 }}
    />
  );
};
