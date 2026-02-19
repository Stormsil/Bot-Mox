import { Card, Form, message } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useUpdateBotMutation } from '../../entities/bot/api/useBotMutations';
import { useBotByIdQuery } from '../../entities/bot/api/useBotQueries';
import type { BotPersonProps, PersonFormValues } from './person';
import {
  countries,
  generateRandomPersonData,
  hasAnyPersonData,
  isPersonDataComplete,
  loadPersonGeneratorCountry,
  normalizeCountry,
  PersonCardTitle,
  PersonFormFields,
  PersonLoadingState,
  PersonStatusAlerts,
  PersonUnavailableState,
  savePersonGeneratorCountry,
  toPersonFormValues,
  toPersonPayload,
} from './person';
import styles from './person/person.module.css';

export const BotPerson: React.FC<BotPersonProps> = ({ bot }) => {
  const [form] = Form.useForm<PersonFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>(
    () => loadPersonGeneratorCountry() || countries[0],
  );
  const [generationLocked, setGenerationLocked] = useState(false);
  const [pendingLock, setPendingLock] = useState(false);
  const botQuery = useBotByIdQuery(bot?.id);
  const updateBotMutation = useUpdateBotMutation();

  useEffect(() => {
    if (!bot) {
      setLoading(false);
      return;
    }

    if (hasAnyPersonData(bot.person)) {
      const personValues = toPersonFormValues(bot.person);
      form.setFieldsValue(personValues);
      if (personValues.country) {
        setSelectedCountry(normalizeCountry(personValues.country));
      }
    } else {
      form.resetFields();
    }

    setLoading(false);
  }, [bot, form]);

  useEffect(() => {
    if (!botQuery.data) {
      return;
    }
    const locks = (botQuery.data.generation_locks || {}) as Record<string, unknown>;
    setGenerationLocked(Boolean(locks.person_data));
  }, [botQuery.data]);

  useEffect(() => {
    const normalizedCountry = normalizeCountry(selectedCountry);
    if (normalizedCountry !== selectedCountry) {
      setSelectedCountry(normalizedCountry);
      return;
    }

    savePersonGeneratorCountry(normalizedCountry);
  }, [selectedCountry]);

  const handleSave = async (values: PersonFormValues) => {
    if (generationLocked) {
      message.warning('Person data is locked. Click Unlock to edit.');
      return;
    }

    if (!bot?.id) {
      message.error('Bot ID is not available');
      return;
    }

    setSaving(true);
    try {
      await updateBotMutation.mutateAsync({
        botId: bot.id,
        payload: {
          person: toPersonPayload(values),
          ...(pendingLock ? { 'generation_locks/person_data': true } : {}),
        },
      });

      if (pendingLock) {
        setPendingLock(false);
      }

      message.success('Person data saved successfully');
    } catch (error) {
      console.error('Error saving person data:', error);
      message.error(
        `Failed to save person data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateData = useCallback(() => {
    if (generationLocked) {
      message.warning('Person generation is locked');
      return;
    }

    const generatedData = generateRandomPersonData(selectedCountry);
    form.setFieldsValue(generatedData);
    setPendingLock(true);
    message.success(`Generated random person data for ${selectedCountry}`);
  }, [form, generationLocked, selectedCountry]);

  const handleUnlockGeneration = useCallback(async () => {
    if (!bot?.id) return;

    try {
      await updateBotMutation.mutateAsync({
        botId: bot.id,
        payload: {
          'generation_locks/person_data': false,
        },
      });

      setPendingLock(false);
      setGenerationLocked(false);
      message.success('Person generation unlocked');
    } catch (error) {
      console.error('Failed to unlock person generation:', error);
      message.error('Failed to unlock generation');
    }
  }, [bot?.id, updateBotMutation]);

  const hasIncompleteData = !isPersonDataComplete(bot?.person);
  const manualEditLocked = generationLocked;

  if (!bot) {
    return <PersonUnavailableState />;
  }

  if (loading) {
    return <PersonLoadingState />;
  }

  return (
    <div className={styles['bot-person']}>
      <Card
        title={<PersonCardTitle hasIncompleteData={hasIncompleteData} />}
        className={styles['person-card']}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderColor: 'var(--boxmox-color-border-default)',
            color: 'var(--boxmox-color-text-primary)',
          },
        }}
      >
        <PersonStatusAlerts
          hasIncompleteData={hasIncompleteData}
          manualEditLocked={manualEditLocked}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className={styles['person-form']}
          autoComplete="off"
        >
          <PersonFormFields
            form={form}
            selectedCountry={selectedCountry}
            availableCountries={countries}
            manualEditLocked={manualEditLocked}
            generationLocked={generationLocked}
            pendingLock={pendingLock}
            saving={saving}
            onSelectedCountryChange={setSelectedCountry}
            onGenerateData={handleGenerateData}
            onUnlockGeneration={handleUnlockGeneration}
          />
        </Form>
      </Card>
    </div>
  );
};
