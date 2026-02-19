import { message } from 'antd';
import type { FormInstance } from 'antd/es/form';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useBotByIdQuery } from '../../../entities/bot/api/useBotQueries';
import { hasBackup as checkHasBackup } from '../../../utils/accountGenerators';
import type { AccountFormValues, AccountGenerationLocks } from './types';

interface UseBotAccountSubscriptionParams {
  botId?: string;
  form: FormInstance<AccountFormValues>;
}

interface UseBotAccountSubscriptionResult {
  loading: boolean;
  formValues: AccountFormValues;
  setFormValues: React.Dispatch<React.SetStateAction<AccountFormValues>>;
  generationLocks: AccountGenerationLocks;
  setGenerationLocks: React.Dispatch<React.SetStateAction<AccountGenerationLocks>>;
  hasBackup: boolean;
  setHasBackup: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useBotAccountSubscription = ({
  botId,
  form,
}: UseBotAccountSubscriptionParams): UseBotAccountSubscriptionResult => {
  const botQuery = useBotByIdQuery(botId);
  const [loading, setLoading] = useState(true);
  const [formValues, setFormValues] = useState<AccountFormValues>({
    email: '',
    password: '',
    registration_date: null,
  });
  const [generationLocks, setGenerationLocks] = useState<AccountGenerationLocks>({
    email: false,
    password: false,
  });
  const [hasBackup, setHasBackup] = useState(false);

  useEffect(() => {
    if (!botId) {
      if (typeof window === 'undefined') {
        return;
      }

      const frameId = window.requestAnimationFrame(() => {
        setLoading(false);
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }
    if (botQuery.isLoading && !botQuery.data) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (botQuery.error) {
        console.error('Error loading account data:', botQuery.error);
        message.error('Failed to load account data');
        setLoading(false);
        return;
      }

      const payload = botQuery.data;
      const account = (payload?.account || {}) as Record<string, unknown>;
      const email = String(account.email || '');
      const password = String(account.password || '');
      const registrationDate = Number(account.bnet_created_at || account.mail_created_at || 0);

      if (email || password || registrationDate) {
        const newValues: AccountFormValues = {
          email,
          password,
          registration_date: registrationDate ? dayjs(registrationDate) : null,
        };
        setFormValues(newValues);
        form.setFieldsValue(newValues);
      } else {
        const emptyValues: AccountFormValues = { email: '', password: '', registration_date: null };
        setFormValues(emptyValues);
        form.resetFields();
      }

      const locks = (payload?.generation_locks || {}) as Record<string, unknown>;
      setGenerationLocks({
        email: Boolean(locks.account_email),
        password: Boolean(locks.account_password),
      });

      setHasBackup(checkHasBackup(botId));
      setLoading(false);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [botId, botQuery.data, botQuery.error, botQuery.isLoading, form]);

  return {
    loading,
    formValues,
    setFormValues,
    generationLocks,
    setGenerationLocks,
    hasBackup,
    setHasBackup,
  };
};
