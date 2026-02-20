import { message } from 'antd';
import dayjs from 'dayjs';
import { type Dispatch, type SetStateAction, useState } from 'react';
import {
  generateEmail,
  generatePassword,
  isPersonDataComplete,
  loadBackup,
  saveBackup,
} from '../../../utils/accountGenerators';
import type {
  AccountFormValues,
  AccountGenerationLocks,
  BotAccountProps,
  PendingGenerationState,
} from './types';

interface UseAccountGenerationWorkflowParams {
  bot: BotAccountProps['bot'];
  form: {
    getFieldsValue: () => Partial<AccountFormValues>;
    setFieldValue: (
      name: keyof AccountFormValues,
      value: AccountFormValues[keyof AccountFormValues],
    ) => void;
    setFieldsValue: (values: Partial<AccountFormValues>) => void;
  };
  setFormValues: Dispatch<SetStateAction<AccountFormValues>>;
  generationLocks: AccountGenerationLocks;
  setGenerationLocks: Dispatch<SetStateAction<AccountGenerationLocks>>;
  pendingLocks: AccountGenerationLocks;
  setPendingLocks: Dispatch<SetStateAction<AccountGenerationLocks>>;
  passwordOptions: Parameters<typeof generatePassword>[0];
  selectedDomain: string;
  useCustomDomain: boolean;
  customDomain: string;
  updateBot: (payload: Record<string, unknown>) => Promise<void>;
  setHasBackup: (value: boolean) => void;
}

export function useAccountGenerationWorkflow({
  bot,
  form,
  setFormValues,
  generationLocks,
  setGenerationLocks,
  pendingLocks,
  setPendingLocks,
  passwordOptions,
  selectedDomain,
  useCustomDomain,
  customDomain,
  updateBot,
  setHasBackup,
}: UseAccountGenerationWorkflowParams) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState<PendingGenerationState | null>(null);

  const requestGeneration = (type: 'password' | 'email' | 'both') => {
    if ((type === 'password' || type === 'both') && generationLocks.password) {
      message.warning('Password generation is locked');
      return;
    }
    if ((type === 'email' || type === 'both') && generationLocks.email) {
      message.warning('Email generation is locked');
      return;
    }

    const currentValues = form.getFieldsValue();
    if (bot?.id) {
      saveBackup(bot.id, {
        email: currentValues.email || '',
        password: currentValues.password || '',
        registration_date: currentValues.registration_date
          ? currentValues.registration_date.valueOf()
          : 0,
      });
      setHasBackup(true);
    }

    setPendingGeneration({ type });
    setShowGenerateModal(true);
  };

  const confirmGeneration = () => {
    if (!pendingGeneration) return;

    const { type } = pendingGeneration;

    if (type === 'password' || type === 'both') {
      const newPassword = generatePassword(passwordOptions);
      form.setFieldValue('password', newPassword);
      setFormValues((prev) => ({ ...prev, password: newPassword }));
      setPendingLocks((prev) => ({ ...prev, password: true }));
    }

    if (type === 'email' || type === 'both') {
      if (!isPersonDataComplete(bot?.person)) {
        message.error('Person data must be filled first (First Name, Last Name, Birth Date)');
        setShowGenerateModal(false);
        setPendingGeneration(null);
        return;
      }

      const domain = useCustomDomain ? customDomain : selectedDomain;
      if (!domain || domain === 'custom') {
        message.error('Please select or enter a domain');
        return;
      }
      const person = bot?.person;
      if (!person?.first_name || !person?.last_name || !person?.birth_date) {
        message.error('Person data must be filled first (First Name, Last Name, Birth Date)');
        setShowGenerateModal(false);
        setPendingGeneration(null);
        return;
      }

      const newEmail = generateEmail({
        firstName: person.first_name,
        lastName: person.last_name,
        birthDate: person.birth_date,
        domain,
      });
      form.setFieldValue('email', newEmail);
      setFormValues((prev) => ({ ...prev, email: newEmail }));
      setPendingLocks((prev) => ({ ...prev, email: true }));
    }

    message.success('Generated successfully');
    setShowGenerateModal(false);
    setPendingGeneration(null);
  };

  const handleUnlockGeneration = async () => {
    if (!bot?.id) return;

    const updates: Record<string, boolean> = {};
    if (generationLocks.email || pendingLocks.email) {
      updates.account_email = false;
    }
    if (generationLocks.password || pendingLocks.password) {
      updates.account_password = false;
    }

    if (Object.keys(updates).length === 0) {
      message.info('Generation is already unlocked');
      return;
    }

    try {
      await updateBot({
        ...(updates.account_email !== undefined
          ? { 'generation_locks/account_email': updates.account_email }
          : {}),
        ...(updates.account_password !== undefined
          ? { 'generation_locks/account_password': updates.account_password }
          : {}),
      });
      setPendingLocks({ email: false, password: false });
      setGenerationLocks({ email: false, password: false });
      message.success('Account generation unlocked');
    } catch (error) {
      console.error('Failed to unlock account generation:', error);
      message.error('Failed to unlock generation');
    }
  };

  const handleRestore = () => {
    if (!bot?.id) return;

    const backup = loadBackup(bot.id);
    if (backup) {
      const restoredValues: AccountFormValues = {
        email: backup.email,
        password: backup.password,
        registration_date: backup.registration_date ? dayjs(backup.registration_date) : null,
      };
      form.setFieldsValue(restoredValues);
      setFormValues(restoredValues);
      setPendingLocks({ email: false, password: false });
      message.success('Previous values restored from backup');
    } else {
      message.warning('No backup found');
    }
  };

  const setCurrentDateTime = () => {
    const now = dayjs();
    form.setFieldValue('registration_date', now);
    setFormValues((prev) => ({ ...prev, registration_date: now }));
  };

  return {
    showGenerateModal,
    setShowGenerateModal,
    pendingGeneration,
    setPendingGeneration,
    requestGeneration,
    confirmGeneration,
    handleUnlockGeneration,
    handleRestore,
    setCurrentDateTime,
  };
}
