import { FolderOpenOutlined, LockOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Divider, message, Popover } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useDeleteScheduleTemplateMutation,
  useSaveScheduleLastParamsMutation,
  useSaveScheduleTemplateMutation,
  useScheduleGeneratorSettingsQuery,
} from '../../entities/settings/api/useScheduleGeneratorSettings';
import type { ScheduleGenerationParams, ScheduleTemplate } from '../../types';
import { validateGenerationParams } from '../../utils/scheduleUtils';
import { DEFAULT_PARAMS } from './generator-config';
import styles from './ScheduleGenerator.module.css';
import { ScheduleGeneratorForm } from './ScheduleGeneratorForm';
import { ScheduleTemplateList } from './ScheduleTemplateList';

interface ScheduleGeneratorProps {
  onGenerate: (params: ScheduleGenerationParams) => void;
  disabled?: boolean;
  locked?: boolean;
}

export const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({
  onGenerate,
  disabled = false,
  locked = false,
}) => {
  const scheduleSettingsQuery = useScheduleGeneratorSettingsQuery();
  const saveLastParamsMutation = useSaveScheduleLastParamsMutation();
  const saveTemplateMutation = useSaveScheduleTemplateMutation();
  const deleteTemplateMutation = useDeleteScheduleTemplateMutation();
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<ScheduleGenerationParams>(DEFAULT_PARAMS);
  const [errors, setErrors] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const templates = useMemo<ScheduleTemplate[]>(
    () => scheduleSettingsQuery.data?.templates || [],
    [scheduleSettingsQuery.data],
  );
  const lastSavedParams = scheduleSettingsQuery.data?.lastParams;

  // Keep local parameters in sync with last saved generator state.
  useEffect(() => {
    if (!lastSavedParams) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setParams((prev) => ({ ...prev, ...lastSavedParams }));
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [lastSavedParams]);

  useEffect(() => {
    if (!scheduleSettingsQuery.error) {
      return;
    }
    console.error('Failed to load schedule generator settings:', scheduleSettingsQuery.error);
  }, [scheduleSettingsQuery.error]);

  const handleGenerate = useCallback(async () => {
    const { valid, errors: validationErrors } = validateGenerationParams(params);
    if (!valid) {
      setErrors(validationErrors);
      return;
    }

    // Save as last used params
    try {
      await saveLastParamsMutation.mutateAsync(params);
    } catch (err) {
      console.error('Failed to save last params:', err);
    }

    onGenerate(params);
    setIsOpen(false);
    setErrors([]);
  }, [params, onGenerate, saveLastParamsMutation]);

  const updateParam = useCallback(
    <K extends keyof ScheduleGenerationParams>(key: K, value: ScheduleGenerationParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
      setErrors([]);
    },
    [],
  );

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      message.warning('Please enter template name');
      return;
    }

    try {
      const templateId = `schedule_tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await saveTemplateMutation.mutateAsync({
        templateId,
        name: templateName,
        params,
      });
      setTemplateName('');
      message.success('Template saved');
    } catch (err) {
      console.error('Failed to save template:', err);
      message.error('Failed to save template');
    }
  };

  const handleLoadTemplate = (template: ScheduleTemplate) => {
    // Важно: создаем новый объект чтобы React увидел изменения
    setParams({ ...template.params });
    setShowTemplates(false);
    message.success(`Template "${template.name}" parameters loaded`);
  };

  const handleApplyTemplate = (template: ScheduleTemplate) => {
    // Прямое применение с генерацией
    onGenerate(template.params);
    setIsOpen(false);
    message.success(`Template "${template.name}" applied and randomized`);
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteTemplateMutation.mutateAsync(id);
      message.success('Template deleted');
    } catch (err) {
      console.error('Failed to delete template:', err);
      message.error('Failed to delete template');
    }
  };

  const popoverContent = (
    <div className={styles['schedule-generator-form']}>
      <div className={styles['generator-tabs-header']}>
        <Button
          type={!showTemplates ? 'primary' : 'default'}
          size="small"
          onClick={() => setShowTemplates(false)}
        >
          Generator
        </Button>
        <Button
          type={showTemplates ? 'primary' : 'default'}
          size="small"
          icon={<FolderOpenOutlined />}
          onClick={() => setShowTemplates(true)}
        >
          Templates ({templates.length})
        </Button>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {!showTemplates ? (
        <ScheduleGeneratorForm
          params={params}
          errors={errors}
          templateName={templateName}
          onTemplateNameChange={setTemplateName}
          onParamUpdate={updateParam}
          onSaveTemplate={handleSaveTemplate}
          onGenerate={handleGenerate}
          onReset={() => setParams(DEFAULT_PARAMS)}
        />
      ) : (
        <ScheduleTemplateList
          templates={templates}
          onApplyTemplate={handleApplyTemplate}
          onLoadTemplate={handleLoadTemplate}
          onDeleteTemplate={handleDeleteTemplate}
        />
      )}
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      title="Schedule Generator"
      trigger="click"
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottomRight"
    >
      <Button
        icon={locked ? <LockOutlined /> : <SettingOutlined />}
        size="small"
        disabled={disabled || locked}
      >
        {locked ? 'Locked' : 'Generate'}
      </Button>
    </Popover>
  );
};
