import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Card, Form, message } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useUpdateBotMutation } from '../../entities/bot/api/useBotMutations';
import { isPersonDataComplete } from '../../utils/accountGenerators';
import styles from './account/account.module.css';
import {
  AccountCardTitle,
  AccountLoadingState,
  AccountUnavailableState,
  AccountWorkflowAlert,
  ActionButtonsSection,
  ConfirmGenerationModal,
  EmailSection,
  GeneratorPresetsCard,
  IncompleteAccountAlert,
  PasswordGeneratorOptionsCard,
  PasswordSection,
  RegistrationDateSection,
} from './account/sections';
import type { AccountFormValues, AccountGenerationLocks, BotAccountProps } from './account/types';
import { useAccountGenerationWorkflow } from './account/use-account-generation-workflow';
import { useAccountGeneratorState } from './account/use-account-generator-state';
import { useBotAccountSubscription } from './account/use-bot-account-subscription';

export const BotAccount: React.FC<BotAccountProps> = ({ bot }) => {
  const [form] = Form.useForm<AccountFormValues>();
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingLocks, setPendingLocks] = useState<AccountGenerationLocks>({
    email: false,
    password: false,
  });
  const updateBotMutation = useUpdateBotMutation();

  const {
    loading,
    formValues,
    setFormValues,
    generationLocks,
    setGenerationLocks,
    hasBackup,
    setHasBackup,
  } = useBotAccountSubscription({
    botId: bot?.id,
    form,
  });

  const {
    passwordOptions,
    selectedDomain,
    customDomain,
    useCustomDomain,
    setPasswordOptions,
    setSelectedDomain,
    setCustomDomain,
    setUseCustomDomain,
    templates,
    templateName,
    setTemplateName,
    selectedTemplateId,
    defaultTemplateId,
    presetsCollapsed,
    setPresetsCollapsed,
    handleTemplateSelect,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleSetDefaultTemplate,
  } = useAccountGeneratorState();

  const {
    showGenerateModal,
    setShowGenerateModal,
    pendingGeneration,
    setPendingGeneration,
    requestGeneration,
    confirmGeneration,
    handleUnlockGeneration,
    handleRestore,
    setCurrentDateTime,
  } = useAccountGenerationWorkflow({
    bot,
    form,
    setFormValues,
    generationLocks,
    setGenerationLocks,
    pendingLocks,
    setPendingLocks,
    passwordOptions,
    selectedDomain,
    customDomain,
    useCustomDomain,
    updateBot: async (payload) => {
      if (!bot?.id) {
        throw new Error('Bot ID is not available');
      }
      await updateBotMutation.mutateAsync({
        botId: bot.id,
        payload,
      });
    },
    setHasBackup,
  });

  const handleValuesChange = (
    _changedValues: Partial<AccountFormValues>,
    allValues: Partial<AccountFormValues>,
  ) => {
    setFormValues({
      email: allValues.email || '',
      password: allValues.password || '',
      registration_date: allValues.registration_date || null,
    });
  };

  const handleSave = async (values: Partial<AccountFormValues>) => {
    if (
      (generationLocks.email || generationLocks.password) &&
      !pendingLocks.email &&
      !pendingLocks.password
    ) {
      message.warning('Account data is locked. Click Unlock to edit.');
      return;
    }

    if (!bot?.id) {
      message.error('Bot ID is not available');
      return;
    }

    setSaving(true);
    try {
      const accountData = {
        email: values.email || '',
        password: values.password || '',
        bnet_created_at: values.registration_date ? values.registration_date.valueOf() : 0,
      };

      const lockUpdates: Record<string, boolean> = {
        account_email: Boolean(String(values.email || '').trim()),
        account_password: Boolean(String(values.password || '').trim()),
      };

      await updateBotMutation.mutateAsync({
        botId: bot.id,
        payload: {
          account: accountData,
          'generation_locks/account_email': lockUpdates.account_email,
          'generation_locks/account_password': lockUpdates.account_password,
        },
      });

      setGenerationLocks({
        email: lockUpdates.account_email,
        password: lockUpdates.account_password,
      });
      setPendingLocks({ email: false, password: false });
      message.success('Account data saved and locked');
    } catch (error) {
      console.error('Error saving account data:', error);
      message.error(
        'Failed to save account data: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    } finally {
      setSaving(false);
    }
  };

  const getFieldWarning = (fieldName: keyof AccountFormValues) => {
    let isEmpty = false;
    if (fieldName === 'email') {
      isEmpty = !formValues.email?.trim();
    } else if (fieldName === 'password') {
      isEmpty = !formValues.password?.trim();
    } else if (fieldName === 'registration_date') {
      isEmpty = !formValues.registration_date;
    }
    return isEmpty ? <ExclamationCircleOutlined className={styles['field-warning-icon']} /> : null;
  };

  const hasIncompleteData = !(formValues.email?.trim() && formValues.password?.trim());
  const accountLocked = generationLocks.email || generationLocks.password;

  if (!bot) {
    return <AccountUnavailableState />;
  }

  if (loading) {
    return <AccountLoadingState />;
  }

  return (
    <div className={styles['bot-account']}>
      <Card
        title={<AccountCardTitle hasIncompleteData={hasIncompleteData} />}
        className={styles['account-card']}
        headStyle={{
          background: 'var(--boxmox-color-surface-muted)',
          borderColor: 'var(--boxmox-color-border-default)',
        }}
        bodyStyle={{ padding: 16 }}
      >
        {hasIncompleteData && <IncompleteAccountAlert />}

        <AccountWorkflowAlert accountLocked={accountLocked} />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          onValuesChange={handleValuesChange}
          className={styles['account-form']}
          autoComplete="off"
        >
          <EmailSection
            accountLocked={accountLocked}
            emailWarning={getFieldWarning('email')}
            selectedDomain={selectedDomain}
            setSelectedDomain={setSelectedDomain}
            useCustomDomain={useCustomDomain}
            customDomain={customDomain}
            setCustomDomain={setCustomDomain}
            setUseCustomDomain={setUseCustomDomain}
          />

          <PasswordSection
            accountLocked={accountLocked}
            passwordWarning={getFieldWarning('password')}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
          />

          <PasswordGeneratorOptionsCard
            accountLocked={accountLocked}
            passwordOptions={passwordOptions}
            setPasswordOptions={setPasswordOptions}
          />

          <GeneratorPresetsCard
            presetsCollapsed={presetsCollapsed}
            setPresetsCollapsed={setPresetsCollapsed}
            selectedTemplateId={selectedTemplateId}
            templates={templates}
            defaultTemplateId={defaultTemplateId}
            templateName={templateName}
            setTemplateName={setTemplateName}
            handleTemplateSelect={handleTemplateSelect}
            handleSetDefaultTemplate={() => {
              void handleSetDefaultTemplate();
            }}
            handleDeleteTemplate={() => {
              void handleDeleteTemplate();
            }}
            handleSaveTemplate={() => {
              void handleSaveTemplate();
            }}
          />

          <RegistrationDateSection
            accountLocked={accountLocked}
            registrationDateWarning={getFieldWarning('registration_date')}
            setCurrentDateTime={setCurrentDateTime}
          />

          <ActionButtonsSection
            accountLocked={accountLocked}
            locks={generationLocks}
            pendingLocks={pendingLocks}
            isPersonComplete={isPersonDataComplete(bot.person)}
            hasBackup={hasBackup}
            saving={saving}
            requestGeneration={requestGeneration}
            handleUnlockGeneration={() => {
              void handleUnlockGeneration();
            }}
            handleRestore={handleRestore}
          />
        </Form>
      </Card>

      <ConfirmGenerationModal
        open={showGenerateModal}
        pendingGenerationType={pendingGeneration?.type || null}
        isPersonComplete={isPersonDataComplete(bot.person)}
        onConfirm={confirmGeneration}
        onCancel={() => {
          setShowGenerateModal(false);
          setPendingGeneration(null);
        }}
      />
    </div>
  );
};
