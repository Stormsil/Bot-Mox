import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spin, Alert, message } from 'antd';
import { SaveOutlined, ReloadOutlined, CalendarOutlined, UnlockOutlined, WarningOutlined } from '@ant-design/icons';
import { apiPatch } from '../../services/apiClient';
import { subscribeBotById } from '../../services/botsApiService';
import type { BotScheduleV2, ScheduleDay, ScheduleSession, ScheduleGenerationParams } from '../../types';
import {
  DayTabs,
  SessionList,
  SessionEditor,
  TimelineVisualizer,
  DayStats,
  ScheduleGenerator,
  WeekPanel,
  WeekOverview
} from '../schedule';
import {
  createEmptySchedule,
  generateSchedule,
  migrateSchedule,
  sortSessions,
} from '../../utils/scheduleUtils';
import {
  DayStats,
  DayTabs,
  ScheduleGenerator,
  SessionEditor,
  SessionList,
  TimelineVisualizer,
  WeekOverview,
  WeekPanel,
} from '../schedule';
import styles from './BotSchedule.module.css';

interface BotScheduleProps {
  botId: string;
}

export const BotSchedule: React.FC<BotScheduleProps> = ({ botId }) => {
  const [schedule, setSchedule] = useState<BotScheduleV2 | null>(null);
  const [serverSchedule, setServerSchedule] = useState<BotScheduleV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1); // Monday default
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day'); // 'day' or 'week' overview
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ScheduleSession | null>(null);
  const [scheduleLocked, setScheduleLocked] = useState(false);
  const [pendingScheduleLock, setPendingScheduleLock] = useState(false);
  const botQuery = useBotByIdQuery(botId);
  const updateBotMutation = useUpdateBotMutation();

  // Load schedule from shared query cache.
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

  // Get current day schedule
  const getCurrentDaySchedule = useCallback((): ScheduleDay => {
    if (!schedule) return { enabled: false, sessions: [] };
    return (
      schedule.days[selectedDay.toString() as keyof typeof schedule.days] || {
        enabled: false,
        sessions: [],
      }
    );
  }, [schedule, selectedDay]);

  // Update day in schedule
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

  // Handle schedule change from WeekOverview
  const handleScheduleChange = useCallback((newSchedule: BotScheduleV2) => {
    setSchedule(newSchedule);
    setHasChanges(true);
  }, []);

  // Handle add session
  const handleAddSession = useCallback(() => {
    setEditingSession(null);
    setIsEditorOpen(true);
  }, []);

  // Handle edit session
  const handleEditSession = useCallback((session: ScheduleSession) => {
    setEditingSession(session);
    setIsEditorOpen(true);
  }, []);

  // Handle delete session
  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      const currentDay = getCurrentDaySchedule();
      // Defensive check: ensure sessions is an array
      const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
      const newSessions = sessionsArray.filter((s) => s.id !== sessionId);

      // FIX: Update day enabled status based on whether any session remains enabled
      const hasEnabledSessions = newSessions.some((s) => s.enabled);
      updateDay(selectedDay, {
        sessions: sortSessions(newSessions),
        enabled: hasEnabledSessions,
      });
    },
    [getCurrentDaySchedule, selectedDay, updateDay],
  );

  // Handle toggle session
  const handleToggleSession = useCallback(
    (sessionId: string, enabled: boolean) => {
      const currentDay = getCurrentDaySchedule();
      // Defensive check: ensure sessions is an array
      const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
      const newSessions = sessionsArray.map((s) => (s.id === sessionId ? { ...s, enabled } : s));

      // FIX: Update day enabled status based on whether any session is enabled
      const hasEnabledSessions = newSessions.some((s) => s.enabled);
      updateDay(selectedDay, {
        sessions: sortSessions(newSessions),
        enabled: hasEnabledSessions,
      });
    },
    [getCurrentDaySchedule, selectedDay, updateDay],
  );

  // Handle save session
  const handleSaveSession = useCallback(
    (session: ScheduleSession) => {
      const currentDay = getCurrentDaySchedule();
      // Defensive check: ensure sessions is an array
      const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
      let newSessions: ScheduleSession[];

      if (editingSession) {
        // Update existing
        newSessions = sessionsArray.map((s) => (s.id === session.id ? session : s));
      } else {
        // Add new
        newSessions = [...sessionsArray, session];
      }

      // FIX: Also set enabled: true when adding a session to ensure day is marked as active
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

  // Handle session change from timeline drag-and-drop
  const handleSessionChange = useCallback(
    (session: ScheduleSession) => {
      const currentDay = getCurrentDaySchedule();
      // Defensive check: ensure sessions is an array
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

  if (loading) {
    return (
      <div className={styles['bot-schedule-loading']}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles['bot-schedule-error']}>
        <Alert message="Error" description={error} type="error" showIcon />
      </div>
    );
  }

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
        }
      >
        {hasChanges && (
          <Alert
            message={<span className={styles['unsaved-alert-message']}>You have unsaved changes</span>}
            type="warning"
            showIcon
            icon={<WarningOutlined style={{ color: 'var(--boxmox-color-brand-warning)' }} />}
            className={styles['unsaved-alert']}
            closable
          />
        )}

        <div className={styles['schedule-content-wrapper']}>
          <WeekPanel schedule={schedule} selectedDay={selectedDay} onDaySelect={setSelectedDay} />

          <div className={styles['schedule-main-content']}>
            <DayTabs
              selectedDay={selectedDay}
              onDayChange={setSelectedDay}
              days={schedule?.days || {}}
            />

            {viewMode === 'week' ? (
              <WeekOverview
                schedule={schedule}
                onScheduleChange={handleScheduleChange}
                onSave={handleSave}
                onReset={handleReset}
                hasChanges={hasChanges}
                onDaySelect={(day) => {
                  setSelectedDay(day);
                  setViewMode('day');
                }}
              />
            ) : (
              <>
                <TimelineVisualizer
                  sessions={currentDay.sessions}
                  allowedWindows={schedule?.allowedWindows}
                  onSessionChange={handleSessionChange}
                />

                <SessionList
                  sessions={currentDay.sessions}
                  onAdd={handleAddSession}
                  onEdit={handleEditSession}
                  onDelete={handleDeleteSession}
                  onToggle={handleToggleSession}
                  className={styles['panel-block']}
                />

                <DayStats sessions={currentDay.sessions} className={styles['panel-block']} />
              </>
            )}
          </div>
        </div>

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
