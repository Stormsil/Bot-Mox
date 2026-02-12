import React, { useCallback, useEffect, useState } from 'react';
import { Card, Form, message } from 'antd';
import { apiPatch } from '../../services/apiClient';
import { subscribeBotById } from '../../services/botsApiService';
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
import type { BotPersonProps, PersonFormValues } from './person';
import './BotPerson.css';

export const BotPerson: React.FC<BotPersonProps> = ({ bot }) => {
  const [form] = Form.useForm<PersonFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>(() => loadPersonGeneratorCountry() || countries[0]);
  const [generationLocked, setGenerationLocked] = useState(false);
  const [pendingLock, setPendingLock] = useState(false);

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
    if (!bot?.id) return;

    const unsubscribe = subscribeBotById(
      bot.id,
      (payload) => {
        const locks = (payload?.generation_locks || {}) as Record<string, unknown>;
        setGenerationLocked(Boolean(locks.person_data));
      },
      (error) => {
        console.error('Failed to load person lock state:', error);
      },
      { intervalMs: 5000 }
    );

    return () => unsubscribe();
  }, [bot?.id]);

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
      await apiPatch(`/api/v1/bots/${encodeURIComponent(bot.id)}`, {
        person: toPersonPayload(values),
        ...(pendingLock ? { 'generation_locks/person_data': true } : {}),
      });

      if (pendingLock) {
        setPendingLock(false);
      }

      message.success('Person data saved successfully');
    } catch (error) {
      console.error('Error saving person data:', error);
      message.error(`Failed to save person data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      await apiPatch(`/api/v1/bots/${encodeURIComponent(bot.id)}`, {
        'generation_locks/person_data': false,
      });

      setPendingLock(false);
      setGenerationLocked(false);
      message.success('Person generation unlocked');
    } catch (error) {
      console.error('Failed to unlock person generation:', error);
      message.error('Failed to unlock generation');
    }
  }, [bot?.id]);

  const hasIncompleteData = !isPersonDataComplete(bot?.person);
  const manualEditLocked = generationLocked;

  if (!bot) {
    return <PersonUnavailableState />;
  }

  if (loading) {
    return <PersonLoadingState />;
  }

  return (
    <div className="bot-person">
      <Card title={<PersonCardTitle hasIncompleteData={hasIncompleteData} />} className="person-card">
        <PersonStatusAlerts hasIncompleteData={hasIncompleteData} manualEditLocked={manualEditLocked} />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="person-form"
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
