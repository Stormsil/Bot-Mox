import { SaveOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import {
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Space,
  Switch,
  TimePicker,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import type { ScheduleGenerationParams } from '../../types';
import { CONSTRAINTS } from './generator-config';
import styles from './ScheduleGenerator.module.css';

interface ScheduleGeneratorFormProps {
  params: ScheduleGenerationParams;
  errors: string[];
  templateName: string;
  onTemplateNameChange: (value: string) => void;
  onParamUpdate: <K extends keyof ScheduleGenerationParams>(
    key: K,
    value: ScheduleGenerationParams[K],
  ) => void;
  onSaveTemplate: () => void;
  onGenerate: () => void;
  onReset: () => void;
}

export const ScheduleGeneratorForm: React.FC<ScheduleGeneratorFormProps> = ({
  params,
  errors,
  templateName,
  onTemplateNameChange,
  onParamUpdate,
  onSaveTemplate,
  onGenerate,
  onReset,
}) => {
  const errorKeyCounts = new Map<string, number>();

  return (
    <Form layout="vertical" size="small">
      <div className={styles['generator-section-title']}>Time Window 1</div>
      <div className={styles['generator-row']}>
        <Form.Item
          className={[styles.formItem, styles.rowItem].join(' ')}
          label={<span className={styles.formLabel}>Start</span>}
        >
          <TimePicker
            value={dayjs(params.startTime, 'HH:mm')}
            onChange={(time) => onParamUpdate('startTime', time?.format('HH:mm') || '09:00')}
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
            onChange={(time) => onParamUpdate('endTime', time?.format('HH:mm') || '23:30')}
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
          onChange={(checked) => onParamUpdate('useSecondWindow', checked)}
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
              onChange={(time) => onParamUpdate('startTime2', time?.format('HH:mm') || '00:00')}
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
              onChange={(time) => onParamUpdate('endTime2', time?.format('HH:mm') || '02:00')}
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
        label={
          <span className={styles.formLabel}>
            Target Active Time: {params.targetActiveMinutes} min (
            {Math.floor(params.targetActiveMinutes / 60)}h {params.targetActiveMinutes % 60}m)
          </span>
        }
      >
        <InputNumber
          min={CONSTRAINTS.targetActiveMinutes.min}
          max={CONSTRAINTS.targetActiveMinutes.max}
          value={params.targetActiveMinutes}
          onChange={(value) => onParamUpdate('targetActiveMinutes', value || 480)}
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
            onChange={(value) => onParamUpdate('minSessionMinutes', value || 60)}
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
            onChange={(value) => onParamUpdate('minBreakMinutes', value || 30)}
            size="small"
            addonAfter="m"
          />
        </Form.Item>
      </div>

      <Form.Item
        className={[styles.formItem, styles['highlight-param'], styles['randomness-param']].join(
          ' ',
        )}
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
          onChange={(value) => onParamUpdate('randomOffsetMinutes', value || 0)}
          size="small"
          style={{ width: '100%' }}
          addonAfter="min"
        />
      </Form.Item>

      {errors.length > 0 && (
        <div className={styles['generator-errors']}>
          {errors.map((err) => {
            const occurrence = errorKeyCounts.get(err) || 0;
            errorKeyCounts.set(err, occurrence + 1);
            return (
              <div key={`${err}-${occurrence}`} className={styles['error-item']}>
                {err}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles['generator-template-save']}>
        <Input
          placeholder="Template name"
          size="small"
          value={templateName}
          onChange={(e) => onTemplateNameChange(e.target.value)}
          style={{ width: '140px' }}
        />
        <Button
          size="small"
          icon={<SaveOutlined />}
          onClick={onSaveTemplate}
          title="Save as template"
        >
          Save
        </Button>
      </div>

      <div className={styles['generator-actions']}>
        <Button size="small" onClick={onReset}>
          Reset
        </Button>
        <Button type="primary" size="small" icon={<ThunderboltOutlined />} onClick={onGenerate}>
          Generate
        </Button>
      </div>
    </Form>
  );
};
