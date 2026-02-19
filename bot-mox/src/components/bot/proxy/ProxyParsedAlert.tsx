import { CheckCircleFilled } from '@ant-design/icons';
import { Alert, Space, Typography } from 'antd';
import type React from 'react';
import type { ParsedProxy } from '../../../utils/proxyUtils';
import { TableActionButton } from '../../ui/TableActionButton';

const { Text } = Typography;

interface ProxyParsedAlertProps {
  parsedProxy: ParsedProxy;
  showPassword: boolean;
  onTogglePassword: () => void;
}

export const ProxyParsedAlert: React.FC<ProxyParsedAlertProps> = ({
  parsedProxy,
  showPassword,
  onTogglePassword,
}) => (
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
    icon={<CheckCircleFilled />}
    style={{ marginBottom: 16 }}
    action={
      <TableActionButton onClick={onTogglePassword}>
        {showPassword ? 'Hide' : 'Show'}
      </TableActionButton>
    }
  />
);
