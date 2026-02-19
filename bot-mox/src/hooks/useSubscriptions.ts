import { message } from 'antd';
import { useCallback, useMemo } from 'react';
import { useBotsListQuery } from '../entities/bot/api/useBotQueries';
import { enrichSubscriptionsWithDetails } from '../entities/resources/api/subscriptionFacade';
import { useSubscriptionsQuery } from '../entities/resources/api/useResourcesQueries';
import {
  useCreateSubscriptionMutation,
  useDeleteSubscriptionMutation,
  useUpdateSubscriptionMutation,
} from '../entities/resources/api/useSubscriptionMutations';
import { getDefaultSettings } from '../entities/settings/api/settingsFacade';
import { useUpdateSubscriptionSettingsMutation } from '../entities/settings/api/useSubscriptionSettingsMutation';
import { useSubscriptionSettingsQuery } from '../entities/settings/api/useSubscriptionSettingsQuery';
import { uiLogger } from '../observability/uiLogger';
import type {
  ComputedSubscriptionStatus,
  SubscriptionFormData,
  SubscriptionSettings,
  SubscriptionWithDetails,
} from '../types';

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
  const subscriptionsQuery = useSubscriptionsQuery();
  const settingsQuery = useSubscriptionSettingsQuery();
  const botsQuery = useBotsListQuery();
  const createSubscriptionMutation = useCreateSubscriptionMutation();
  const updateSubscriptionMutation = useUpdateSubscriptionMutation();
  const deleteSubscriptionMutation = useDeleteSubscriptionMutation();
  const updateSettingsMutation = useUpdateSubscriptionSettingsMutation();

  const subscriptions = useMemo(
    () =>
      botId
        ? (subscriptionsQuery.data || []).filter((subscription) => subscription.bot_id === botId)
        : subscriptionsQuery.data || [],
    [botId, subscriptionsQuery.data],
  );

  const settings = useMemo<SubscriptionSettings>(
    () => settingsQuery.data || getDefaultSettings(),
    [settingsQuery.data],
  );

  const botsMap = useMemo<
    Map<
      string,
      {
        name: string;
        character?: string;
        status?: SubscriptionWithDetails['botStatus'];
        vmName?: string;
      }
    >
  >(() => {
    const nextBotsMap = new Map<
      string,
      {
        name: string;
        character?: string;
        status?: SubscriptionWithDetails['botStatus'];
        vmName?: string;
      }
    >();

    (botsQuery.data || []).forEach((bot) => {
      nextBotsMap.set(bot.id, {
        name: bot.name || bot.id,
        character: bot.character?.name,
        status: bot.status,
        vmName: bot.vm?.name,
      });
    });

    return nextBotsMap;
  }, [botsQuery.data]);

  const loading = subscriptionsQuery.isLoading || settingsQuery.isLoading || botsQuery.isLoading;
  const error = (subscriptionsQuery.error ||
    settingsQuery.error ||
    botsQuery.error ||
    null) as Error | null;

  // Вычисляем расширенные подписки с деталями
  const subscriptionsWithDetails = useMemo(() => {
    return enrichSubscriptionsWithDetails(subscriptions, settings.warning_days, botsMap);
  }, [subscriptions, settings.warning_days, botsMap]);

  // Методы

  /**
   * Добавляет новую подписку
   */
  const addSubscription = useCallback(
    async (data: SubscriptionFormData) => {
      try {
        // Детальное логирование входных данных
        uiLogger.info('Creating subscription with data:', {
          ...data,
          expires_at: data.expires_at,
          expires_at_type: typeof data.expires_at,
        });

        await createSubscriptionMutation.mutateAsync(data);
        message.success('Подписка успешно создана');
      } catch (err) {
        // Детальное логирование ошибки
        uiLogger.error('Error creating subscription:', err);
        uiLogger.error('Error details:', {
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
    },
    [createSubscriptionMutation],
  );

  /**
   * Обновляет существующую подписку
   */
  const handleUpdateSubscription = useCallback(
    async (id: string, data: Partial<SubscriptionFormData>) => {
      try {
        await updateSubscriptionMutation.mutateAsync({ id, payload: data });
        message.success('Подписка успешно обновлена');
      } catch (err) {
        uiLogger.error('Error updating subscription:', err);
        message.error('Ошибка при обновлении подписки');
        throw err;
      }
    },
    [updateSubscriptionMutation],
  );

  /**
   * Удаляет подписку
   */
  const handleDeleteSubscription = useCallback(
    async (id: string) => {
      try {
        await deleteSubscriptionMutation.mutateAsync(id);
        message.success('Подписка удалена');
      } catch (err) {
        uiLogger.error('Error deleting subscription:', err);
        message.error('Ошибка при удалении подписки');
        throw err;
      }
    },
    [deleteSubscriptionMutation],
  );

  /**
   * Обновляет настройки
   */
  const handleUpdateSettings = useCallback(
    async (newSettings: Partial<SubscriptionSettings>) => {
      try {
        await updateSettingsMutation.mutateAsync(newSettings);
        message.success('Настройки сохранены');
      } catch (err) {
        uiLogger.error('Error updating settings:', err);
        message.error('Ошибка при сохранении настроек');
        throw err;
      }
    },
    [updateSettingsMutation],
  );

  /**
   * Обновляет настройки из backend API
   */
  const refreshSettings = useCallback(async () => {
    await settingsQuery.refetch();
  }, [settingsQuery]);

  // Фильтрация

  /**
   * Фильтрует подписки по статусу
   */
  const filterByStatus = useCallback(
    (status: ComputedSubscriptionStatus | 'all') => {
      if (status === 'all') return subscriptionsWithDetails;
      return subscriptionsWithDetails.filter((sub) => sub.computedStatus === status);
    },
    [subscriptionsWithDetails],
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
