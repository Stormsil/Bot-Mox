import React, { useEffect, useState } from 'react';
import { Card, Form, Modal, Spin, message } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { IPQSResponse, Proxy } from '../../types';
import { parseProxyString } from '../../utils/proxyUtils';
import {
  checkIPQuality,
  isAutoCheckEnabled,
  updateProxyWithIPQSData,
} from '../../services/ipqsService';
import { createResource, subscribeResources, updateResource } from '../../services/resourcesApiService';
import {
  ProxyDetailsCard,
  ProxyEditorModal,
  ProxyEmptyCard,
  ProxyStatusAlert,
  withProxyComputedState,
} from './proxy';
import type { BotProxyProps, ProxyInfo, ProxyModalFormValues } from './proxy';
import './BotProxy.css';

const { confirm } = Modal;

export const BotProxy: React.FC<BotProxyProps> = ({ bot }) => {
  const [proxy, setProxy] = useState<ProxyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm<ProxyModalFormValues>();
  const [proxyInput, setProxyInput] = useState('');
  const [parsedProxy, setParsedProxy] = useState<ReturnType<typeof parseProxyString>>(null);
  const [parseError, setParseError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingIPQS, setCheckingIPQS] = useState(false);
  const [ipqsData, setIpqsData] = useState<IPQSResponse | null>(null);

  useEffect(() => {
    const unsubscribeProxies = subscribeResources<Proxy>(
      'proxies',
      (proxiesList) => {
        const foundProxy = proxiesList.find((item) => item.bot_id === bot.id);
        if (!foundProxy) {
          setProxy(null);
          setLoading(false);
          return;
        }

        setProxy(withProxyComputedState(foundProxy));
        setLoading(false);
      },
      (error) => {
        console.error('Error loading proxy:', error);
        message.error('Failed to load proxy data');
        setLoading(false);
      },
      { intervalMs: 6000 }
    );

    return () => unsubscribeProxies();
  }, [bot.id]);

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
      title: 'Unassign Proxy?',
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
          await updateResource<Proxy>('proxies', proxy.id, {
            bot_id: null,
            updated_at: Date.now(),
          } as Record<string, unknown>);
          message.success('Proxy unassigned successfully');
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

      let proxyData: Partial<Proxy> = {
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
        await updateResource<Proxy>('proxies', proxy.id, proxyData as Record<string, unknown>);
        message.success('Proxy updated successfully');
      } else {
        proxyData.created_at = Date.now();
        await createResource<Proxy>('proxies', proxyData as Record<string, unknown>);
        message.success('Proxy added successfully');
      }

      closeModal();
    } catch (error) {
      console.error('Error saving proxy:', error);
      message.error('Failed to save proxy');
    }
  };

  if (loading) {
    return (
      <div className="bot-proxy">
        <Card className="proxy-card">
          <Spin size="large" />
        </Card>
      </div>
    );
  }

  return (
    <div className="bot-proxy">
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
