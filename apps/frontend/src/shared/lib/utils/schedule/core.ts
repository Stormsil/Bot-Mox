import type {
  DayScheduleStats,
  ScheduleDay,
  ScheduleSession,
  ScheduleValidationError,
} from './types';

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function sortSessions(sessions: ScheduleSession[]): ScheduleSession[] {
  const sessionsArray = Array.isArray(sessions) ? sessions : [];
  return [...sessionsArray].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

export function validateSessions(sessions: ScheduleSession[]): ScheduleValidationError[] {
  const errors: ScheduleValidationError[] = [];
  const sessionsArray = Array.isArray(sessions) ? sessions : [];
  const sorted = sortSessions(sessionsArray);

  for (let i = 0; i < sorted.length; i++) {
    const session = sorted[i];

    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(session.start)) {
      errors.push({
        sessionId: session.id,
        message: `Invalid start time format: ${session.start}`,
      });
    }

    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(session.end)) {
      errors.push({ sessionId: session.id, message: `Invalid end time format: ${session.end}` });
    }

    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);
    const crossesMidnight = endMin < startMin;
    const duration = crossesMidnight ? 1440 - startMin + endMin : endMin - startMin;

    if (duration < 15) {
      errors.push({
        sessionId: session.id,
        message: `Session must be at least 15 minutes: ${session.start}-${session.end}`,
      });
    }

    if (i > 0) {
      const prevEnd = timeToMinutes(sorted[i - 1].end);
      if (startMin < prevEnd) {
        errors.push({
          sessionId: session.id,
          message: `Session overlaps with previous: ${sorted[i - 1].start}-${sorted[i - 1].end} and ${session.start}-${session.end}`,
        });
      }
    }
  }

  return errors;
}

export function hasOverlap(
  newSession: ScheduleSession,
  existingSessions: ScheduleSession[],
  excludeId?: string,
): boolean {
  const newStart = timeToMinutes(newSession.start);
  const newEnd = timeToMinutes(newSession.end);
  const newCrossesMidnight = newEnd < newStart;

  return existingSessions.some((session) => {
    if (session.id === excludeId) return false;

    const existingStart = timeToMinutes(session.start);
    const existingEnd = timeToMinutes(session.end);
    const existingCrossesMidnight = existingEnd < existingStart;

    if (newCrossesMidnight && existingCrossesMidnight) return true;

    if (newCrossesMidnight) {
      return (
        (existingStart >= newStart && existingStart < 1440) ||
        (existingEnd > 0 && existingEnd <= newEnd) ||
        (existingStart < newStart && existingEnd > newEnd)
      );
    }

    if (existingCrossesMidnight) {
      return (
        (newStart >= existingStart && newStart < 1440) ||
        (newEnd > 0 && newEnd <= existingEnd) ||
        (newStart < existingStart && newEnd > existingEnd)
      );
    }

    return (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    );
  });
}

export function calculateDayStats(sessions: ScheduleSession[]): DayScheduleStats {
  const sessionsArray = Array.isArray(sessions) ? sessions : [];
  const sorted = sortSessions(sessionsArray.filter((s) => s.enabled));

  let totalActiveMinutes = 0;
  for (const session of sorted) {
    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);
    if (endMin < startMin) {
      totalActiveMinutes += 1440 - startMin + endMin;
    } else {
      totalActiveMinutes += endMin - startMin;
    }
  }

  let totalBreakMinutes = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = timeToMinutes(sorted[i - 1].end);
    const currStart = timeToMinutes(sorted[i].start);
    totalBreakMinutes += currStart - prevEnd;
  }

  return {
    totalActiveMinutes,
    totalBreakMinutes,
    sessionCount: sorted.length,
    activePercentage: Math.round((totalActiveMinutes / 1440) * 100),
  };
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function addSessionToDay(
  day: ScheduleDay,
  session: Omit<ScheduleSession, 'id'>,
): ScheduleDay {
  const newSession: ScheduleSession = { ...session, id: generateSessionId() };
  return {
    ...day,
    sessions: sortSessions([...day.sessions, newSession]),
  };
}

export function updateSessionInDay(
  day: ScheduleDay,
  sessionId: string,
  updates: Partial<Omit<ScheduleSession, 'id'>>,
): ScheduleDay {
  return {
    ...day,
    sessions: day.sessions.map((s) => (s.id === sessionId ? { ...s, ...updates } : s)),
  };
}

export function removeSessionFromDay(day: ScheduleDay, sessionId: string): ScheduleDay {
  return {
    ...day,
    sessions: day.sessions.filter((s) => s.id !== sessionId),
  };
}

export function hasActiveSessions(day: ScheduleDay): boolean {
  return day.sessions.some((s) => s.enabled);
}

export function getNextAvailableSlot(
  day: ScheduleDay,
  durationMinutes: number = 150,
): { start: string; end: string } | null {
  const sorted = sortSessions(day.sessions);

  if (sorted.length === 0) {
    return { start: '09:00', end: minutesToTime(timeToMinutes('09:00') + durationMinutes) };
  }

  for (let i = 0; i < sorted.length; i++) {
    const currentEnd = timeToMinutes(sorted[i].end);
    const nextStart = i < sorted.length - 1 ? timeToMinutes(sorted[i + 1].start) : 1440;

    if (nextStart - currentEnd >= durationMinutes) {
      return {
        start: minutesToTime(currentEnd + 30),
        end: minutesToTime(currentEnd + 30 + durationMinutes),
      };
    }
  }

  return null;
}
