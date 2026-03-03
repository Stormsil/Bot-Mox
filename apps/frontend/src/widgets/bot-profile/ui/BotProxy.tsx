import { WarningOutlined } from '@ant-design/icons';
import { useModalForm } from '@refinedev/antd';
import { type HttpError, useList, useUpdate } from '@refinedev/core';
import type { FormInstance } from 'antd';
import { App, message } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkIPQuality,
  isAutoCheckEnabled,
  updateProxyWithIPQSData,
} from '../../../entities/resources/api/ipqsFacade';
import type { IPQSResponse, Proxy as ProxyResource } from '../../../entities/resources/model/types';
import { parseProxyString } from '../../../shared/lib/utils/proxyUtils';
import { AppCard as Card, AppSpin as Spin } from '../../../shared/ui';
import type { BotProxyProps, ProxyInfo, ProxyModalFormValues } from './proxy';
import {
  ProxyDetailsCard,
  ProxyEditorModal,
  ProxyEmptyCard,
  ProxyStatusAlert,
  withProxyComputedState,
} from './proxy';
import styles from './proxy/proxy.module.css';

const RESOURCE_REFETCH_INTERVAL_MS = 7_000;
const RESOURCE_LIST_PAGE_SIZE = 5_000;

export const BotProxy: React.FC<BotProxyProps> = ({ bot }) => {
  const { modal } = App.useApp();
  const [proxyInput, setProxyInput] = useState('');
  const [parsedProxy, setParsedProxy] = useState<ReturnType<typeof parseProxyString>>(null);
  const [parseError, setParseError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingIPQS, setCheckingIPQS] = useState(false);
  const [ipqsData, setIpqsData] = useState<IPQSResponse | null>(null);
  const createProxyModal = useModalForm<ProxyResource, HttpError, Omit<ProxyResource, 'id'>>({
    resource: 'proxies',
    action: 'create',
    redirect: false,
    invalidates: ['resourceAll'],
    syncWithLocation: false,
  });
  const editProxyModal = useModalForm<ProxyResource, HttpError, Partial<ProxyResource>>({
    resource: 'proxies',
    action: 'edit',
    redirect: false,
    invalidates: ['resourceAll'],
    syncWithLocation: false,
  });
  const createForm = createProxyModal.form as unknown as FormInstance<ProxyModalFormValues>;
  const editForm = editProxyModal.form as unknown as FormInstance<ProxyModalFormValues>;
  const updateProxyMutation = useUpdate<ProxyResource, HttpError, Partial<ProxyResource>>();
  const proxiesList = useList<ProxyResource>({
    resource: 'proxies',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
    queryOptions: { refetchInterval: RESOURCE_REFETCH_INTERVAL_MS },
  });
  const proxies = proxiesList.result.data || [];
  const isProxiesLoading = proxiesList.query.isLoading;
  const proxiesError = proxiesList.query.error;

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

  const closeCreateModal = () => {
    createProxyModal.close();
    resetModalState();
    createForm.resetFields();
  };

  const closeEditModal = () => {
    editProxyModal.close();
    resetModalState();
    editForm.resetFields();
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
    resetModalState();
    createForm.resetFields();
    createForm.setFieldsValue({
      expires_at: dayjs().add(30, 'days'),
    });
    createProxyModal.show();
  };

  const openEditModal = () => {
    if (!proxy) return;

    const proxyString = `${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.password}`;
    setProxyInput(proxyString);
    setParsedProxy(parseProxyString(proxyString));
    setParseError('');
    setIpqsData(null);
    editForm.setFieldsValue({
      expires_at: dayjs(proxy.expires_at),
    });
    editProxyModal.show(proxy.id);
  };

  const editingProxy = useMemo(() => {
    if (editProxyModal.id === undefined || editProxyModal.id === null) {
      return null;
    }

    const targetId = String(editProxyModal.id);
    return proxies.find((item) => String(item.id) === targetId) ?? null;
  }, [editProxyModal.id, proxies]);

  const handleUnassign = () => {
    if (!proxy) return;

    modal.confirm({
      title: '',
      icon: <WarningOutlined style={{ color: 'var(--botmox-color-status-warning)' }} />,
      content: (
        <div>
          <p>Are you sure you want to unassign this proxy from the bot?</p>
          <p>
            <strong>IP:</strong> {proxy.ip}:{proxy.port}
          </p>
          <p style={{ color: 'var(--botmox-color-text-muted)', fontSize: '12px' }}>
            The proxy will remain in the database but will no longer be linked to this bot.
          </p>
        </div>
      ),
      okText: 'Unassign',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        updateProxyMutation.mutate({
          resource: 'proxies',
          id: proxy.id,
          values: {
            bot_id: null,
            updated_at: Date.now(),
          },
          invalidates: ['resourceAll'],
        });
      },
    });
  };

  const buildProxyPayload = useCallback(
    (values: ProxyModalFormValues, parsed: NonNullable<ReturnType<typeof parseProxyString>>) => {
      const expiresAt = values.expires_at
        ? values.expires_at.valueOf()
        : Date.now() + 30 * 24 * 60 * 60 * 1000;

      let proxyData: Partial<ProxyResource> = {
        ip: parsed.ip,
        port: parsed.port,
        login: parsed.login,
        password: parsed.password,
        type: parsed.type,
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

      return proxyData;
    },
    [bot.id, ipqsData],
  );

  const createProxyFormProps = useMemo(
    () => ({
      ...createProxyModal.formProps,
      onFinish: async (values: ProxyModalFormValues) => {
        if (!parsedProxy) {
          throw new Error('Please enter a valid proxy string');
        }
        const proxyData = buildProxyPayload(values, parsedProxy);
        proxyData.created_at = Date.now();
        return createProxyModal.onFinish(proxyData as Omit<ProxyResource, 'id'>);
      },
    }),
    [buildProxyPayload, createProxyModal.formProps, createProxyModal.onFinish, parsedProxy],
  );

  const editProxyFormProps = useMemo(
    () => ({
      ...editProxyModal.formProps,
      onFinish: async (values: ProxyModalFormValues) => {
        if (!parsedProxy) {
          throw new Error('Please enter a valid proxy string');
        }
        if (!editingProxy) {
          throw new Error('Proxy is not available for editing');
        }

        const proxyData = buildProxyPayload(values, parsedProxy);
        return editProxyModal.onFinish(proxyData);
      },
    }),
    [
      buildProxyPayload,
      editProxyModal.formProps,
      editProxyModal.onFinish,
      editingProxy,
      parsedProxy,
    ],
  );

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
        modalProps={{
          ...createProxyModal.modalProps,
          onCancel: closeCreateModal,
          onOk: () => createForm.submit(),
        }}
        formProps={createProxyFormProps}
        editing={false}
        parsedProxy={parsedProxy}
        proxyInput={proxyInput}
        parseError={parseError}
        showPassword={showPassword}
        checkingIPQS={checkingIPQS}
        ipqsData={ipqsData}
        onProxyInputChange={handleProxyInputChange}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
      />

      <ProxyEditorModal
        modalProps={{
          ...editProxyModal.modalProps,
          onCancel: closeEditModal,
          onOk: () => editForm.submit(),
        }}
        formProps={editProxyFormProps}
        editing
        parsedProxy={parsedProxy}
        proxyInput={proxyInput}
        parseError={parseError}
        showPassword={showPassword}
        checkingIPQS={checkingIPQS}
        ipqsData={ipqsData}
        onProxyInputChange={handleProxyInputChange}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
      />
    </div>
  );
};
