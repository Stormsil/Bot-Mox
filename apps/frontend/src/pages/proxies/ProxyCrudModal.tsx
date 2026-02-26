import { proxyResourceCreateSchema, proxyResourceUpdateSchema } from '@botmox/api-contract';
import { type HttpError, useCreate, useUpdate } from '@refinedev/core';
import { DatePicker, Form, Input, Modal, message, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  checkIPQuality,
  isAutoCheckEnabled,
  isProxySuspicious,
} from '../../entities/resources/api/ipqsFacade';
import type { IPQSResponse, Proxy as ProxyResource } from '../../entities/resources/model/types';
import { parseProxyString } from '../../utils/proxyUtils';
import type { ProxyWithBot } from './proxyColumns';
import { ParsedProxyAlert, ProxyIpqsLoadingAlert, ProxyIpqsResultAlert } from './proxyCrudAlerts';

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

interface ProxyCrudFormValues {
  proxyString: string;
  bot_id: string;
  expires_at: Dayjs | null;
  provider?: string;
  country?: string;
  country_code?: string;
}

const DEFAULT_PROVIDER = 'IPRoyal';

const getProviderValue = (providerValue: string | string[] | undefined | null): string => {
  if (Array.isArray(providerValue)) {
    return providerValue[0] || DEFAULT_PROVIDER;
  }
  if (typeof providerValue === 'string' && providerValue.trim() !== '') {
    return providerValue;
  }
  return DEFAULT_PROVIDER;
};

function getCreateDefaults(): ProxyCrudFormValues {
  return {
    proxyString: '',
    bot_id: '',
    provider: DEFAULT_PROVIDER,
    expires_at: dayjs(Date.now() + 30 * 24 * 60 * 60 * 1000),
    country: undefined,
    country_code: undefined,
  };
}

function getEditDefaults(editingProxy: ProxyWithBot): ProxyCrudFormValues {
  return {
    proxyString: `${editingProxy.ip}:${editingProxy.port}:${editingProxy.login}:${editingProxy.password}`,
    bot_id: editingProxy.bot_id ?? '',
    provider: editingProxy.provider || DEFAULT_PROVIDER,
    expires_at: dayjs(editingProxy.expires_at),
    country: editingProxy.country || undefined,
    country_code: editingProxy.country_code || undefined,
  };
}

export const ProxyCrudModal: React.FC<ProxyCrudModalProps> = ({
  open,
  editingProxy,
  bots,
  providers,
  onProviderCreated,
  onClose,
  onSaved,
}) => {
  const createProxyMutation = useCreate<ProxyResource, HttpError, Omit<ProxyResource, 'id'>>();
  const updateProxyMutation = useUpdate<ProxyResource, HttpError, Partial<ProxyResource>>();
  const [checkingIPQS, setCheckingIPQS] = useState(false);
  const [ipqsData, setIpqsData] = useState<IPQSResponse | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form] = Form.useForm<ProxyCrudFormValues>();

  const proxyInput = Form.useWatch('proxyString', form) ?? '';
  const parsedProxy = useMemo(() => parseProxyString(proxyInput), [proxyInput]);

  useEffect(() => {
    if (!open) return;

    setIpqsData(null);
    setCheckingIPQS(false);
    setShowPassword(false);
    form.setFieldsValue(editingProxy ? getEditDefaults(editingProxy) : getCreateDefaults());
  }, [editingProxy, form, open]);

  useEffect(() => {
    if (proxyInput.trim() === '') {
      setIpqsData(null);
      return;
    }
    setIpqsData(null);
  }, [proxyInput]);

  useEffect(() => {
    if (!open || editingProxy || !parsedProxy) return;

    let active = true;
    void (async () => {
      setCheckingIPQS(true);
      try {
        const autoCheckEnabled = await isAutoCheckEnabled();
        if (!autoCheckEnabled || !active) return;
        const data = await checkIPQuality(parsedProxy.ip);
        if (active) {
          setIpqsData(data);
        }
      } catch {
        // no-op
      } finally {
        if (active) {
          setCheckingIPQS(false);
        }
      }
    })();

    return () => {
      active = false;
      setCheckingIPQS(false);
    };
  }, [editingProxy, open, parsedProxy]);

  const submitForm = async () => {
    try {
      const values = await form.validateFields();
      const providerValue = getProviderValue(values.provider);
      if (providerValue && !providers.includes(providerValue)) {
        onProviderCreated(providerValue);
      }

      if (!parsedProxy) {
        message.error('Please enter a valid proxy string');
        return;
      }

      const expiresAt = values.expires_at?.valueOf();
      if (!expiresAt || !Number.isFinite(expiresAt)) {
        message.error('Please select expiration date');
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

        proxyResourceUpdateSchema.parse(proxyData);
        await updateProxyMutation.mutateAsync({
          resource: 'proxies',
          id: editingProxy.id,
          values: proxyData,
          invalidates: ['resourceAll'],
        });
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
          provider: providerValue || DEFAULT_PROVIDER,
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

        proxyResourceCreateSchema.parse(proxyData);

        if (proxyStatus === 'banned') {
          message.warning(
            `Warning: High fraud score detected (${ipqsData?.fraud_score}). Proxy marked as banned.`,
          );
        }

        await createProxyMutation.mutateAsync({
          resource: 'proxies',
          values: proxyData,
          invalidates: ['resourceAll'],
        });
        message.success('');
      }

      onSaved();
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'errorFields' in error &&
        Array.isArray((error as { errorFields?: unknown[] }).errorFields)
      ) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to save proxy: ${errorMessage}`);
    }
  };

  return (
    <Modal
      title={editingProxy ? '' : ''}
      open={open}
      onOk={() => {
        void submitForm();
      }}
      onCancel={onClose}
      okText={editingProxy ? 'Update' : 'Create'}
      width={700}
      okButtonProps={{ disabled: !editingProxy && !parsedProxy }}
      confirmLoading={
        createProxyMutation.mutation.isPending || updateProxyMutation.mutation.isPending
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="proxyString"
          label="Proxy String"
          required
          extra="Format: ip:port:login:password"
          rules={[
            { required: true, message: 'Please enter proxy string' },
            {
              validator: async (_rule, value: string | undefined) => {
                if (!value || !String(value).trim()) {
                  throw new Error('Please enter proxy string');
                }
                if (parseProxyString(String(value)) === null) {
                  throw new Error('Invalid proxy format. Use: ip:port:login:password');
                }
              },
            },
          ]}
        >
          <Input.TextArea
            rows={2}
            placeholder="Enter proxy string (ip:port:login:password)"
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

        <Form.Item name="bot_id" label="Assign to Bot">
          <Select
            placeholder="Select bot"
            options={Object.entries(bots).map(([id, bot]) => ({
              value: id,
              label: `${bot.character?.name || 'Unknown'} ${bot.vm?.name ? `(${bot.vm.name})` : ''} - ${id}`,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="expires_at"
          label="Expiration Date"
          rules={[{ required: true, message: 'Please select expiration date' }]}
        >
          <DatePicker style={{ width: '100%' }} showTime={false} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
