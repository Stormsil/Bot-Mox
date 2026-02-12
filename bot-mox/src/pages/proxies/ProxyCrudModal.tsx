import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { IPQSResponse, Proxy } from '../../types';
import {
  createProxy,
  updateProxyById,
  type ProxiesBotMap,
} from '../../services/proxyDataService';
import {
  checkIPQuality,
  isAutoCheckEnabled,
  isProxySuspicious,
} from '../../services/ipqsService';
import {
  getCountryFlag,
  parseProxyString,
} from '../../utils/proxyUtils';
import type { ProxyWithBot } from './proxyColumns';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface ProxyCrudModalProps {
  open: boolean;
  editingProxy: ProxyWithBot | null;
  bots: ProxiesBotMap;
  providers: string[];
  onProviderCreated: (providerName: string) => void;
  onClose: () => void;
  onSaved: () => void;
}

const getProviderValue = (providerValue: string | string[] | undefined | null): string => {
  if (Array.isArray(providerValue)) {
    return providerValue[0] || 'IPRoyal';
  }
  if (typeof providerValue === 'string' && providerValue.trim() !== '') {
    return providerValue;
  }
  return 'IPRoyal';
};

const getTimestamp = (value: unknown): number => {
  if (value && typeof (value as { valueOf?: () => unknown }).valueOf === 'function') {
    const rawValue = (value as { valueOf: () => unknown }).valueOf();
    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value).getTime();
  }

  return Date.now();
};

export const ProxyCrudModal: React.FC<ProxyCrudModalProps> = ({
  open,
  editingProxy,
  bots,
  providers,
  onProviderCreated,
  onClose,
  onSaved,
}) => {
  const [form] = Form.useForm();
  const [proxyInput, setProxyInput] = useState('');
  const [parsedProxy, setParsedProxy] = useState<ReturnType<typeof parseProxyString>>(null);
  const [checkingIPQS, setCheckingIPQS] = useState(false);
  const [ipqsData, setIpqsData] = useState<IPQSResponse | null>(null);
  const [parseError, setParseError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (editingProxy) {
      const proxyString = `${editingProxy.ip}:${editingProxy.port}:${editingProxy.login}:${editingProxy.password}`;
      setProxyInput(proxyString);
      setParsedProxy(parseProxyString(proxyString));
      setIpqsData(null);
      setParseError('');
      setShowPassword(false);
      form.setFieldsValue({
        bot_id: editingProxy.bot_id,
        expires_at: dayjs(editingProxy.expires_at),
      });
      return;
    }

    setProxyInput('');
    setParsedProxy(null);
    setIpqsData(null);
    setParseError('');
    setShowPassword(false);
    form.resetFields();
    form.setFieldsValue({
      status: 'active',
      type: 'socks5',
      fraud_score: 0,
      provider: 'IPRoyal',
      expires_at: dayjs().add(30, 'days'),
    });
  }, [editingProxy, form, open]);

  const checkProxyIPQS = async (ip: string) => {
    setCheckingIPQS(true);
    try {
      const autoCheckEnabled = await isAutoCheckEnabled();
      if (!autoCheckEnabled) {
        return;
      }

      const data = await checkIPQuality(ip);
      setIpqsData(data);
    } catch {
      // no-op
    } finally {
      setCheckingIPQS(false);
    }
  };

  const handleProxyInputChange = (value: string) => {
    setProxyInput(value);
    setParseError('');
    setIpqsData(null);

    const parsed = parseProxyString(value);
    if (parsed) {
      setParsedProxy(parsed);
      void checkProxyIPQS(parsed.ip);
      return;
    }

    if (value.trim()) {
      setParsedProxy(null);
      setParseError('Invalid proxy format. Use: ip:port:login:password');
      return;
    }

    setParsedProxy(null);
  };

  const handleSave = async (values: {
    provider?: string | string[];
    bot_id?: string | null;
    expires_at?: unknown;
    country?: string;
    country_code?: string;
  }) => {
    try {
      const providerValue = getProviderValue(values.provider);
      if (providerValue && !providers.includes(providerValue)) {
        onProviderCreated(providerValue);
      }

      const expiresAt = getTimestamp(values.expires_at);

      if (!parsedProxy) {
        message.error('Please enter a valid proxy string');
        return;
      }

      if (editingProxy) {
        const proxyData: Partial<Proxy> = {
          ip: parsedProxy.ip,
          port: parsedProxy.port,
          login: parsedProxy.login,
          password: parsedProxy.password,
          type: parsedProxy.type,
          bot_id: values.bot_id || null,
          expires_at: expiresAt,
          updated_at: Date.now(),
        };

        await updateProxyById(editingProxy.id, proxyData);
        message.success('Proxy updated');
      } else {
        const hasIPQSData = Boolean(ipqsData && ipqsData.fraud_score !== undefined);
        let proxyStatus: 'active' | 'banned' = 'active';

        if (hasIPQSData && ipqsData) {
          const suspicious = await isProxySuspicious(ipqsData.fraud_score);
          if (suspicious) {
            proxyStatus = 'banned';
          }
        }

        const proxyData: Omit<Proxy, 'id'> = {
          ip: parsedProxy.ip,
          port: parsedProxy.port,
          login: parsedProxy.login,
          password: parsedProxy.password,
          provider: providerValue || 'IPRoyal',
          country: ipqsData?.country_code || values.country || 'Unknown',
          country_code: ipqsData?.country_code || values.country_code || '',
          type: parsedProxy.type,
          status: proxyStatus,
          bot_id: values.bot_id || null,
          fraud_score: hasIPQSData && ipqsData ? ipqsData.fraud_score : 0,
          vpn: ipqsData?.vpn || false,
          proxy: ipqsData?.proxy || false,
          tor: ipqsData?.tor || false,
          bot_status: ipqsData?.bot_status || false,
          isp: ipqsData?.isp || '',
          organization: ipqsData?.organization || '',
          city: ipqsData?.city || '',
          region: ipqsData?.region || '',
          zip_code: ipqsData?.zip_code || '',
          timezone: ipqsData?.timezone || '',
          latitude: ipqsData?.latitude ?? 0,
          longitude: ipqsData?.longitude ?? 0,
          expires_at: expiresAt,
          created_at: Date.now(),
          updated_at: Date.now(),
          last_checked: hasIPQSData ? Date.now() : undefined,
        };

        if (proxyStatus === 'banned') {
          message.warning(`Warning: High fraud score detected (${ipqsData?.fraud_score}). Proxy marked as banned.`);
        }

        await createProxy(proxyData);
        message.success('Proxy created successfully');
      }

      onSaved();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to save proxy: ${errorMessage}`);
    }
  };

  return (
    <Modal
      title={editingProxy ? 'Edit Proxy' : 'Add Proxy'}
      open={open}
      onOk={form.submit}
      onCancel={onClose}
      okText={editingProxy ? 'Update' : 'Create'}
      width={700}
      okButtonProps={{ disabled: !editingProxy && !parsedProxy }}
    >
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          label="Proxy String"
          required
          validateStatus={parseError ? 'error' : parsedProxy ? 'success' : ''}
          help={parseError || (parsedProxy ? 'Valid proxy format detected' : 'Format: ip:port:login:password')}
        >
          <TextArea
            placeholder="Enter proxy string (ip:port:login:password)"
            value={proxyInput}
            onChange={(event) => handleProxyInputChange(event.target.value)}
            rows={2}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        {parsedProxy && (
          <Alert
            message="Proxy Parsed Successfully"
            description={
              <Space direction="vertical" size={4}>
                <Text><strong>IP:</strong> {parsedProxy.ip}</Text>
                <Text><strong>Port:</strong> {parsedProxy.port}</Text>
                <Text><strong>Login:</strong> {parsedProxy.login}</Text>
                <Text><strong>Password:</strong> {showPassword ? parsedProxy.password : '•'.repeat(parsedProxy.password.length)}</Text>
                <Text><strong>Type:</strong> {parsedProxy.type.toUpperCase()}</Text>
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
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </Button>
            }
          />
        )}

        {!editingProxy && checkingIPQS && (
          <Alert
            message="Checking IP Quality..."
            description={<Spin size="small" />}
            type="info"
            style={{ marginBottom: 16 }}
          />
        )}

        {!editingProxy && ipqsData && (
          <Alert
            message={`IP Quality Check - Score: ${ipqsData.fraud_score}`}
            description={
              <Space direction="vertical" size={4}>
                <Space>
                  <span style={{ fontSize: '20px' }}>{getCountryFlag(ipqsData.country_code)}</span>
                  <Text><strong>Country:</strong> {ipqsData.country_code}</Text>
                </Space>
                <Text><strong>City:</strong> {ipqsData.city}, {ipqsData.region}</Text>
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
        )}

        <Form.Item
          name="bot_id"
          label="Assign to Bot"
          rules={[{ required: true, message: 'Please select a bot' }]}
        >
          <Select placeholder="Select bot">
            {Object.entries(bots).map(([id, bot]) => (
              <Option key={id} value={id}>
                {bot.character?.name || 'Unknown'} {bot.vm?.name ? `(${bot.vm.name})` : ''} - {id}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="expires_at"
          label="Expiration Date"
          rules={[{ required: true, message: 'Please select expiration date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
