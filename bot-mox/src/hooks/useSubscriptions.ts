import { useState, useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
import type {
  Subscription,
  SubscriptionWithDetails,
  SubscriptionFormData,
  SubscriptionSettings,
  ComputedSubscriptionStatus,
} from '../types';
import {
  subscribeToSubscriptions,
  subscribeToBotSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  enrichSubscriptionsWithDetails,
} from '../services/subscriptionService';
import { fetchBotsList } from '../services/botsApiService';
import {
  getSubscriptionSettings,
  updateSubscriptionSettings,
  getDefaultSettings,
} from '../services/settingsService';

interface UseSubscriptionsOptions {
  botId?: string; // Если указан, загружаем только подписки этого бота
}

interface UseSubscriptionsReturn {
  // Данные
  subscriptions: SubscriptionWithDetails[];
  settings: SubscriptionSettings;
  loading: boolean;
  error: Error | null;

  // Методы
  addSubscription: (data: SubscriptionFormData) => Promise<void>;
  updateSubscription: (id: string, data: Partial<SubscriptionFormData>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  updateSettings: (settings: Partial<SubscriptionSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;

  // Фильтрация
  filterByStatus: (status: ComputedSubscriptionStatus | 'all') => SubscriptionWithDetails[];
  getExpiringSoon: () => SubscriptionWithDetails[];
  getExpired: () => SubscriptionWithDetails[];
  getActive: () => SubscriptionWithDetails[];
}

/**
 * Хук для работы с подписками
 * Автоматически загружает подписки, настройки и вычисляет статусы
 */
export function useSubscriptions(options: UseSubscriptionsOptions = {}): UseSubscriptionsReturn {
  const { botId } = options;

  // Состояния
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<SubscriptionSettings>(getDefaultSettings());
  const [botsMap, setBotsMap] = useState<
    Map<string, { name: string; character?: string; status?: SubscriptionWithDetails['botStatus']; vmName?: string }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Загрузка настроек
  const loadSettings = useCallback(async () => {
    try {
      const loadedSettings = await getSubscriptionSettings();
      setSettings(loadedSettings);
    } catch (err) {
      console.error('Error loading settings:', err);
      // Используем дефолтные настройки при ошибке
      setSettings(getDefaultSettings());
    }
  }, []);

  // Загрузка данных ботов для отображения
  const loadBotsData = useCallback(async () => {
    try {
      const bots = await fetchBotsList();
      const nextBotsMap = new Map<
        string,
        { name: string; character?: string; status?: SubscriptionWithDetails['botStatus']; vmName?: string }
      >();

      bots.forEach((bot) => {
        nextBotsMap.set(bot.id, {
          name: bot.name || bot.id,
          character: bot.character?.name,
          status: bot.status,
          vmName: bot.vm?.name,
        });
      });

      setBotsMap(nextBotsMap);
    } catch (err) {
      console.error('Error loading bots data:', err);
    }
  }, []);

  // Подписка на изменения подписок
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setLoading(true);
      setError(null);
    });

    // Загружаем настройки и данные ботов
    const loadTimer = window.setTimeout(() => {
      void loadSettings();
      void loadBotsData();
    }, 0);

    // Подписываемся на подписки
    const unsubscribe = botId
      ? subscribeToBotSubscriptions(
          botId,
          (subs: Subscription[]) => setSubscriptions(subs),
          (err: Error) => setError(err)
        )
      : subscribeToSubscriptions(
          (subs: Subscription[]) => setSubscriptions(subs),
          (err: Error) => setError(err)
        );

    // Отмечаем загрузку завершенной после небольшой задержки
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 300);

    return () => {
      window.cancelAnimationFrame(frameId);
      clearTimeout(loadTimer);
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [botId, loadSettings, loadBotsData]);

  // Вычисляем расширенные подписки с деталями
  const subscriptionsWithDetails = useMemo(() => {
    return enrichSubscriptionsWithDetails(subscriptions, settings.warning_days, botsMap);
  }, [subscriptions, settings.warning_days, botsMap]);

  // Методы

  /**
   * Добавляет новую подписку
   */
  const addSubscription = useCallback(async (data: SubscriptionFormData) => {
    try {
      // Детальное логирование входных данных
      console.log('Creating subscription with data:', {
        ...data,
        expires_at: data.expires_at,
        expires_at_type: typeof data.expires_at,
      });
      
      await createSubscription(data);
      message.success('Подписка успешно создана');
    } catch (err) {
      // Детальное логирование ошибки
      console.error('Error creating subscription:', err);
      console.error('Error details:', {
        name: (err as Error).name,
        message: (err as Error).message,
        stack: (err as Error).stack,
        data: {
          ...data,
          expires_at: data.expires_at,
        },
      });
      
      // Показываем более информативное сообщение об ошибке
      const errorMessage = (err as Error).message || 'Неизвестная ошибка';
      message.error(`Ошибка при создании подписки: ${errorMessage}`);
      throw err;
    }
  }, []);

  /**
   * Обновляет существующую подписку
   */
  const handleUpdateSubscription = useCallback(async (id: string, data: Partial<SubscriptionFormData>) => {
    try {
      await updateSubscription(id, data);
      message.success('Подписка успешно обновлена');
    } catch (err) {
      console.error('Error updating subscription:', err);
      message.error('Ошибка при обновлении подписки');
      throw err;
    }
  }, []);

  /**
   * Удаляет подписку
   */
  const handleDeleteSubscription = useCallback(async (id: string) => {
    try {
      await deleteSubscription(id);
      message.success('Подписка удалена');
    } catch (err) {
      console.error('Error deleting subscription:', err);
      message.error('Ошибка при удалении подписки');
      throw err;
    }
  }, []);

  /**
   * Обновляет настройки
   */
  const handleUpdateSettings = useCallback(async (newSettings: Partial<SubscriptionSettings>) => {
    try {
      await updateSubscriptionSettings(newSettings);
      setSettings((prev) => ({ ...prev, ...newSettings, updated_at: Date.now() }));
      message.success('Настройки сохранены');
    } catch (err) {
      console.error('Error updating settings:', err);
      message.error('Ошибка при сохранении настроек');
      throw err;
    }
  }, []);

  /**
   * Обновляет настройки из Firebase
   */
  const refreshSettings = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  // Фильтрация

  /**
   * Фильтрует подписки по статусу
   */
  const filterByStatus = useCallback(
    (status: ComputedSubscriptionStatus | 'all') => {
      if (status === 'all') return subscriptionsWithDetails;
      return subscriptionsWithDetails.filter((sub) => sub.computedStatus === status);
    },
    [subscriptionsWithDetails]
  );

  /**
   * Возвращает подписки с истекающим сроком
   */
  const getExpiringSoon = useCallback(() => {
    return subscriptionsWithDetails.filter((sub) => sub.computedStatus === 'expiring_soon');
  }, [subscriptionsWithDetails]);

  /**
   * Возвращает просроченные подписки
   */
  const getExpired = useCallback(() => {
    return subscriptionsWithDetails.filter((sub) => sub.computedStatus === 'expired');
  }, [subscriptionsWithDetails]);

  /**
   * Возвращает активные подписки
   */
  const getActive = useCallback(() => {
    return subscriptionsWithDetails.filter((sub) => sub.computedStatus === 'active');
  }, [subscriptionsWithDetails]);

  return {
    subscriptions: subscriptionsWithDetails,
    settings,
    loading,
    error,
    addSubscription,
    updateSubscription: handleUpdateSubscription,
    deleteSubscription: handleDeleteSubscription,
    updateSettings: handleUpdateSettings,
    refreshSettings,
    filterByStatus,
    getExpiringSoon,
    getExpired,
    getActive,
  };
}
