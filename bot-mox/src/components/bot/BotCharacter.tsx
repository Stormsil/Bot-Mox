import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import { Card, Form, message, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUpdateBotMutation } from '../../entities/bot/api/useBotMutations';
import { useBotByIdQuery } from '../../entities/bot/api/useBotQueries';
import { useBotReferenceDataQuery } from '../../entities/bot/api/useBotReferenceDataQuery';
import { useWowNamesMutation } from '../../entities/bot/api/useWowNamesMutation';
import type { FactionType } from '../../types';
import type { BotCharacterProps, CharacterFormData, ReferenceData } from './character';
import {
  CharacterEditForm,
  CharacterErrorCard,
  CharacterLoadingCard,
  CharacterViewMode,
  DEFAULT_FORM_DATA,
  isCharacterComplete,
  RACE_ICONS,
  toReferenceData,
} from './character';
import styles from './character/character.module.css';

export const BotCharacter: React.FC<BotCharacterProps> = ({ bot, mode = 'edit' }) => {
  const [characterForm] = Form.useForm<CharacterFormData>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameGenerating, setNameGenerating] = useState(false);
  const [nameLocked, setNameLocked] = useState(false);
  const [pendingNameLock, setPendingNameLock] = useState(false);
  const [lastGeneratedName, setLastGeneratedName] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usedGeneratedNamesRef = useRef<Set<string>>(new Set());

  const [formData, setFormData] = useState<CharacterFormData>(DEFAULT_FORM_DATA);
  const botQuery = useBotByIdQuery(bot?.id);
  const referenceDataQuery = useBotReferenceDataQuery(bot?.project_id);
  const updateBotMutation = useUpdateBotMutation();
  const wowNamesMutation = useWowNamesMutation();
  const referenceData = useMemo<ReferenceData>(
    () => toReferenceData(referenceDataQuery.data),
    [referenceDataQuery.data],
  );
  const refDataLoading = referenceDataQuery.isLoading;

  useEffect(() => {
    if (!bot?.id) {
      setLoading(false);
      return;
    }

    if (botQuery.isLoading && !botQuery.data) {
      setLoading(true);
      return;
    }

    if (botQuery.error) {
      console.error('Error loading character data:', botQuery.error);
      setError('Failed to load character data');
      setLoading(false);
      return;
    }

    const payload = botQuery.data;
    const source = (payload?.character || bot.character || {}) as Partial<CharacterFormData> & {
      level?: number;
    };
    const newFormData: CharacterFormData = {
      name: source.name || '',
      level: typeof source.level === 'number' ? source.level : 1,
      server: source.server || '',
      faction: (source.faction as FactionType) || '',
      race: source.race || '',
      class: source.class || '',
    };

    setFormData(newFormData);
    characterForm.setFieldsValue(newFormData);

    const locks = (payload?.generation_locks || {}) as Record<string, unknown>;
    setNameLocked(Boolean(locks.character_name));
    setError(null);
    setLoading(false);
  }, [bot?.id, bot?.character, botQuery.data, botQuery.error, botQuery.isLoading, characterForm]);

  const handleValuesChange = useCallback(
    (changedValues: Partial<CharacterFormData>, allValues: CharacterFormData) => {
      setFormData(allValues);
      setHasChanges(true);

      if ('faction' in changedValues) {
        characterForm.setFieldsValue({ race: '', class: '' });
      }
      if ('race' in changedValues) {
        characterForm.setFieldsValue({ class: '' });
      }
    },
    [characterForm],
  );

  const filteredRaces = useMemo(() => {
    if (!formData.faction) return [];
    return Object.values(referenceData.races).filter((race) => race.faction === formData.faction);
  }, [referenceData.races, formData.faction]);

  const availableClasses = useMemo(() => {
    if (!formData.race) return [];
    const selectedRace = referenceData.races[formData.race];
    if (!selectedRace?.available_classes) return [];
    return selectedRace.available_classes
      .map((classId) => referenceData.classes[classId])
      .filter(Boolean);
  }, [referenceData.races, referenceData.classes, formData.race]);

  const handleSave = async (values: CharacterFormData) => {
    if (!bot?.id) {
      message.error('Bot ID is not available');
      return;
    }

    const missingFields: string[] = [];
    if (!values.name?.trim()) missingFields.push('Character Name');
    if (!values.server) missingFields.push('Server');
    if (!values.faction) missingFields.push('Faction');
    if (!values.race) missingFields.push('Race');
    if (!values.class) missingFields.push('Class');

    if (missingFields.length > 0) {
      message.warning(`Fill required fields: ${missingFields.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      const currentLevel = formData.level || 1;
      const characterData = {
        name: values.name,
        level: currentLevel,
        server: values.server,
        faction: values.faction,
        race: values.race,
        class: values.class,
        updated_at: Date.now(),
      };

      const shouldLockName = !!String(values.name || '').trim();
      await updateBotMutation.mutateAsync({
        botId: bot.id,
        payload: {
          character: characterData,
          'generation_locks/character_name': shouldLockName,
        },
      });
      setNameLocked(shouldLockName);
      setPendingNameLock(false);
      message.success(
        shouldLockName ? 'Character data saved and name locked' : 'Character data saved',
      );
      setHasChanges(false);
    } catch (saveError) {
      console.error('Error saving character data:', saveError);
      message.error(
        'Failed to save character data: ' +
          (saveError instanceof Error ? saveError.message : 'Unknown error'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    characterForm.setFieldsValue(formData);
    setHasChanges(false);
  };

  const handleGenerateName = useCallback(async () => {
    if (nameGenerating) return;
    if (nameLocked) {
      message.warning('Name generation is locked');
      return;
    }
    setNameGenerating(true);

    try {
      const data = await wowNamesMutation.mutateAsync({ batches: 3 });
      const names = Array.isArray(data.names) ? data.names.filter((name: string) => name) : [];
      let candidatePool = names.filter((name: string) => !usedGeneratedNamesRef.current.has(name));
      if (!candidatePool.length) {
        usedGeneratedNamesRef.current.clear();
        candidatePool = names;
      }

      let generatedName =
        candidatePool.length > 0
          ? candidatePool[Math.floor(Math.random() * candidatePool.length)]
          : data?.random || '';

      if (generatedName && lastGeneratedName && candidatePool.length > 1) {
        let attempts = 0;
        while (generatedName === lastGeneratedName && attempts < 5) {
          generatedName = candidatePool[Math.floor(Math.random() * candidatePool.length)];
          attempts += 1;
        }
      }

      if (!generatedName) {
        throw new Error('No name returned');
      }

      characterForm.setFieldsValue({ name: generatedName });
      setFormData((prev) => ({ ...prev, name: generatedName }));
      setHasChanges(true);
      setPendingNameLock(true);
      setLastGeneratedName(generatedName);
      usedGeneratedNamesRef.current.add(generatedName);
      message.success(`Generated: ${generatedName}`);
    } catch (generateError) {
      console.error('Failed to generate WoW name:', generateError);
      message.error('Failed to generate name. Check API connectivity and auth session.');
    } finally {
      setNameGenerating(false);
    }
  }, [characterForm, lastGeneratedName, nameGenerating, nameLocked, wowNamesMutation]);

  const handleUnlockName = useCallback(async () => {
    if (!bot?.id) return;
    try {
      await updateBotMutation.mutateAsync({
        botId: bot.id,
        payload: {
          'generation_locks/character_name': false,
        },
      });
      setPendingNameLock(false);
      message.success('Name generation unlocked');
    } catch (unlockError) {
      console.error('Failed to unlock character name generation:', unlockError);
      message.error('Failed to unlock name generation');
    }
  }, [bot?.id, updateBotMutation]);

  const complete = useMemo(() => isCharacterComplete(formData), [formData]);
  const raceIconUrl = useMemo(() => {
    if (!formData.race) return null;
    return referenceData.races[formData.race]?.icon || RACE_ICONS[formData.race];
  }, [formData.race, referenceData.races]);

  if (loading || refDataLoading) {
    return <CharacterLoadingCard />;
  }

  if (error || referenceDataQuery.error) {
    return <CharacterErrorCard error={error || 'Failed to load reference data'} />;
  }

  return (
    <div className={styles['bot-character']}>
      <Card
        className={styles['character-card']}
        title={
          <div className={styles['character-card-header']}>
            {mode === 'view' ? (
              <EyeOutlined className={styles['header-icon']} />
            ) : (
              <EditOutlined className={styles['header-icon']} />
            )}
            <span className={styles['character-card-title']}>
              {mode === 'view' ? 'Character Information' : 'Character Configuration'}
            </span>
            {!complete && (
              <Tooltip title="Character data is incomplete">
                <span className={styles['incomplete-dot']} aria-hidden="true" />
              </Tooltip>
            )}
          </div>
        }
        headStyle={{
          background: 'var(--boxmox-color-surface-muted)',
          borderColor: 'var(--boxmox-color-border-default)',
        }}
        bodyStyle={{ padding: 16 }}
      >
        {mode === 'view' ? (
          <CharacterViewMode
            formData={formData}
            referenceData={referenceData}
            raceIconUrl={raceIconUrl}
          />
        ) : (
          <CharacterEditForm
            form={characterForm}
            formData={formData}
            referenceData={referenceData}
            refDataLoading={refDataLoading}
            filteredRaces={filteredRaces}
            availableClasses={availableClasses}
            hasChanges={hasChanges}
            saving={saving}
            nameGenerating={nameGenerating}
            nameLocked={nameLocked}
            pendingNameLock={pendingNameLock}
            isCharacterComplete={complete}
            onValuesChange={handleValuesChange}
            onSave={handleSave}
            onCancel={handleCancel}
            onGenerateName={handleGenerateName}
            onUnlockName={handleUnlockName}
          />
        )}
      </Card>
    </div>
  );
};
