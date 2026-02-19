import { WarningOutlined } from '@ant-design/icons';
import { Card, Form, Modal, message, Spin } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  checkIPQuality,
  isAutoCheckEnabled,
  updateProxyWithIPQSData,
} from '../../entities/resources/api/ipqsFacade';
import {
  useCreateProxyMutation,
  useUpdateProxyMutation,
} from '../../entities/resources/api/useProxyMutations';
import { useProxiesQuery } from '../../entities/resources/api/useResourcesQueries';
import type { IPQSResponse, Proxy as ProxyResource } from '../../types';
import { parseProxyString } from '../../utils/proxyUtils';
import type { BotProxyProps, ProxyInfo, ProxyModalFormValues } from './proxy';
import {
  ProxyDetailsCard,
  ProxyEditorModal,
  ProxyEmptyCard,
  ProxyStatusAlert,
  withProxyComputedState,
} from './proxy';
import styles from './proxy/proxy.module.css';

const { confirm } = Modal;

export const BotProxy: React.FC<BotProxyProps> = ({ bot }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm<ProxyModalFormValues>();
  const [proxyInput, setProxyInput] = useState('');
  const [parsedProxy, setParsedProxy] = useState<ReturnType<typeof parseProxyString>>(null);
  const [parseError, setParseError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingIPQS, setCheckingIPQS] = useState(false);
  const [ipqsData, setIpqsData] = useState<IPQSResponse | null>(null);
  const createProxyMutation = useCreateProxyMutation();
  const updateProxyMutation = useUpdateProxyMutation();
  const {
    data: proxies = [],
    isLoading: isProxiesLoading,
    error: proxiesError,
  } = useProxiesQuery();

  const proxy = useMemo<ProxyInfo | null>(() => {
    const foundProxy = proxies.find((item) => item.bot_id === bot.id);
    return foundProxy ? withProxyComputedState(foundProxy) : null;
  }, [proxies, bot.id]);

  useEffect(() => {
    if (!proxiesError) {
      return;
    }

    console.error('Error loading proxy:', proxiesError);
    message.error({ content: 'Failed to load proxy data', key: 'bot-proxy-load-error' });
  }, [proxiesError]);

  const resetModalState = () => {
    setProxyInput('');
    setParsedProxy(null);
    setParseError('');
    setIpqsData(null);
    setShowPassword(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetModalState();
    form.resetFields();
  };

  const checkProxyIPQS = async (ip: string) => {
    setCheckingIPQS(true);
    try {
      const autoCheckEnabled = await isAutoCheckEnabled();
      if (!autoCheckEnabled) {
        console.log('IPQS auto-check is disabled or API key not configured');
        return;
      }

      const data = await checkIPQuality(ip);
      console.log('IPQS Data:', data);
      setIpqsData(data);
    } catch (error) {
      console.error('IPQS check failed:', error);
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
    } else if (value.trim()) {
      setParsedProxy(null);
      setParseError('Invalid proxy format. Use: ip:port:login:password');
    } else {
      setParsedProxy(null);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    resetModalState();
    form.resetFields();
    form.setFieldsValue({
      expires_at: dayjs().add(30, 'days'),
    });
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!proxy) return;

    setIsEditing(true);
    const proxyString = `${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.password}`;
    setProxyInput(proxyString);
    setParsedProxy(parseProxyString(proxyString));
    setParseError('');
    setIpqsData(null);
    form.setFieldsValue({
      expires_at: dayjs(proxy.expires_at),
    });
    setIsModalOpen(true);
  };

  const handleUnassign = () => {
    if (!proxy) return;

    confirm({
      title: '',
      icon: <WarningOutlined style={{ color: '#faad14' }} />,
      content: (
        <div>
          <p>Are you sure you want to unassign this proxy from the bot?</p>
          <p>
            <strong>IP:</strong> {proxy.ip}:{proxy.port}
          </p>
          <p style={{ color: '#8c8c8c', fontSize: '12px' }}>
            The proxy will remain in the database but will no longer be linked to this bot.
          </p>
        </div>
      ),
      okText: 'Unassign',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await updateProxyMutation.mutateAsync({
            id: proxy.id,
            payload: {
              bot_id: null,
              updated_at: Date.now(),
            },
          });
          message.success('');
        } catch (error) {
          console.error('Error unassigning proxy:', error);
          message.error('Failed to unassign proxy');
        }
      },
    });
  };

  const handleSave = async (values: ProxyModalFormValues) => {
    if (!parsedProxy) {
      message.error('Please enter a valid proxy string');
      return;
    }

    try {
      const expiresAt = values.expires_at
        ? values.expires_at.valueOf()
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      let proxyData: Partial<ProxyResource> = {
        ip: parsedProxy.ip,
        port: parsedProxy.port,
        login: parsedProxy.login,
        password: parsedProxy.password,
        type: parsedProxy.type,
        bot_id: bot.id,
        expires_at: expiresAt,
        status: 'active',
        provider: 'Unknown',
        country: 'Unknown',
        updated_at: Date.now(),
      };

      if (ipqsData) {
        proxyData = updateProxyWithIPQSData(proxyData, ipqsData);
      }

      if (isEditing && proxy) {
        await updateProxyMutation.mutateAsync({ id: proxy.id, payload: proxyData });
        message.success('');
      } else {
        proxyData.created_at = Date.now();
        await createProxyMutation.mutateAsync(proxyData as Omit<ProxyResource, 'id'>);
        message.success('');
      }

      closeModal();
    } catch (error) {
      console.error('Error saving proxy:', error);
      message.error('Failed to save proxy');
    }
  };

  if (isProxiesLoading) {
    return (
      <div className={styles['bot-proxy']}>
        <Card className={styles['proxy-card']}>
          <Spin size="large" />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles['bot-proxy']}>
      {proxy ? (
        <>
          <ProxyStatusAlert proxy={proxy} />
          <ProxyDetailsCard proxy={proxy} onEdit={openEditModal} onUnassign={handleUnassign} />
        </>
      ) : (
        <ProxyEmptyCard onAdd={openAddModal} />
      )}

      <ProxyEditorModal
        open={isModalOpen}
        editing={isEditing}
        form={form}
        parsedProxy={parsedProxy}
        proxyInput={proxyInput}
        parseError={parseError}
        showPassword={showPassword}
        checkingIPQS={checkingIPQS}
        ipqsData={ipqsData}
        onCancel={closeModal}
        onSubmit={form.submit}
        onFinish={handleSave}
        onProxyInputChange={handleProxyInputChange}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
      />
    </div>
  );
};
