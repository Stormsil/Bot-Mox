import {
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { Alert, Button, Space, Spin, Tag, Typography } from 'antd';
import type React from 'react';
import type { IPQSResponse } from '../../types';
import { getCountryFlag } from '../../utils/proxyUtils';

const { Text } = Typography;

export const ParsedProxyAlert: React.FC<{
  parsedProxy: { ip: string; port: string | number; login: string; password: string; type: string };
  showPassword: boolean;
  onTogglePassword: () => void;
}> = ({ parsedProxy, showPassword, onTogglePassword }) => {
  return (
    <Alert
      message="Proxy Parsed Successfully"
      description={
        <Space direction="vertical" size={4}>
          <Text>
            <strong>IP:</strong> {parsedProxy.ip}
          </Text>
          <Text>
            <strong>Port:</strong> {parsedProxy.port}
          </Text>
          <Text>
            <strong>Login:</strong> {parsedProxy.login}
          </Text>
          <Text>
            <strong>Password:</strong>{' '}
            {showPassword ? parsedProxy.password : '•'.repeat(parsedProxy.password.length)}
          </Text>
          <Text>
            <strong>Type:</strong> {parsedProxy.type.toUpperCase()}
          </Text>
        </Space>
      }
      type="success"
      showIcon
      icon={<CheckCircleOutlined />}
      style={{ marginBottom: 16 }}
      action={
        <Button
          size="small"
          type="text"
          icon={showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={onTogglePassword}
        >
          {showPassword ? 'Hide' : 'Show'}
        </Button>
      }
    />
  );
};

export const ProxyIpqsLoadingAlert: React.FC = () => {
  return (
    <Alert
      message="Checking IP Quality..."
      description={<Spin size="small" />}
      type="info"
      style={{ marginBottom: 16 }}
    />
  );
};

export const ProxyIpqsResultAlert: React.FC<{ ipqsData: IPQSResponse }> = ({ ipqsData }) => {
  return (
    <Alert
      message={`IP Quality Check - Score: ${ipqsData.fraud_score}`}
      description={
        <Space direction="vertical" size={4}>
          <Space>
            <span style={{ fontSize: '20px' }}>{getCountryFlag(ipqsData.country_code)}</span>
            <Text>
              <strong>Country:</strong> {ipqsData.country_code}
            </Text>
          </Space>
          <Text>
            <strong>City:</strong> {ipqsData.city}, {ipqsData.region}
          </Text>
          <Space size={8}>
            {ipqsData.vpn && <Tag color="orange">VPN</Tag>}
            {ipqsData.proxy && <Tag color="blue">Proxy</Tag>}
            {ipqsData.tor && <Tag color="red">TOR</Tag>}
            {ipqsData.bot_status && <Tag color="purple">Bot</Tag>}
          </Space>
        </Space>
      }
      type={ipqsData.fraud_score > 50 ? 'warning' : 'success'}
      showIcon
      icon={<SafetyOutlined />}
      style={{ marginBottom: 16 }}
    />
  );
};
