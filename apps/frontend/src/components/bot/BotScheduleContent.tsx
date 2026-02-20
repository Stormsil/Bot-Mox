import type React from 'react';
import type { BotScheduleV2, ScheduleDay, ScheduleSession } from '../../types';
import {
  DayStats,
  DayTabs,
  SessionList,
  TimelineVisualizer,
  WeekOverview,
  WeekPanel,
} from '../schedule';
import styles from './BotSchedule.module.css';

interface BotScheduleContentProps {
  schedule: BotScheduleV2 | null;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  onSwitchToDayView: () => void;
  viewMode: 'day' | 'week';
  handleScheduleChange: (next: BotScheduleV2) => void;
  handleSave: () => void;
  handleReset: () => void;
  hasChanges: boolean;
  currentDay: ScheduleDay;
  handleSessionChange: (session: ScheduleSession) => void;
  handleAddSession: () => void;
  handleEditSession: (session: ScheduleSession) => void;
  handleDeleteSession: (sessionId: string) => void;
  handleToggleSession: (sessionId: string, enabled: boolean) => void;
}

export const BotScheduleContent: React.FC<BotScheduleContentProps> = ({
  schedule,
  selectedDay,
  setSelectedDay,
  onSwitchToDayView,
  viewMode,
  handleScheduleChange,
  handleSave,
  handleReset,
  hasChanges,
  currentDay,
  handleSessionChange,
  handleAddSession,
  handleEditSession,
  handleDeleteSession,
  handleToggleSession,
}) => (
  <div className={styles['schedule-content-wrapper']}>
    <WeekPanel schedule={schedule} selectedDay={selectedDay} onDaySelect={setSelectedDay} />

    <div className={styles['schedule-main-content']}>
      <DayTabs selectedDay={selectedDay} onDayChange={setSelectedDay} days={schedule?.days || {}} />

      {viewMode === 'week' ? (
        <WeekOverview
          schedule={schedule}
          onScheduleChange={handleScheduleChange}
          onSave={handleSave}
          onReset={handleReset}
          hasChanges={hasChanges}
          onDaySelect={(day) => {
            setSelectedDay(day);
            onSwitchToDayView();
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
);
