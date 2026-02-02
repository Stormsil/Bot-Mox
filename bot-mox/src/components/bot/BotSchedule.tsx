import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spin, Alert, message } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { ref, onValue, off, set } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { BotScheduleV2, ScheduleDay, ScheduleSession, ScheduleGenerationParams } from '../../types';
import {
  DayTabs,
  SessionList,
  SessionEditor,
  TimelineVisualizer,
  DayStats,
  ScheduleGenerator
} from '../schedule';
import {
  createEmptySchedule,
  migrateSchedule,
  getWeekDates,
  sortSessions,
  generateSchedule
} from '../../utils/scheduleUtils';
import './BotSchedule.css';

interface BotScheduleProps {
  botId: string;
}

export const BotSchedule: React.FC<BotScheduleProps> = ({ botId }) => {
  const [schedule, setSchedule] = useState<BotScheduleV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1); // Monday default
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ScheduleSession | null>(null);

  const weekDates = getWeekDates();

  // Load schedule from Firebase
  useEffect(() => {
    if (!botId) return;

    setLoading(true);
    setError(null);

    const scheduleRef = ref(database, `bots/${botId}/schedule`);

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();

      if (data) {
        // Migrate old format to new
        const migrated = migrateSchedule(data);
        setSchedule(migrated);
      } else {
        // Create default schedule if none exists
        setSchedule(createEmptySchedule());
      }
      setLoading(false);
    };

    const handleError = (err: Error) => {
      console.error('Failed to load schedule:', err);
      setError('Failed to load schedule');
      setLoading(false);
    };

    onValue(scheduleRef, handleValue, handleError);

    return () => {
      off(scheduleRef, 'value', handleValue);
    };
  }, [botId]);

  // Get current day schedule
  const getCurrentDaySchedule = useCallback((): ScheduleDay => {
    if (!schedule) return { enabled: false, sessions: [] };
    return schedule.days[selectedDay.toString() as keyof typeof schedule.days] || { enabled: false, sessions: [] };
  }, [schedule, selectedDay]);

  // Update day in schedule
  const updateDay = useCallback((dayIndex: number, updates: Partial<ScheduleDay>) => {
    setSchedule(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayIndex.toString()]: {
            ...prev.days[dayIndex.toString() as keyof typeof prev.days],
            ...updates
          }
        }
      };
    });
    setHasChanges(true);
  }, []);

  // Handle day toggle
  const handleDayToggle = useCallback((enabled: boolean) => {
    updateDay(selectedDay, { enabled });
  }, [selectedDay, updateDay]);

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
  const handleDeleteSession = useCallback((sessionId: string) => {
    const currentDay = getCurrentDaySchedule();
    // Defensive check: ensure sessions is an array
    const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
    const newSessions = sessionsArray.filter(s => s.id !== sessionId);
    
    // FIX: Update day enabled status based on whether any session remains enabled
    const hasEnabledSessions = newSessions.some(s => s.enabled);
    updateDay(selectedDay, { 
      sessions: sortSessions(newSessions),
      enabled: hasEnabledSessions
    });
  }, [getCurrentDaySchedule, selectedDay, updateDay]);

  // Handle toggle session
  const handleToggleSession = useCallback((sessionId: string, enabled: boolean) => {
    const currentDay = getCurrentDaySchedule();
    // Defensive check: ensure sessions is an array
    const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
    const newSessions = sessionsArray.map(s =>
      s.id === sessionId ? { ...s, enabled } : s
    );
    
    // FIX: Update day enabled status based on whether any session is enabled
    const hasEnabledSessions = newSessions.some(s => s.enabled);
    updateDay(selectedDay, { 
      sessions: sortSessions(newSessions),
      enabled: hasEnabledSessions
    });
  }, [getCurrentDaySchedule, selectedDay, updateDay]);

  // Handle save session
  const handleSaveSession = useCallback((session: ScheduleSession) => {
    const currentDay = getCurrentDaySchedule();
    // Defensive check: ensure sessions is an array
    const sessionsArray = Array.isArray(currentDay.sessions) ? currentDay.sessions : [];
    let newSessions: ScheduleSession[];

    if (editingSession) {
      // Update existing
      newSessions = sessionsArray.map(s =>
        s.id === session.id ? session : s
      );
    } else {
      // Add new
      newSessions = [...sessionsArray, session];
    }

    // FIX: Also set enabled: true when adding a session to ensure day is marked as active
    const hasEnabledSessions = newSessions.some(s => s.enabled);
    updateDay(selectedDay, { 
      sessions: sortSessions(newSessions),
      enabled: hasEnabledSessions || currentDay.enabled
    });
    setIsEditorOpen(false);
    setEditingSession(null);
  }, [editingSession, getCurrentDaySchedule, selectedDay, updateDay]);

  // Handle save to Firebase
  const handleSave = useCallback(async () => {
    if (!schedule || !botId) return;

    try {
      const scheduleRef = ref(database, `bots/${botId}/schedule`);
      await set(scheduleRef, {
        ...schedule,
        updated_at: Date.now()
      });
      setHasChanges(false);
      message.success('Schedule saved successfully');
    } catch (err) {
      console.error('Failed to save schedule:', err);
      message.error('Failed to save schedule');
    }
  }, [schedule, botId]);

  // Handle reset
  const handleReset = useCallback(() => {
    if (!schedule) return;

    // Reload from Firebase
    const scheduleRef = ref(database, `bots/${botId}/schedule`);
    onValue(scheduleRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const migrated = migrateSchedule(data);
        setSchedule(migrated);
      } else {
        setSchedule(createEmptySchedule());
      }
      setHasChanges(false);
    }, { onlyOnce: true });
  }, [botId, schedule]);

  // Handle generate schedule
  const handleGenerateSchedule = useCallback((params: ScheduleGenerationParams) => {
    const generated = generateSchedule(params);
    
    setSchedule(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: generated.days,
        updated_at: Date.now()
      };
    });
    setHasChanges(true);
    message.success('Schedule generated for all 7 days');
  }, []);

  if (loading) {
    return (
      <div className="bot-schedule-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bot-schedule-error">
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  const currentDay = getCurrentDaySchedule();

  return (
    <div className="bot-schedule">
      <Card
        title="Schedule"
        className="schedule-card schedule-card-fixed"
        extra={
          <div className="schedule-actions">
            <ScheduleGenerator 
              onGenerate={handleGenerateSchedule}
              disabled={loading}
            />
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={handleReset}
              disabled={!hasChanges}
            >
              Reset
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              size="small"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save
            </Button>
          </div>
        }
      >
        {hasChanges && (
          <Alert
            message="You have unsaved changes"
            type="warning"
            showIcon
            className="unsaved-alert"
            closable
          />
        )}

        <DayTabs
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
          days={schedule?.days || {}}
        />

        <TimelineVisualizer
          sessions={currentDay.sessions}
        />

        <SessionList
          sessions={currentDay.sessions}
          onAdd={handleAddSession}
          onEdit={handleEditSession}
          onDelete={handleDeleteSession}
          onToggle={handleToggleSession}
        />

        <DayStats sessions={currentDay.sessions} />

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
