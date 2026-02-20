import { CalendarOutlined, ReloadOutlined, SaveOutlined, UnlockOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type React from 'react';
import type { ScheduleGenerationParams } from '../../types';
import { ScheduleGenerator } from '../schedule';
import styles from './BotSchedule.module.css';

interface BotScheduleActionsProps {
  viewMode: 'day' | 'week';
  setViewMode: (mode: 'day' | 'week') => void;
  handleGenerateSchedule: (params: ScheduleGenerationParams) => void;
  loading: boolean;
  scheduleLocked: boolean;
  pendingScheduleLock: boolean;
  handleUnlockGeneration: () => void;
  handleReset: () => void;
  hasChanges: boolean;
  handleSave: () => void;
}

export const BotScheduleActions: React.FC<BotScheduleActionsProps> = ({
  viewMode,
  setViewMode,
  handleGenerateSchedule,
  loading,
  scheduleLocked,
  pendingScheduleLock,
  handleUnlockGeneration,
  handleReset,
  hasChanges,
  handleSave,
}) => (
  <div className={styles['schedule-actions']}>
    <Button
      icon={<CalendarOutlined />}
      size="small"
      onClick={() => setViewMode(viewMode === 'day' ? 'week' : 'day')}
      className={styles['schedule-action-btn']}
    >
      {viewMode === 'day' ? 'Week Overview' : 'Day View'}
    </Button>
    <ScheduleGenerator
      onGenerate={handleGenerateSchedule}
      disabled={loading}
      locked={scheduleLocked}
    />
    {(scheduleLocked || pendingScheduleLock) && (
      <Button
        icon={<UnlockOutlined />}
        size="small"
        onClick={handleUnlockGeneration}
        className={[styles['schedule-action-btn'], styles['schedule-unlock-btn']].join(' ')}
      >
        Unlock
      </Button>
    )}
    <Button
      icon={<ReloadOutlined />}
      size="small"
      onClick={handleReset}
      disabled={!hasChanges}
      className={styles['schedule-action-btn']}
    >
      Reset
    </Button>
    <Button
      type="primary"
      icon={<SaveOutlined />}
      size="small"
      onClick={handleSave}
      disabled={!hasChanges}
      className={styles['schedule-action-btn-primary']}
    >
      Save
    </Button>
  </div>
);
