import { WarningOutlined } from '@ant-design/icons';
import { Alert, Card, message, Spin } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useUpdateBotMutation } from '../../entities/bot/api/useBotMutations';
import { useBotByIdQuery } from '../../entities/bot/api/useBotQueries';
import type {
  BotScheduleV2,
  ScheduleDay,
  ScheduleGenerationParams,
  ScheduleSession,
} from '../../types';
import {
  createEmptySchedule,
  generateSchedule,
  migrateSchedule,
  sortSessions,
} from '../../utils/scheduleUtils';
import { SessionEditor } from '../schedule';
import styles from './BotSchedule.module.css';
import { BotScheduleActions } from './BotScheduleActions';
import { BotScheduleContent } from './BotScheduleContent';

interface BotScheduleProps {
  botId: string;
}

export const BotSchedule: React.FC<BotScheduleProps> = ({ botId }) => {
  const [schedule, setSchedule] = useState<BotScheduleV2 | null>(null);
  const [serverSchedule, setServerSchedule] = useState<BotScheduleV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ScheduleSession | null>(null);
  const [scheduleLocked, setScheduleLocked] = useState(false);
  const [pendingScheduleLock, setPendingScheduleLock] = useState(false);
  const botQuery = useBotByIdQuery(botId);
  const updateBotMutation = useUpdateBotMutation();

  useEffect(() => {
    if (!botId) {
      return;
    }
    if (botQuery.isLoading && !botQuery.data) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (botQuery.error) {
        console.error('Failed to load schedule:', botQuery.error);
        setError('Failed to load schedule');
        setLoading(false);
        return;
      }

      const payload = botQuery.data;
      const locks = (payload?.generation_locks || {}) as Record<string, unknown>;
      setScheduleLocked(Boolean(locks.schedule));

      const incoming = payload?.schedule
        ? migrateSchedule(payload.schedule as Record<string, unknown>)
        : createEmptySchedule();

      setServerSchedule(incoming);
      if (!hasChanges) {
        setSchedule(incoming);
      }
      setError(null);
      setLoading(false);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [botId, botQuery.data, botQuery.error, botQuery.isLoading, hasChanges]);

  const getCurrentDaySchedule = useCallback((): ScheduleDay => {
    if (!schedule) return { enabled: false, sessions: [] };
    return (
      schedule.days[selectedDay.toString() as keyof typeof schedule.days] || {
        enabled: false,
        sessions: [],
      }
    );
  }, [schedule, selectedDay]);

  const updateDay = useCallback((dayIndex: number, updates: Partial<ScheduleDay>) => {
    setSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayIndex.toString()]: {
            ...prev.days[dayIndex.toString() as keyof typeof prev.days],
            ...updates,
          },
        },
      };
    });
    setHasChanges(true);
  }, []);

  const handleScheduleChange = useCallback((newSchedule: BotScheduleV2) => {
    setSchedule(newSchedule);
    setHasChanges(true);
  }, []);

  const handleAddSession = useCallback(() => {
    setEditingSession(null);
    setIsEditorOpen(true);
  }, []);

  const handleEditSession = useCallback((session: ScheduleSession) => {
    setEditingSession(session);
    setIsEditorOpen(true);
  }, []);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      const currentDay = getCurrentDaySchedule();
      const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
      const newSessions = sessionsArray.filter((s) => s.id !== sessionId);
      const hasEnabledSessions = newSessions.some((s) => s.enabled);
      updateDay(selectedDay, {
        sessions: sortSessions(newSessions),
        enabled: hasEnabledSessions,
      });
    },
    [getCurrentDaySchedule, selectedDay, updateDay],
  );

  const handleToggleSession = useCallback(
    (sessionId: string, enabled: boolean) => {
      const currentDay = getCurrentDaySchedule();
      const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
      const newSessions = sessionsArray.map((s) => (s.id === sessionId ? { ...s, enabled } : s));
      const hasEnabledSessions = newSessions.some((s) => s.enabled);
      updateDay(selectedDay, {
        sessions: sortSessions(newSessions),
        enabled: hasEnabledSessions,
      });
    },
    [getCurrentDaySchedule, selectedDay, updateDay],
  );

  const handleSaveSession = useCallback(
    (session: ScheduleSession) => {
      const currentDay = getCurrentDaySchedule();
      const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
      let newSessions: ScheduleSession[];

      if (editingSession) {
        newSessions = sessionsArray.map((s) => (s.id === session.id ? session : s));
      } else {
        newSessions = [...sessionsArray, session];
      }

      const hasEnabledSessions = newSessions.some((s) => s.enabled);
      updateDay(selectedDay, {
        sessions: sortSessions(newSessions),
        enabled: hasEnabledSessions || currentDay.enabled,
      });
      setIsEditorOpen(false);
      setEditingSession(null);
    },
    [editingSession, getCurrentDaySchedule, selectedDay, updateDay],
  );

  const handleSessionChange = useCallback(
    (session: ScheduleSession) => {
      const currentDay = getCurrentDaySchedule();
      const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
      const newSessions = sessionsArray.map((s) => (s.id === session.id ? session : s));

      updateDay(selectedDay, {
        sessions: sortSessions(newSessions),
        enabled: newSessions.some((s) => s.enabled),
      });
    },
    [getCurrentDaySchedule, selectedDay, updateDay],
  );

  const handleSave = useCallback(async () => {
    if (!schedule || !botId) return;

    try {
      const nextSchedule = {
        ...schedule,
        updated_at: Date.now(),
      };
      await updateBotMutation.mutateAsync({
        botId,
        payload: {
          schedule: nextSchedule,
          ...(pendingScheduleLock ? { 'generation_locks/schedule': true } : {}),
        },
      });
      setServerSchedule(nextSchedule);
      if (pendingScheduleLock) setPendingScheduleLock(false);
      setHasChanges(false);
      message.success('Schedule saved successfully');
    } catch (err) {
      console.error('Failed to save schedule:', err);
      message.error('Failed to save schedule');
    }
  }, [schedule, botId, pendingScheduleLock, updateBotMutation]);

  const handleReset = useCallback(() => {
    if (serverSchedule) {
      setSchedule(migrateSchedule(serverSchedule as unknown as Record<string, unknown>));
    } else {
      setSchedule(createEmptySchedule());
    }
    setHasChanges(false);
  }, [serverSchedule]);

  const handleGenerateSchedule = useCallback(
    (params: ScheduleGenerationParams) => {
      if (scheduleLocked) {
        message.warning('Schedule generation is locked');
        return;
      }
      const generated = generateSchedule(params);

      setSchedule((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: generated.days,
          allowedWindows: generated.allowedWindows,
          updated_at: Date.now(),
        };
      });
      setHasChanges(true);
      setPendingScheduleLock(true);
      message.success('Schedule generated for all 7 days');
    },
    [scheduleLocked],
  );

  const handleUnlockGeneration = useCallback(async () => {
    if (!botId) return;

    try {
      await updateBotMutation.mutateAsync({
        botId,
        payload: {
          'generation_locks/schedule': false,
        },
      });
      setPendingScheduleLock(false);
      setScheduleLocked(false);
      message.success('Schedule generation unlocked');
    } catch (error) {
      console.error('Failed to unlock schedule generation:', error);
      message.error('Failed to unlock generation');
    }
  }, [botId, updateBotMutation]);

  if (loading)
    return (
      <div className={styles['bot-schedule-loading']}>
        <Spin size="large" />
      </div>
    );
  if (error)
    return (
      <div className={styles['bot-schedule-error']}>
        <Alert message="Error" description={error} type="error" showIcon />
      </div>
    );

  const currentDay = getCurrentDaySchedule();

  return (
    <div className={styles['bot-schedule']}>
      <Card
        title={<span className={styles['schedule-card-title']}>Schedule</span>}
        className={styles['schedule-card']}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
        }}
        extra={
          <BotScheduleActions
            viewMode={viewMode}
            setViewMode={setViewMode}
            handleGenerateSchedule={handleGenerateSchedule}
            loading={loading}
            scheduleLocked={scheduleLocked}
            pendingScheduleLock={pendingScheduleLock}
            handleUnlockGeneration={handleUnlockGeneration}
            handleReset={handleReset}
            hasChanges={hasChanges}
            handleSave={handleSave}
          />
        }
      >
        {hasChanges && (
          <Alert
            message={
              <span className={styles['unsaved-alert-message']}>You have unsaved changes</span>
            }
            type="warning"
            showIcon
            icon={<WarningOutlined style={{ color: 'var(--boxmox-color-brand-warning)' }} />}
            className={styles['unsaved-alert']}
            closable
          />
        )}

        <BotScheduleContent
          schedule={schedule}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          onSwitchToDayView={() => setViewMode('day')}
          viewMode={viewMode}
          handleScheduleChange={handleScheduleChange}
          handleSave={handleSave}
          handleReset={handleReset}
          hasChanges={hasChanges}
          currentDay={currentDay}
          handleSessionChange={handleSessionChange}
          handleAddSession={handleAddSession}
          handleEditSession={handleEditSession}
          handleDeleteSession={handleDeleteSession}
          handleToggleSession={handleToggleSession}
        />

        <SessionEditor
          session={editingSession}
          existingSessions={currentDay.sessions}
          visible={isEditorOpen}
          onSave={handleSaveSession}
          onCancel={() => {
            setIsEditorOpen(false);
            setEditingSession(null);
          }}
        />
      </Card>
    </div>
  );
};
