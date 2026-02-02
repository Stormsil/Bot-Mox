import React, { useState, useEffect } from 'react';
import { Table, Card, Input, Select, Button, Tag, Space, Typography, Tooltip, Badge, Modal, Form, Progress, message, DatePicker, Spin, Alert } from 'antd';
import { SearchOutlined, ReloadOutlined, GlobalOutlined, LinkOutlined, DeleteOutlined, EditOutlined, PlusOutlined, CopyOutlined, WarningOutlined, CheckCircleOutlined, SafetyOutlined, EyeOutlined, EyeInvisibleOutlined, SyncOutlined, RobotOutlined } from '@ant-design/icons';
import { ref, onValue, update, remove, push, set, get } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { Proxy, IPQSResponse } from '../../types';
import {
  parseProxyString,
  getCountryFlag,
  formatProxyString,
  isValidIP,
  isValidPort
} from '../../utils/proxyUtils';
import {
  checkIPQuality,
  isAutoCheckEnabled,
  isProxySuspicious,
  isIPQSCheckEnabled,
  updateProxyWithIPQSData,
  getFraudScoreColor,
  getFraudScoreLabel
} from '../../services/ipqsService';
import dayjs from 'dayjs';
import './ProxiesPage.css';

// Дефолтные провайдеры
const DEFAULT_PROVIDERS = ['IPRoyal', 'Smartproxy', 'Luminati', 'Oxylabs'];

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;
const { TextArea } = Input;

interface ProxyWithBot extends Proxy {
  botName?: string;
  botCharacter?: string;
  botVMName?: string;
}

export const ProxiesPage: React.FC = () => {
  const [proxies, setProxies] = useState<ProxyWithBot[]>([]);
  const [bots, setBots] = useState<Record<string, {
    character?: { name: string };
    person?: { name: string; vm_name?: string };
    vm?: { name: string };
    name?: string;
  }>>({});
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyWithBot | null>(null);
  const [form] = Form.useForm();
  
  // Новые состояния для парсинга и проверки
  const [proxyInput, setProxyInput] = useState('');
  const [parsedProxy, setParsedProxy] = useState<ReturnType<typeof parseProxyString>>(null);
  const [checkingIPQS, setCheckingIPQS] = useState(false);
  const [ipqsData, setIpqsData] = useState<IPQSResponse | null>(null);
  const [parseError, setParseError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingProxyId, setCheckingProxyId] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>(DEFAULT_PROVIDERS);

  // Загрузка данных из Firebase
  useEffect(() => {
    const proxiesRef = ref(database, 'proxies');
    const botsRef = ref(database, 'bots');

    const unsubscribeProxies = onValue(proxiesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const proxiesList = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<Proxy, 'id'>),
        })) as ProxyWithBot[];
        setProxies(proxiesList);
      } else {
        setProxies([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading proxies:', error);
      message.error('Failed to load proxies');
      setLoading(false);
    });

    const unsubscribeBots = onValue(botsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBots(data);
      }
    });

    return () => {
      unsubscribeProxies();
      unsubscribeBots();
    };
  }, []);

  // Загрузка списка провайдеров из существующих прокси
  useEffect(() => {
    const providersRef = ref(database, 'reference_data/proxy_providers');

    const unsubscribeProviders = onValue(providersRef, (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data) && data.length > 0) {
        setProviders(data);
      }
      // Не инициализируем дефолтными значениями - используем только то, что есть в базе
    }, (error) => {
      console.error('Error loading providers:', error);
    });

    return () => {
      unsubscribeProviders();
    };
  }, []);

  // Обновление списка провайдеров на основе существующих прокси
  useEffect(() => {
    if (proxies.length > 0) {
      const existingProviders = [...new Set(proxies.map(p => p.provider).filter(Boolean))];
      if (existingProviders.length > 0) {
        setProviders(existingProviders);
      }
    }
  }, [proxies]);

  // Обработка ввода прокси-строки
  const handleProxyInputChange = (value: string) => {
    setProxyInput(value);
    setParseError('');
    setIpqsData(null);
    
    const parsed = parseProxyString(value);
    if (parsed) {
      setParsedProxy(parsed);
      // Автоматически проверяем через IPQS
      checkProxyIPQS(parsed.ip);
    } else if (value.trim()) {
      setParsedProxy(null);
      setParseError('Invalid proxy format. Use: ip:port:login:password');
    } else {
      setParsedProxy(null);
    }
  };

  // Проверка через IPQS
  const checkProxyIPQS = async (ip: string) => {
    setCheckingIPQS(true);
    try {
      // Проверяем, включена ли автопроверка
      const autoCheckEnabled = await isAutoCheckEnabled();
      if (!autoCheckEnabled) {
        console.log('IPQS auto-check is disabled or API key not configured');
        return;
      }

      const data = await checkIPQuality(ip);
      setIpqsData(data);
    } catch (error) {
      console.error('IPQS check failed:', error);
    } finally {
      setCheckingIPQS(false);
    }
  };

  // Обновление имен ботов в прокси
  useEffect(() => {
    if (Object.keys(bots).length > 0 && proxies.length > 0) {
      const updatedProxies = proxies.map(proxy => {
        if (proxy.bot_id && bots[proxy.bot_id]) {
          const bot = bots[proxy.bot_id] as any;
          // Используем имя персонажа из character.name
          const characterName = bot.character?.name;
          // Используем имя VM из vm.name
          const vmName = bot.vm?.name;
          return {
            ...proxy,
            botName: characterName,
            botCharacter: characterName,
            botVMName: vmName,
          };
        }
        return {
          ...proxy,
          botName: undefined,
          botCharacter: undefined,
          botVMName: undefined,
        };
      });
      setProxies(updatedProxies);
    }
  }, [bots]);

  // Фильтрация прокси
  const filteredProxies = proxies.filter(proxy => {
    const matchesSearch = 
      proxy.ip.toLowerCase().includes(searchText.toLowerCase()) ||
      proxy.provider.toLowerCase().includes(searchText.toLowerCase()) ||
      (proxy.botName?.toLowerCase().includes(searchText.toLowerCase()) ?? false) ||
      proxy.country.toLowerCase().includes(searchText.toLowerCase()) ||
      (proxy.isp?.toLowerCase().includes(searchText.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === 'all' || proxy.status === statusFilter;
    const matchesType = typeFilter === 'all' || proxy.type === typeFilter;
    const matchesCountry = countryFilter === 'all' || proxy.country === countryFilter;
    
    return matchesSearch && matchesStatus && matchesType && matchesCountry;
  });

  // Проверка истечения срока
  const isExpired = (expiresAt: number) => {
    return Date.now() > expiresAt;
  };

  const isExpiringSoon = (expiresAt: number) => {
    const daysUntilExpiry = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  // Удаление прокси
  const handleDelete = (proxy: ProxyWithBot) => {
    confirm({
      title: 'Delete Proxy?',
      content: `Are you sure you want to delete proxy ${proxy.ip}:${proxy.port}?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await remove(ref(database, `proxies/${proxy.id}`));
          message.success('Proxy deleted');
        } catch (error) {
          console.error('Error deleting proxy:', error);
          message.error('Failed to delete proxy');
        }
      },
    });
  };

  // Функция для сохранения нового провайдера в Firebase
  const saveNewProvider = async (providerName: string) => {
    if (!providerName || providers.includes(providerName)) {
      return;
    }

    try {
      const updatedProviders = [...providers, providerName];
      await set(ref(database, 'reference_data/proxy_providers'), updatedProviders);
      setProviders(updatedProviders);
      console.log(`Added new provider: ${providerName}`);
    } catch (error) {
      console.error('Error saving new provider:', error);
    }
  };

  // Функция для получения строкового значения провайдера из массива
  const getProviderValue = (providerValue: string | string[] | undefined | null): string => {
    if (Array.isArray(providerValue)) {
      return providerValue[0] || 'IPRoyal';
    }
    if (typeof providerValue === 'string' && providerValue.trim() !== '') {
      return providerValue;
    }
    return 'IPRoyal';
  };

  // Безопасное получение timestamp из значения даты
  const getTimestamp = (value: any): number => {
    if (value && typeof value.valueOf === 'function') {
      return value.valueOf();
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).getTime();
    }
    return Date.now();
  };

  // Создание/редактирование прокси
  const handleSave = async (values: any) => {
    try {
      console.log('=== handleSave called ===');
      console.log('values:', values);
      console.log('values.provider:', values.provider, 'type:', typeof values.provider);
      console.log('values.expires_at:', values.expires_at, 'type:', typeof values.expires_at);
      console.log('editingProxy:', editingProxy ? 'yes' : 'no');

      let proxyData: Partial<Proxy>;

      // Обрабатываем provider (может быть массивом из mode="tags")
      const providerValue = getProviderValue(values.provider);
      console.log('providerValue:', providerValue);

      // Автоматически сохраняем нового провайдера
      if (providerValue && !providers.includes(providerValue)) {
        console.log('Saving new provider:', providerValue);
        await saveNewProvider(providerValue);
      }

      // Безопасно получаем timestamp
      const expiresAt = getTimestamp(values.expires_at);
      console.log('expiresAt:', expiresAt);

      if (editingProxy) {
        // Режим редактирования
        console.log('Editing mode - building proxyData');

        // Определяем значение fraud_score - используем spread только если значение определено
        const fraudScoreValue = values.fraud_score !== undefined ? values.fraud_score : editingProxy.fraud_score;

        proxyData = {
          ip: values.ip,
          port: parseInt(values.port),
          login: values.login,
          password: values.password,
          provider: providerValue,
          country: values.country || editingProxy.country || '',
          country_code: values.country_code || editingProxy.country_code || '',
          type: values.type,
          status: values.status,
          bot_id: values.bot_id || null,
          // fraud_score только если значение определено (не undefined)
          ...(fraudScoreValue !== undefined && { fraud_score: fraudScoreValue }),
          vpn: values.vpn !== undefined ? values.vpn : editingProxy.vpn || false,
          proxy: values.proxy !== undefined ? values.proxy : editingProxy.proxy || false,
          tor: values.tor !== undefined ? values.tor : editingProxy.tor || false,
          bot_status: values.bot_status !== undefined ? values.bot_status : editingProxy.bot_status || false,
          isp: values.isp || editingProxy.isp || '',
          organization: values.organization || editingProxy.organization || '',
          city: values.city || editingProxy.city || '',
          region: values.region || editingProxy.region || '',
          zip_code: values.zip_code || editingProxy.zip_code || '',
          timezone: values.timezone || editingProxy.timezone || '',
          expires_at: expiresAt,
          updated_at: Date.now(),
        };
        console.log('proxyData for update:', proxyData);
        await update(ref(database, `proxies/${editingProxy.id}`), proxyData);
        message.success('Proxy updated');
      } else {
        // Режим создания из парсеной строки
        if (!parsedProxy) {
          message.error('Please enter a valid proxy string');
          return;
        }

        console.log('Creating mode - building proxyData');
        // Определяем, была ли проверка через IPQS
        const hasIPQSData = ipqsData && ipqsData.fraud_score !== undefined;
        
        // Проверяем, является ли прокси подозрительным (если есть данные IPQS)
        let proxyStatus: 'active' | 'banned' = 'active';
        if (hasIPQSData && ipqsData) {
          const isSuspicious = await isProxySuspicious(ipqsData.fraud_score);
          if (isSuspicious) {
            proxyStatus = 'banned';
          }
        }
        
        proxyData = {
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
          // fraud_score только если была проверка через IPQS
          ...(hasIPQSData && { fraud_score: ipqsData.fraud_score }),
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
          // last_checked только если была проверка через IPQS
          ...(hasIPQSData && { last_checked: Date.now() }),
        };
        console.log('proxyData for create:', proxyData);
        
        // Показываем предупреждение если прокси подозрительный
        if (proxyStatus === 'banned') {
          message.warning(`Warning: High fraud score detected (${ipqsData?.fraud_score}). Proxy marked as banned.`);
        }
        const newRef = push(ref(database, 'proxies'));
        await set(newRef, proxyData);
        message.success('Proxy created successfully');
      }

      setIsModalOpen(false);
      setEditingProxy(null);
      setProxyInput('');
      setParsedProxy(null);
      setIpqsData(null);
      form.resetFields();
    } catch (error) {
      console.error('=== Error saving proxy ===');
      console.error('Error object:', error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('Values at time of error:', values);
      message.error(`Failed to save proxy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Копирование прокси строки
  const copyProxyString = (proxy: Proxy, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    const proxyString = `${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.password}`;
    navigator.clipboard.writeText(proxyString);
    message.success('Proxy string copied to clipboard');
  };

  // Копирование отдельного поля
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} copied to clipboard`);
  };

  // Функция повторной проверки прокси через IPQS
  const handleRecheckIPQS = async (proxy: ProxyWithBot) => {
    setCheckingProxyId(proxy.id);
    try {
      // Проверяем, включена ли проверка IPQS
      const isEnabled = await isIPQSCheckEnabled();
      if (!isEnabled) {
        message.warning('IPQS check is disabled or API key not configured. Please check settings.');
        return;
      }

      const data = await checkIPQuality(proxy.ip);
      
      if (data) {
        // Проверяем, является ли прокси подозрительным
        const suspicious = await isProxySuspicious(data.fraud_score);
        
        // Обновляем прокси в Firebase с новыми данными
        const proxyRef = ref(database, `proxies/${proxy.id}`);
        const updates = updateProxyWithIPQSData(proxy, data);
        
        // Если fraud_score превышает threshold, показываем предупреждение
        if (suspicious) {
          updates.status = 'banned';
        }
        
        await update(proxyRef, updates);
        
        const statusMessage = suspicious 
          ? ` - WARNING: High fraud score! Proxy marked as banned.` 
          : '';
        message.success(`Proxy checked! Fraud Score: ${data.fraud_score}${statusMessage}`);
      } else {
        message.error('Failed to check proxy with IPQS');
      }
    } catch (error) {
      console.error('Error rechecking proxy:', error);
      message.error('Failed to recheck proxy');
    } finally {
      setCheckingProxyId(null);
    }
  };

  const openEditModal = (proxy?: ProxyWithBot) => {
    if (proxy) {
      setEditingProxy(proxy);
      setProxyInput('');
      setParsedProxy(null);
      setIpqsData(null);
      form.setFieldsValue({
        ip: proxy.ip,
        port: proxy.port,
        login: proxy.login,
        password: proxy.password,
        provider: proxy.provider,
        country: proxy.country,
        country_code: proxy.country_code,
        type: proxy.type,
        status: proxy.status,
        bot_id: proxy.bot_id,
        fraud_score: proxy.fraud_score,
        vpn: proxy.vpn,
        proxy: proxy.proxy,
        tor: proxy.tor,
        bot_status: proxy.bot_status,
        isp: proxy.isp,
        organization: proxy.organization,
        city: proxy.city,
        region: proxy.region,
        zip_code: proxy.zip_code,
        timezone: proxy.timezone,
        expires_at: dayjs(proxy.expires_at),
      });
    } else {
      setEditingProxy(null);
      setProxyInput('');
      setParsedProxy(null);
      setIpqsData(null);
      form.resetFields();
      form.setFieldsValue({
        status: 'active',
        type: 'socks5',
        fraud_score: 0,
        provider: 'IPRoyal',
        expires_at: dayjs().add(30, 'days'),
      });
    }
    setIsModalOpen(true);
  };

  // Колонки таблицы
  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 85,
      render: (status: string, record: Proxy) => {
        let color = 'default';
        let text = status;

        if (isExpired(record.expires_at)) {
          color = 'error';
          text = 'EXPIRED';
        } else if (isExpiringSoon(record.expires_at)) {
          color = 'warning';
        } else if (status === 'active') {
          color = 'success';
        } else if (status === 'banned') {
          color = 'red';
        }

        return (
          <Tag color={color}>
            {text.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Proxy',
      key: 'proxy',
      render: (_: any, record: Proxy) => (
        <Space direction="vertical" size={2}>
          <Tooltip title="Click to copy proxy string">
            <Button
              type="text"
              size="small"
              className="proxy-copy-btn"
              onClick={(e) => copyProxyString(record, e)}
              icon={<CopyOutlined />}
            >
              <Text strong>
                {record.ip}:{record.port}
              </Text>
            </Button>
          </Tooltip>
          <Text type="secondary" className="proxy-credentials">
            {record.login}:{record.password}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: any, record: Proxy) => {
        // Используем country_code если есть, иначе country
        let countryCode = (record.country_code || record.country || '').toString().trim().toUpperCase();
        
        return (
          <Space direction="vertical" size={0}>
            <Space size={4}>
              <span className="proxy-country-flag">{getCountryFlag(countryCode)}</span>
              <Text strong>{countryCode}</Text>
            </Space>
            <Space size={4}>
              {record.vpn && <Tag color="orange" style={{ fontSize: 9, margin: 0 }}>VPN</Tag>}
              {record.proxy && <Tag color="blue" style={{ fontSize: 9, margin: 0 }}>PROXY</Tag>}
              {record.tor && <Tag color="red" style={{ fontSize: 9, margin: 0 }}>TOR</Tag>}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Fraud Score',
      dataIndex: 'fraud_score',
      key: 'fraud_score',
      width: 110,
      render: (score: number | undefined, record: Proxy) => {
        // Проверяем, была ли проверка через IPQS (проверяем наличие last_checked в данных)
        // Если last_checked отсутствует или 0 - значит не проверялось
        const hasBeenChecked = record.last_checked && record.last_checked > 0;
        const actualScore = typeof score === 'number' ? score : 0;

        if (!hasBeenChecked) {
          return (
            <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
              Unknown
            </Tag>
          );
        }

        return (
          <Space direction="vertical" size={2} style={{ width: '100%', alignItems: 'center' }}>
            <div className="fraud-score-cell">
              <Progress
                percent={actualScore}
                size="small"
                strokeColor={getFraudScoreColor(actualScore)}
                trailColor="var(--proxmox-bg-tertiary)"
                format={(percent) => (
                  <span style={{ 
                    color: getFraudScoreColor(actualScore), 
                    fontSize: 11,
                    fontWeight: 600 
                  }}>
                    {percent}
                  </span>
                )}
              />
            </div>
            <Space size={4}>
              {record.vpn && <Tag color="orange" style={{ fontSize: 9, margin: 0 }}>VPN</Tag>}
              {record.proxy && <Tag color="blue" style={{ fontSize: 9, margin: 0 }}>PROXY</Tag>}
              {record.tor && <Tag color="red" style={{ fontSize: 9, margin: 0 }}>TOR</Tag>}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Bot',
      key: 'bot',
      width: 280,
      render: (_: any, record: ProxyWithBot) => {
        if (!record.bot_id) {
          return (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Unassigned
            </Text>
          );
        }

        return (
          <Space direction="vertical" size={0} style={{ alignItems: 'flex-start' }}>
            <Text style={{ fontSize: '12px', fontWeight: 500 }}>
              <RobotOutlined style={{ marginRight: 4, color: 'var(--proxmox-accent)' }} />
              {record.bot_id}
            </Text>
            {(record.botCharacter || record.botName) && (
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {record.botCharacter || record.botName}
                {record.botVMName && ` (${record.botVMName})`}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 100,
      render: (expiresAt: number) => {
        const expired = isExpired(expiresAt);
        const expiringSoon = isExpiringSoon(expiresAt);

        return (
          <Text style={{
            color: expired ? '#ff4d4f' : expiringSoon ? '#faad14' : undefined,
            fontSize: 12,
            lineHeight: 1.4
          }}>
            {dayjs(expiresAt).format('DD.MM.YYYY')}
          </Text>
        );
      },
    },
    {
      title: 'Days Left',
      key: 'days_left',
      width: 60,
      render: (_: any, record: Proxy) => {
        const expired = isExpired(record.expires_at);
        const expiringSoon = isExpiringSoon(record.expires_at);
        const daysLeft = Math.ceil((record.expires_at - Date.now()) / (1000 * 60 * 60 * 24));

        return (
          <Text style={{
            color: expired ? '#ff4d4f' : expiringSoon ? '#faad14' : '#52c41a',
            fontSize: 13,
            fontWeight: 600
          }}>
            {expired ? '0' : daysLeft}
          </Text>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_: any, record: ProxyWithBot) => (
        <Space size="small">
          <Tooltip title="Recheck IPQS">
            <Button
              type="text"
              size="small"
              icon={<SyncOutlined spin={checkingProxyId === record.id} />}
              onClick={() => handleRecheckIPQS(record)}
              disabled={checkingProxyId === record.id}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Copy Proxy String">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyProxyString(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Статистика
  const stats = {
    total: proxies.length,
    active: proxies.filter(p => p.status === 'active' && !isExpired(p.expires_at)).length,
    expired: proxies.filter(p => isExpired(p.expires_at)).length,
    expiringSoon: proxies.filter(p => isExpiringSoon(p.expires_at)).length,
    unassigned: proxies.filter(p => !p.bot_id).length,
  };

  // Уникальные страны для фильтра
  const countries = [...new Set(proxies.map(p => p.country).filter(Boolean))];

  return (
    <div className="proxies-page">
      <Card className="proxies-header">
        <div className="header-content">
          <div className="header-title">
            <Title level={4}>
              <GlobalOutlined /> Proxies
            </Title>
            <Text type="secondary">Manage proxy servers for bots</Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openEditModal()}
          >
            Add Proxy
          </Button>
        </div>
      </Card>

      <div className="proxies-stats">
        <Card className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </Card>
        <Card className="stat-card active">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Active</div>
        </Card>
        <Card className="stat-card expired">
          <div className="stat-value">{stats.expired}</div>
          <div className="stat-label">Expired</div>
        </Card>
        <Card className="stat-card warning">
          <div className="stat-value">{stats.expiringSoon}</div>
          <div className="stat-label">Expiring Soon</div>
        </Card>
        <Card className="stat-card">
          <div className="stat-value">{stats.unassigned}</div>
          <div className="stat-label">Unassigned</div>
        </Card>
      </div>

      <Card className="proxies-filters">
        <Space wrap>
          <Input
            placeholder="Search by IP, provider, country, ISP..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 320 }}
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
          >
            <Option value="all">All Statuses</Option>
            <Option value="active">Active</Option>
            <Option value="expired">Expired</Option>
            <Option value="banned">Banned</Option>
          </Select>
          <Select
            placeholder="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 100 }}
          >
            <Option value="all">All Types</Option>
            <Option value="http">HTTP</Option>
            <Option value="socks5">SOCKS5</Option>
          </Select>
          <Select
            placeholder="Country"
            value={countryFilter}
            onChange={setCountryFilter}
            style={{ width: 120 }}
          >
            <Option value="all">All Countries</Option>
            {countries.map(country => (
              <Option key={country} value={country}>{country}</Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => {
            setSearchText('');
            setStatusFilter('all');
            setTypeFilter('all');
            setCountryFilter('all');
          }}>
            Reset
          </Button>
        </Space>
      </Card>

      <Card className="proxies-table-card">
        <Table
          dataSource={filteredProxies}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} proxies`,
          }}
          size="small"
        />
      </Card>

      <Modal
        title={editingProxy ? 'Edit Proxy' : 'Add Proxy'}
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingProxy(null);
          setProxyInput('');
          setParsedProxy(null);
          setIpqsData(null);
          form.resetFields();
        }}
        okText={editingProxy ? 'Update' : 'Create'}
        width={700}
        okButtonProps={{ disabled: !editingProxy && !parsedProxy }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          {!editingProxy ? (
            // Режим добавления - ввод строки прокси
            <>
              <Form.Item
                label="Proxy String"
                required
                validateStatus={parseError ? 'error' : parsedProxy ? 'success' : ''}
                help={parseError || (parsedProxy ? 'Valid proxy format detected' : 'Format: ip:port:login:password')}
              >
                <TextArea
                  placeholder="Enter proxy string (ip:port:login:password)"
                  value={proxyInput}
                  onChange={(e) => handleProxyInputChange(e.target.value)}
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
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </Button>
                  }
                />
              )}

              {checkingIPQS && (
                <Alert
                  message="Checking IP Quality..."
                  description={<Spin size="small" />}
                  type="info"
                  style={{ marginBottom: 16 }}
                />
              )}

              {ipqsData && (
                <Alert
                  message={`IP Quality Check - Score: ${ipqsData.fraud_score}`}
                  description={
                    <Space direction="vertical" size={4}>
                      <Space>
                        <span style={{ fontSize: '20px' }}>{getCountryFlag(ipqsData.country_code)}</span>
                        <Text><strong>Country:</strong> {ipqsData.country_code}</Text>
                      </Space>
                      <Text><strong>City:</strong> {ipqsData.city}, {ipqsData.region}</Text>
                      <Text><strong>ISP:</strong> {ipqsData.isp}</Text>
                      <Text><strong>Organization:</strong> {ipqsData.organization}</Text>
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

            </>
          ) : (
            // Режим редактирования - отдельные поля
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <Form.Item
                  name="ip"
                  label="IP Address"
                  rules={[{ required: true, message: 'Please enter IP address' }]}
                >
                  <Input placeholder="192.168.1.1" />
                </Form.Item>

                <Form.Item
                  name="port"
                  label="Port"
                  rules={[{ required: true, message: 'Please enter port' }]}
                >
                  <Input type="number" placeholder="8080" />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Form.Item
                  name="login"
                  label="Login"
                  rules={[{ required: true, message: 'Please enter login' }]}
                >
                  <Input placeholder="username" />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Password"
                  rules={[{ required: true, message: 'Please enter password' }]}
                >
                  <Input.Password placeholder="password" />
                </Form.Item>
              </div>

              <Form.Item
                name="country"
                label="Country"
                rules={[{ required: true, message: 'Please enter country' }]}
              >
                <Input placeholder="e.g., US, TR, UA" />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Form.Item
                  name="status"
                  label="Status"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Option value="active">Active</Option>
                    <Option value="banned">Banned</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="fraud_score"
                  label="Fraud Score"
                >
                  <Input type="number" min={0} max={100} placeholder="0-100" />
                </Form.Item>
              </div>
            </>
          )}

          <Form.Item
            name="bot_id"
            label="Assign to Bot"
            rules={[{ required: true, message: 'Please select a bot' }]}
          >
            <Select placeholder="Select bot">
              {Object.entries(bots).map(([id, bot]: [string, any]) => (
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
    </div>
  );
};
