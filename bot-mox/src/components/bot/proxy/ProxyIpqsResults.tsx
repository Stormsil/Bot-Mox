import React from 'react';
import { Progress, Alert, Space, Tag, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { getFraudScoreColor, getFraudScoreLabel } from '../../../services/ipqsService';
import type { IPQSResponse } from '../../../types';

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
        <div className="ipqs-results">
          <div className="ipqs-row">
            <Text type="secondary">Fraud Score:</Text>
            <div className="fraud-score-display">
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

          <div className="ipqs-row">
            <Text type="secondary">Country:</Text>
            <Text>
              {ipqsData.country_code || 'Unknown'} {ipqsData.city ? `- ${ipqsData.city}` : ''}
            </Text>
          </div>

          {(ipqsData.vpn || ipqsData.proxy || ipqsData.tor || ipqsData.bot_status) && (
            <div className="ipqs-flags">
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
