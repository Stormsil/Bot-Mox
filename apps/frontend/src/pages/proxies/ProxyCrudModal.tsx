import {
  proxyResourceCreateSchema,
  proxyResourceUpdateSchema,
  proxyStatusSchema,
  proxyTypeSchema,
} from '@botmox/api-contract';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Modal, message } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import {
  checkIPQuality,
  isAutoCheckEnabled,
  isProxySuspicious,
} from '../../entities/resources/api/ipqsFacade';
import {
  useCreateProxyMutation,
  useUpdateProxyMutation,
} from '../../entities/resources/api/useProxyMutations';
import type { IPQSResponse, Proxy as ProxyResource } from '../../entities/resources/model/types';
import { RHFDatePicker, RHFSelect, RHFTextArea } from '../../shared/ui/form';
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

const proxyCrudFormSchema = z.object({
  proxyString: z
    .string()
    .trim()
    .min(1, 'Please enter proxy string')
    .refine((value) => parseProxyString(value) !== null, {
      message: 'Invalid proxy format. Use: ip:port:login:password',
    }),
  bot_id: z.string().trim().min(1, 'Please select a bot'),
  expires_at: z.coerce.number().int().positive('Please select expiration date'),
  provider: z.string().trim().min(1).default('IPRoyal'),
  country: z.string().trim().optional(),
  country_code: z.string().trim().optional(),
  status: proxyStatusSchema.default('active'),
  type: proxyTypeSchema.default('socks5'),
  fraud_score: z.coerce.number().finite().default(0),
});

type ProxyCrudFormValues = z.input<typeof proxyCrudFormSchema>;

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
    status: 'active',
    type: 'socks5',
    fraud_score: 0,
    expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
    country: undefined,
    country_code: undefined,
  };
}

function getEditDefaults(editingProxy: ProxyWithBot): ProxyCrudFormValues {
  return {
    proxyString: `${editingProxy.ip}:${editingProxy.port}:${editingProxy.login}:${editingProxy.password}`,
    bot_id: editingProxy.bot_id ?? '',
    provider: editingProxy.provider || DEFAULT_PROVIDER,
    status: editingProxy.status || 'active',
    type: editingProxy.type || 'socks5',
    fraud_score: editingProxy.fraud_score ?? 0,
    expires_at: editingProxy.expires_at,
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
  const createProxyMutation = useCreateProxyMutation();
  const updateProxyMutation = useUpdateProxyMutation();
  const [checkingIPQS, setCheckingIPQS] = useState(false);
  const [ipqsData, setIpqsData] = useState<IPQSResponse | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, reset, formState } = useForm<ProxyCrudFormValues>({
    resolver: zodResolver(proxyCrudFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: getCreateDefaults(),
  });

  const proxyInput = useWatch({ control, name: 'proxyString' }) ?? '';
  const parsedProxy = useMemo(() => parseProxyString(proxyInput), [proxyInput]);

  useEffect(() => {
    if (!open) return;

    setIpqsData(null);
    setCheckingIPQS(false);
    setShowPassword(false);
    reset(editingProxy ? getEditDefaults(editingProxy) : getCreateDefaults());
  }, [editingProxy, open, reset]);

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

  const submitForm = handleSubmit(async (values) => {
    try {
      const providerValue = getProviderValue(values.provider);
      if (providerValue && !providers.includes(providerValue)) {
        onProviderCreated(providerValue);
      }

      if (!parsedProxy) {
        message.error('Please enter a valid proxy string');
        return;
      }

      const expiresAt = values.expires_at;

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

        await createProxyMutation.mutateAsync(proxyData);
        message.success('');
      }

      onSaved();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to save proxy: ${errorMessage}`);
    }
  });

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
        formState.isSubmitting || createProxyMutation.isPending || updateProxyMutation.isPending
      }
    >
      <Form layout="vertical">
        <RHFTextArea<ProxyCrudFormValues, 'proxyString'>
          control={control}
          name="proxyString"
          label="Proxy String"
          rows={2}
          placeholder="Enter proxy string (ip:port:login:password)"
          style={{ fontFamily: 'monospace' }}
          formItemProps={{ required: true, extra: 'Format: ip:port:login:password' }}
        />

        {parsedProxy && (
          <ParsedProxyAlert
            parsedProxy={parsedProxy}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((prev) => !prev)}
          />
        )}

        {!editingProxy && checkingIPQS && <ProxyIpqsLoadingAlert />}

        {!editingProxy && ipqsData && <ProxyIpqsResultAlert ipqsData={ipqsData} />}

        <RHFSelect<ProxyCrudFormValues, 'bot_id'>
          control={control}
          name="bot_id"
          label="Assign to Bot"
          placeholder="Select bot"
          options={Object.entries(bots).map(([id, bot]) => ({
            value: id,
            label: `${bot.character?.name || 'Unknown'} ${bot.vm?.name ? `(${bot.vm.name})` : ''} - ${id}`,
          }))}
        />

        <RHFDatePicker<ProxyCrudFormValues, 'expires_at', number>
          control={control}
          name="expires_at"
          label="Expiration Date"
          style={{ width: '100%' }}
          toFormValue={(date) => (date ? date.valueOf() : Date.now())}
        />
      </Form>
    </Modal>
  );
};
