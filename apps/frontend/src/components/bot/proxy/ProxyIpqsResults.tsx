import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Progress, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { getFraudScoreColor, getFraudScoreLabel } from '../../../entities/resources/api/ipqsFacade';
import type { IPQSResponse } from '../../../types';
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
        <div className={styles['ipqs-results']}>
          <div className={styles['ipqs-row']}>
            <Text type="secondary">Fraud Score:</Text>
            <div className={styles['fraud-score-display']}>
              <Progress
                percent={ipqsData.fraud_score}
                size="small"
                strokeColor={fraudScoreColor}
                trailColor="var(--boxmox-color-surface-muted)"
                style={{ width: 120 }}
              />
              <Text strong style={{ color: fraudScoreColor }}>
                {fraudScoreLabel}
              </Text>
            </div>
          </div>

          <div className={styles['ipqs-row']}>
            <Text type="secondary">Country:</Text>
            <Text>
              {ipqsData.country_code || 'Unknown'} {ipqsData.city ? `- ${ipqsData.city}` : ''}
            </Text>
          </div>

          {(ipqsData.vpn || ipqsData.proxy || ipqsData.tor || ipqsData.bot_status) && (
            <div className={styles['ipqs-flags']}>
              {ipqsData.vpn && <Tag color="orange">VPN</Tag>}
              {ipqsData.proxy && <Tag color="red">Proxy</Tag>}
              {ipqsData.tor && <Tag color="purple">TOR</Tag>}
              {ipqsData.bot_status && <Tag color="magenta">Bot</Tag>}
            </div>
          )}
        </div>
      }
      type={ipqsData.fraud_score > 75 ? 'error' : ipqsData.fraud_score > 50 ? 'warning' : 'success'}
      showIcon
      style={{ marginTop: 16, marginBottom: 16 }}
    />
  );
};
