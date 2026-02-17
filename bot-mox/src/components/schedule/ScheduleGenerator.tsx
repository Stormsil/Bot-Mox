import React, { useState, useCallback, useEffect } from 'react';
import { Button, InputNumber, TimePicker, Form, Space, Popover, Switch, Divider, Input, List, message, Tooltip } from 'antd';
import { SettingOutlined, ThunderboltOutlined, SaveOutlined, DeleteOutlined, FolderOpenOutlined, LockOutlined } from '@ant-design/icons';
import { apiGet, apiPatch, apiPut } from '../../services/apiClient';
import type { ScheduleGenerationParams, ScheduleTemplate } from '../../types';
import { validateGenerationParams } from '../../utils/scheduleUtils';
import { TableActionButton } from '../ui/TableActionButton';
import { CONSTRAINTS, DEFAULT_PARAMS, toTemplatesList } from './generator-config';
import dayjs from 'dayjs';
import styles from './ScheduleGenerator.module.css';

interface ScheduleGeneratorProps {
  onGenerate: (params: ScheduleGenerationParams) => void;
  disabled?: boolean;
  locked?: boolean;
}

export const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({
  onGenerate,
  disabled = false,
  locked = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<ScheduleGenerationParams>(DEFAULT_PARAMS);
  const [errors, setErrors] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  // Load templates and last params via API
  useEffect(() => {
    let isActive = true;

    const loadGeneratorData = async () => {
      try {
        const [templatesResponse, lastParamsResponse] = await Promise.all([
          apiGet<unknown>('/api/v1/settings/schedule/templates'),
          apiGet<unknown>('/api/v1/settings/schedule/last_params'),
        ]);

        if (!isActive) return;

        setTemplates(toTemplatesList(templatesResponse.data));
        if (lastParamsResponse.data && typeof lastParamsResponse.data === 'object') {
          setParams((prev) => ({ ...prev, ...(lastParamsResponse.data as Partial<ScheduleGenerationParams>) }));
        }
      } catch (error) {
        console.error('Failed to load schedule generator settings:', error);
      }
    };

    void loadGeneratorData();
    const timer = setInterval(() => {
      void loadGeneratorData();
    }, 8000);

    return () => {
      isActive = false;
      clearInterval(timer);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    const { valid, errors: validationErrors } = validateGenerationParams(params);
    if (!valid) {
      setErrors(validationErrors);
      return;
    }
    
    // Save as last used params
    try {
      await apiPut('/api/v1/settings/schedule/last_params', params);
    } catch (err) {
      console.error('Failed to save last params:', err);
    }

    onGenerate(params);
    setIsOpen(false);
    setErrors([]);
  }, [params, onGenerate]);

  const updateParam = useCallback(<K extends keyof ScheduleGenerationParams>(
    key: K,
    value: ScheduleGenerationParams[K]
  ) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setErrors([]);
  }, []);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      message.warning('Please enter template name');
      return;
    }

    try {
      const templateId = `schedule_tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await apiPut(`/api/v1/settings/schedule/templates/${templateId}`, {
        name: templateName,
        params,
        created_at: Date.now(),
        updated_at: Date.now()
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
      await apiPatch('/api/v1/settings/schedule/templates', {
        [id]: null,
      });
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
          type={!showTemplates ? "primary" : "default"} 
          size="small" 
          onClick={() => setShowTemplates(false)}
        >
          Generator
        </Button>
        <Button 
          type={showTemplates ? "primary" : "default"} 
          size="small" 
          icon={<FolderOpenOutlined />}
          onClick={() => setShowTemplates(true)}
        >
          Templates ({templates.length})
        </Button>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {!showTemplates ? (
        <Form layout="vertical" size="small">
          <div className={styles['generator-section-title']}>Time Window 1</div>
          <div className={styles['generator-row']}>
            <Form.Item
              className={[styles.formItem, styles.rowItem].join(' ')}
              label={<span className={styles.formLabel}>Start</span>}
            >
              <TimePicker
                value={dayjs(params.startTime, 'HH:mm')}
                onChange={(time) => updateParam('startTime', time?.format('HH:mm') || '09:00')}
                format="HH:mm"
                size="small"
                allowClear={false}
              />
            </Form.Item>
            <Form.Item
              className={[styles.formItem, styles.rowItem].join(' ')}
              label={<span className={styles.formLabel}>End</span>}
            >
              <TimePicker
                value={dayjs(params.endTime, 'HH:mm')}
                onChange={(time) => updateParam('endTime', time?.format('HH:mm') || '23:30')}
                format="HH:mm"
                size="small"
                allowClear={false}
              />
            </Form.Item>
          </div>

          <div className={styles['generator-window-toggle']}>
            <span className={styles['toggle-label']}>Second Window (e.g. night sessions)</span>
            <Switch 
              size="small" 
              checked={params.useSecondWindow} 
              onChange={(checked) => updateParam('useSecondWindow', checked)} 
            />
          </div>

          {params.useSecondWindow && (
            <div className={styles['generator-row']}>
              <Form.Item
                className={[styles.formItem, styles.rowItem].join(' ')}
                label={<span className={styles.formLabel}>Start 2</span>}
              >
                <TimePicker
                  value={dayjs(params.startTime2 || '00:00', 'HH:mm')}
                  onChange={(time) => updateParam('startTime2', time?.format('HH:mm') || '00:00')}
                  format="HH:mm"
                  size="small"
                  allowClear={false}
                />
              </Form.Item>
              <Form.Item
                className={[styles.formItem, styles.rowItem].join(' ')}
                label={<span className={styles.formLabel}>End 2</span>}
              >
                <TimePicker
                  value={dayjs(params.endTime2 || '02:00', 'HH:mm')}
                  onChange={(time) => updateParam('endTime2', time?.format('HH:mm') || '02:00')}
                  format="HH:mm"
                  size="small"
                  allowClear={false}
                />
              </Form.Item>
            </div>
          )}

          <Divider style={{ margin: '8px 0' }} />

          <Form.Item
            className={[styles.formItem, styles['highlight-param']].join(' ')}
            label={(
              <span className={styles.formLabel}>
                Target Active Time: {params.targetActiveMinutes} min ({Math.floor(params.targetActiveMinutes / 60)}h{' '}
                {params.targetActiveMinutes % 60}m)
              </span>
            )}
          >
            <InputNumber
              min={CONSTRAINTS.targetActiveMinutes.min}
              max={CONSTRAINTS.targetActiveMinutes.max}
              value={params.targetActiveMinutes}
              onChange={(value) => updateParam('targetActiveMinutes', value || 480)}
              size="small"
              style={{ width: '100%' }}
              step={15}
            />
          </Form.Item>

          <div className={styles['generator-row']}>
            <Form.Item
              className={[styles.formItem, styles.rowItem].join(' ')}
              label={<span className={styles.formLabel}>Min Session</span>}
            >
              <InputNumber
                min={CONSTRAINTS.minSessionMinutes.min}
                max={CONSTRAINTS.minSessionMinutes.max}
                value={params.minSessionMinutes}
                onChange={(value) => updateParam('minSessionMinutes', value || 60)}
                size="small"
                addonAfter="m"
              />
            </Form.Item>
            <Form.Item
              className={[styles.formItem, styles.rowItem].join(' ')}
              label={<span className={styles.formLabel}>Min Break</span>}
            >
              <InputNumber
                min={CONSTRAINTS.minBreakMinutes.min}
                max={CONSTRAINTS.minBreakMinutes.max}
                value={params.minBreakMinutes}
                onChange={(value) => updateParam('minBreakMinutes', value || 30)}
                size="small"
                addonAfter="m"
              />
            </Form.Item>
          </div>

          <Form.Item
            className={[styles.formItem, styles['highlight-param'], styles['randomness-param']].join(' ')}
            label={
              <Space>
                <span className={styles.formLabel}>
                  Randomization Factor: ±{params.randomOffsetMinutes} min
                </span>
                <Tooltip title="Adds randomness to every session boundary (+/-) to ensure uniqueness.">
                  <SettingOutlined style={{ fontSize: '10px' }} />
                </Tooltip>
              </Space>
            }
          >
            <InputNumber
              min={CONSTRAINTS.randomOffsetMinutes.min}
              max={CONSTRAINTS.randomOffsetMinutes.max}
              value={params.randomOffsetMinutes}
              onChange={(value) => updateParam('randomOffsetMinutes', value || 0)}
              size="small"
              style={{ width: '100%' }}
              addonAfter="min"
            />
          </Form.Item>

          {errors.length > 0 && (
            <div className={styles['generator-errors']}>
              {errors.map((err, i) => <div key={i} className={styles['error-item']}>{err}</div>)}
            </div>
          )}

          <div className={styles['generator-template-save']}>
            <Input 
              placeholder="Template name" 
              size="small" 
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              style={{ width: '140px' }}
            />
            <Button 
              size="small" 
              icon={<SaveOutlined />} 
              onClick={handleSaveTemplate}
              title="Save as template"
            >
              Save
            </Button>
          </div>

          <div className={styles['generator-actions']}>
            <Button size="small" onClick={() => setParams(DEFAULT_PARAMS)}>
              Reset
            </Button>
            <Button 
              type="primary" 
              size="small" 
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
            >
              Generate
            </Button>
          </div>
        </Form>
      ) : (
        <div className={styles['templates-list-container']}>
          <List
            size="small"
            dataSource={templates}
            renderItem={(item, index) => (
              <List.Item 
                className={styles['template-item']}
                style={{
                  padding: '10px 8px',
                  borderBottom:
                    index === templates.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div className={styles['template-row']}>
                  <div className={styles['template-info']}>
                    <div className={styles['template-name']}>{item.name}</div>
                    <div className={styles['template-details']}>
                      {Math.floor(item.params.targetActiveMinutes / 60)}h {item.params.targetActiveMinutes % 60}m 
                      {item.params.useSecondWindow ? ' | 2 Windows' : ''}
                    </div>
                  </div>
                  <div className={styles['template-actions']}>
                    <Button 
                      type="primary"
                      size="small"
                      className={styles['template-apply-btn']}
                      icon={<ThunderboltOutlined />}
                      onClick={() => handleApplyTemplate(item)}
                    >
                      Apply
                    </Button>
                    <Space size={0}>
                      <TableActionButton
                        icon={<FolderOpenOutlined />}
                        onClick={() => handleLoadTemplate(item)}
                        tooltip="Load parameters"
                      />
                      <TableActionButton
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => handleDeleteTemplate(e as React.MouseEvent, item.id)}
                        tooltip="Delete template"
                      />
                    </Space>
                  </div>
                </div>
              </List.Item>
            )}
            locale={{ emptyText: 'No templates' }}
          />
        </div>
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
