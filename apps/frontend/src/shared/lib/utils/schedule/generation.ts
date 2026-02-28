import { generateSessionId, minutesToTime, sortSessions, timeToMinutes } from './core';
import type {
  GeneratedSchedule,
  ScheduleDay,
  ScheduleGenerationParams,
  ScheduleSession,
} from './types';

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function validateGenerationParams(params: ScheduleGenerationParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const getWindowDuration = (start: string, end: string) => {
    const s = timeToMinutes(start);
    const e = timeToMinutes(end);
    return e < s ? 1440 - s + e : e - s;
  };

  const window1Duration = getWindowDuration(params.startTime, params.endTime);

  if (window1Duration <= 0) {
    errors.push('Window 1: End time must be after start time');
  }

  let totalWindowDuration = window1Duration;

  if (params.useSecondWindow && params.startTime2 && params.endTime2) {
    const window2Duration = getWindowDuration(params.startTime2, params.endTime2);

    if (window2Duration <= 0) {
      errors.push('Window 2: End time must be after start time');
    }

    const w1s = timeToMinutes(params.startTime);
    const w1e = timeToMinutes(params.endTime);
    const w2s = timeToMinutes(params.startTime2);
    const w2e = timeToMinutes(params.endTime2);

    const isOverlap = () => {
      const minutes = new Array(1440).fill(false);
      const fill = (s: number, e: number) => {
        let curr = s;
        while (curr !== e) {
          minutes[curr] = true;
          curr = (curr + 1) % 1440;
        }
      };
      fill(w1s, w1e);
      let overlap = false;
      let curr = w2s;
      while (curr !== w2e) {
        if (minutes[curr]) overlap = true;
        curr = (curr + 1) % 1440;
      }
      return overlap;
    };

    if (isOverlap()) {
      errors.push('Windows must not overlap');
    }

    totalWindowDuration += window2Duration;
  }

  if (params.targetActiveMinutes < 30) {
    errors.push('Target active time must be at least 30 minutes');
  }
  if (params.targetActiveMinutes > 1380) {
    errors.push('Target active time cannot exceed 23 hours (1380 minutes)');
  }
  if (totalWindowDuration > 0 && params.targetActiveMinutes > totalWindowDuration) {
    errors.push(
      `Target active time cannot exceed total window duration (${totalWindowDuration} minutes)`,
    );
  }

  if (params.minSessionMinutes < 15) {
    errors.push('Minimum session duration must be at least 15 minutes');
  }
  if (params.minSessionMinutes > 480) {
    errors.push('Minimum session duration cannot exceed 8 hours');
  }

  if (params.minBreakMinutes < 5) {
    errors.push('Minimum break duration must be at least 5 minutes');
  }
  if (params.randomOffsetMinutes < 0) {
    errors.push('Random offset cannot be negative');
  }

  if (totalWindowDuration > 0) {
    const maxPossibleSessions = Math.max(
      1,
      Math.floor(
        (totalWindowDuration + params.minBreakMinutes) /
          (params.minSessionMinutes + params.minBreakMinutes),
      ),
    );
    const maxPossibleActiveTime =
      totalWindowDuration - (maxPossibleSessions - 1) * params.minBreakMinutes;

    if (params.targetActiveMinutes > maxPossibleActiveTime) {
      errors.push(
        `Target active time (${params.targetActiveMinutes}min) might be unreachable with current min session/break settings. ` +
          `Max possible is ~${maxPossibleActiveTime}min.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function generateDaySchedule(
  params: ScheduleGenerationParams,
  dayIndex?: number,
): ScheduleDay {
  void dayIndex;
  const { targetActiveMinutes, minSessionMinutes, minBreakMinutes, profile = 'farming' } = params;

  const isTimeAllowed = new Array(1440).fill(false);
  const markAllowed = (start: string, end: string) => {
    let curr = timeToMinutes(start);
    const stop = timeToMinutes(end);
    if (curr === stop) return;
    while (curr !== stop) {
      isTimeAllowed[curr] = true;
      curr = (curr + 1) % 1440;
    }
  };

  markAllowed(params.startTime, params.endTime);
  if (params.useSecondWindow && params.startTime2 && params.endTime2) {
    markAllowed(params.startTime2, params.endTime2);
  }

  const totalAllowedMinutes = isTimeAllowed.filter((t) => t).length;
  if (totalAllowedMinutes < targetActiveMinutes) {
    return { enabled: false, sessions: [] };
  }

  let finalSessions: ScheduleSession[] = [];
  let bestActiveTime = 0;

  const sessionCountsToTry = [
    Math.max(1, Math.round(targetActiveMinutes / 180)),
    Math.max(1, Math.round(targetActiveMinutes / 120)),
    Math.max(1, Math.round(targetActiveMinutes / 240)),
  ].filter((v, i, a) => a.indexOf(v) === i);

  for (const numSessions of sessionCountsToTry) {
    for (let attempt = 0; attempt < 25; attempt++) {
      let remainingMinutes = targetActiveMinutes;
      const sessionDurations: number[] = [];
      for (let i = 0; i < numSessions; i++) {
        if (i === numSessions - 1) {
          sessionDurations.push(remainingMinutes);
        } else {
          const duration = Math.max(
            minSessionMinutes,
            Math.floor(remainingMinutes / (numSessions - i)) + randomInt(-40, 40),
          );
          const finalDuration = Math.min(
            duration,
            remainingMinutes - (numSessions - i - 1) * minSessionMinutes,
          );
          sessionDurations.push(finalDuration);
          remainingMinutes -= finalDuration;
        }
      }

      const currentSessions: ScheduleSession[] = [];
      const occupied = new Array(1440).fill(false);
      let success = true;

      const sortedDurations = [...sessionDurations].sort((a, b) => b - a);
      for (const duration of sortedDurations) {
        const possibleStarts: number[] = [];

        for (let s = 0; s < 1440; s++) {
          let canPlace = true;
          for (let m = 0; m < duration; m++) {
            const t = (s + m) % 1440;
            if (!isTimeAllowed[t] || occupied[t]) {
              canPlace = false;
              break;
            }
          }

          if (canPlace) {
            for (let b = 1; b <= minBreakMinutes; b++) {
              if (occupied[(s - b + 1440) % 1440] || occupied[(s + duration + b - 1) % 1440]) {
                canPlace = false;
                break;
              }
            }
          }

          if (canPlace) possibleStarts.push(s);
        }

        if (possibleStarts.length > 0) {
          let start: number;
          if (targetActiveMinutes / totalAllowedMinutes > 0.65) {
            start =
              Math.random() > 0.5 ? possibleStarts[0] : possibleStarts[possibleStarts.length - 1];
          } else {
            start = possibleStarts[randomInt(0, possibleStarts.length - 1)];
          }

          for (let m = 0; m < duration; m++) {
            occupied[(start + m) % 1440] = true;
          }

          currentSessions.push({
            id: generateSessionId(),
            start: minutesToTime(start),
            end: minutesToTime((start + duration) % 1440),
            enabled: true,
            profile,
            type: 'active',
          });
        } else {
          success = false;
          break;
        }
      }

      const totalActive = currentSessions.reduce((sum, s) => {
        const sMin = timeToMinutes(s.start);
        const eMin = timeToMinutes(s.end);
        const d = eMin - sMin;
        return sum + (d <= 0 ? d + 1440 : d);
      }, 0);

      if (totalActive > bestActiveTime) {
        bestActiveTime = totalActive;
        finalSessions = currentSessions;
      }

      if (success && totalActive >= targetActiveMinutes) {
        return { enabled: true, sessions: sortSessions(finalSessions) };
      }
    }
  }

  return {
    enabled: finalSessions.length > 0,
    sessions: sortSessions(finalSessions),
  };
}

export function generateSchedule(
  params: ScheduleGenerationParams,
): GeneratedSchedule & { allowedWindows: Array<{ start: string; end: string }> } {
  const days: GeneratedSchedule['days'] = {
    '0': { enabled: true, sessions: [] },
    '1': { enabled: true, sessions: [] },
    '2': { enabled: true, sessions: [] },
    '3': { enabled: true, sessions: [] },
    '4': { enabled: true, sessions: [] },
    '5': { enabled: true, sessions: [] },
    '6': { enabled: true, sessions: [] },
  };

  for (let day = 0; day <= 6; day++) {
    const dayKey = day.toString() as keyof typeof days;
    days[dayKey] = generateDaySchedule(params, day);
  }

  const allowedWindows = [];
  allowedWindows.push({ start: params.startTime, end: params.endTime });
  if (params.useSecondWindow && params.startTime2 && params.endTime2) {
    allowedWindows.push({ start: params.startTime2, end: params.endTime2 });
  }

  return { days, allowedWindows };
}
