import { DatePicker, Form, Input, Modal, message, Select } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  checkIPQuality,
  isAutoCheckEnabled,
  isProxySuspicious,
} from '../../entities/resources/api/ipqsFacade';
import {
  useCreateProxyMutation,
  useUpdateProxyMutation,
} from '../../entities/resources/api/useProxyMutations';
import type { IPQSResponse, Proxy as ProxyResource } from '../../types';
import { parseProxyString } from '../../utils/proxyUtils';
import type { ProxyWithBot } from './proxyColumns';
import { ParsedProxyAlert, ProxyIpqsLoadingAlert, ProxyIpqsResultAlert } from './proxyCrudAlerts';

const { Option } = Select;
const { TextArea } = Input;

interface ProxyCrudModalProps {
  open: boolean;
  editingProxy: ProxyWithBot | null;
  bots: ProxiesBotMap;
  providers: string[];
  onProviderCreated: (providerName: string) => void;
  onClose: () => void;
  onSaved: () => void;
}

type ProxiesBotMap = Record<
  string,
  {
    character?: { name?: string };
    person?: { name?: string; vm_name?: string };
    vm?: { name?: string };
    name?: string;
  }
>;

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
  const createProxyMutation = useCreateProxyMutation();
  const updateProxyMutation = useUpdateProxyMutation();
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
        const proxyData: Partial<ProxyResource> = {
          ip: parsedProxy.ip,
          port: parsedProxy.port,
          login: parsedProxy.login,
          password: parsedProxy.password,
          type: parsedProxy.type,
          bot_id: values.bot_id || null,
          expires_at: expiresAt,
          updated_at: Date.now(),
        };

        await updateProxyMutation.mutateAsync({ id: editingProxy.id, payload: proxyData });
        message.success('');
      } else {
        const hasIPQSData = Boolean(ipqsData && ipqsData.fraud_score !== undefined);
        let proxyStatus: 'active' | 'banned' = 'active';

        if (hasIPQSData && ipqsData) {
          const suspicious = await isProxySuspicious(ipqsData.fraud_score);
          if (suspicious) {
            proxyStatus = 'banned';
          }
        }

        const proxyData: Omit<ProxyResource, 'id'> = {
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
          message.warning(
            `Warning: High fraud score detected (${ipqsData?.fraud_score}). Proxy marked as banned.`,
          );
        }

        await createProxyMutation.mutateAsync(proxyData);
        message.success('');
      }

      onSaved();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to save proxy: ${errorMessage}`);
    }
  };

  return (
    <Modal
      title={editingProxy ? '' : ''}
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
          help={
            parseError ||
            (parsedProxy ? 'Valid proxy format detected' : 'Format: ip:port:login:password')
          }
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
          <ParsedProxyAlert
            parsedProxy={parsedProxy}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((prev) => !prev)}
          />
        )}

        {!editingProxy && checkingIPQS && <ProxyIpqsLoadingAlert />}

        {!editingProxy && ipqsData && <ProxyIpqsResultAlert ipqsData={ipqsData} />}

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
