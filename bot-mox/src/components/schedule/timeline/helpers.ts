import type { ScheduleSession } from '../../../types';
import { timeToMinutes } from '../../../utils/scheduleUtils';

export interface AllowedWindow {
  start: string;
  end: string;
}

export interface TimelineSegment {
  session: ScheduleSession;
  startMinutes: number;
  endMinutes: number;
  duration: number;
  isOverlapping: boolean;
  isRestricted: boolean;
  left: number;
  width: number;
}

export interface TimelineZoneSegment {
  left: number;
  width: number;
}

export const HOURS = Array.from({ length: 25 }, (_, i) => i);

const checkOverlap = (session: ScheduleSession, allSessions: ScheduleSession[]) => {
  const s1 = timeToMinutes(session.start);
  const e1 = timeToMinutes(session.end);
  const e1Adj = e1 <= s1 ? e1 + 1440 : e1;

  return allSessions.some((other) => {
    if (other.id === session.id || !other.enabled) return false;
    const s2 = timeToMinutes(other.start);
    const e2 = timeToMinutes(other.end);
    const e2Adj = e2 <= s2 ? e2 + 1440 : e2;
    return Math.max(s1, s2) < Math.min(e1Adj, e2Adj);
  });
};

const checkRestrictedOverlap = (session: ScheduleSession, allowedWindows: AllowedWindow[]) => {
  if (!allowedWindows || allowedWindows.length === 0) return false;

  const s = timeToMinutes(session.start);
  const e = timeToMinutes(session.end);
  const eAdj = e <= s ? e + 1440 : e;

  for (let t = s; t < eAdj; t++) {
    const minuteOfDay = t % 1440;
    const isMinuteAllowed = allowedWindows.some((win) => {
      const winS = timeToMinutes(win.start);
      const winE = timeToMinutes(win.end);
      if (winE <= winS) {
        return minuteOfDay >= winS || minuteOfDay < winE;
      }
      return minuteOfDay >= winS && minuteOfDay < winE;
    });

    if (!isMinuteAllowed) return true;
  }

  return false;
};

export const getSessionSegments = (
  sessions: ScheduleSession[],
  allowedWindows: AllowedWindow[]
): TimelineSegment[] => {
  return sessions.map((session) => {
    const startMinutes = timeToMinutes(session.start);
    const endMinutes = timeToMinutes(session.end);

    let duration: number;
    if (endMinutes <= startMinutes && session.start !== session.end) {
      duration = 1440 - startMinutes + endMinutes;
    } else {
      duration = endMinutes - startMinutes;
    }

    const isOverlapping = checkOverlap(session, sessions);
    const isRestricted = checkRestrictedOverlap(session, allowedWindows);

    return {
      session,
      startMinutes,
      endMinutes,
      duration,
      isOverlapping,
      isRestricted,
      left: (startMinutes / 1440) * 100,
      width: (duration / 1440) * 100,
    };
  });
};

export const getRestrictedSegments = (allowedWindows: AllowedWindow[] = []): TimelineZoneSegment[] => {
  if (!allowedWindows.length) return [];

  const normalized = allowedWindows
    .map((win) => {
      const s = timeToMinutes(win.start);
      const e = timeToMinutes(win.end);
      return { s, e: e <= s ? e + 1440 : e };
    })
    .sort((a, b) => a.s - b.s);

  const restricted: Array<{ s: number; e: number }> = [];
  let lastEnd = 0;

  normalized.forEach((win) => {
    if (win.s > lastEnd) {
      restricted.push({ s: lastEnd, e: win.s });
    }
    lastEnd = Math.max(lastEnd, win.e);
  });

  if (lastEnd < 1440) {
    restricted.push({ s: lastEnd, e: 1440 });
  }

  return restricted.map((segment) => ({
    left: (segment.s / 1440) * 100,
    width: ((segment.e - segment.s) / 1440) * 100,
  }));
};
