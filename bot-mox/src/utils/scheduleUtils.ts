import type {
  BotScheduleV2,
  DayScheduleStats,
  GeneratedSchedule,
  ScheduleDay,
  ScheduleGenerationParams,
  ScheduleSession,
  ScheduleValidationError,
} from '../types';

const DEFAULT_TIMEZONE = 'Europe/Moscow';

type UnknownRecord = Record<string, unknown>;
type LegacyScheduleSlot = Partial<Pick<ScheduleSession, 'start' | 'end' | 'enabled' | 'profile'>> &
  UnknownRecord;

interface LauncherScheduleSlot {
  start: string;
  end: string;
  action: 'start' | 'stop';
  profile?: string;
}

interface LauncherScheduleDay {
  day_of_week: number;
  enabled: boolean;
  total_active_minutes: number;
  slots: LauncherScheduleSlot[];
}

type LauncherScheduleWeek = Record<string, LauncherScheduleDay>;

export interface LauncherSchedulePayload {
  bot_id: string;
  schedule_version: number;
  timezone: string;
  current_week: LauncherScheduleWeek;
  generated_at: number;
}

/**
 * Создает пустое расписание для нового бота
 */
export function createEmptySchedule(): BotScheduleV2 {
  const emptyDay = (): ScheduleDay => ({
    enabled: false,
    sessions: [],
  });

  return {
    version: 2,
    timezone: DEFAULT_TIMEZONE,
    days: {
      '0': emptyDay(),
      '1': emptyDay(),
      '2': emptyDay(),
      '3': emptyDay(),
      '4': emptyDay(),
      '5': emptyDay(),
      '6': emptyDay(),
    },
    updated_at: Date.now(),
  };
}

/**
 * Создает дефолтное расписание (ВСЕ дни рабочие 9-17)
 * Пользователь сам решает какие дни выключить, добавив 0 сессий или отключив день
 */
export function createDefaultSchedule(): BotScheduleV2 {
  const workSession: ScheduleSession = {
    id: generateSessionId(),
    start: '09:00',
    end: '17:00',
    enabled: true,
    profile: 'farming',
    type: 'active',
  };

  const workDay = (): ScheduleDay => ({
    enabled: true,
    sessions: [{ ...workSession, id: generateSessionId() }],
  });

  return {
    version: 2,
    timezone: DEFAULT_TIMEZONE,
    days: {
      '0': workDay(), // Sunday
      '1': workDay(), // Monday
      '2': workDay(), // Tuesday
      '3': workDay(), // Wednesday
      '4': workDay(), // Thursday
      '5': workDay(), // Friday
      '6': workDay(), // Saturday
    },
    updated_at: Date.now(),
  };
}

/**
 * Мигрирует старое расписание (v1) в новый формат (v2)
 * v1: { "0": [{start, end, enabled, profile}], "1": [...], ... }
 * v2: { version: 2, timezone: "...", days: { "0": { enabled, sessions: [...] }, ... } }
 */
export function migrateSchedule(oldSchedule: UnknownRecord | null): BotScheduleV2 {
  // Если нет расписания - создаем дефолтное
  if (!oldSchedule) {
    return createDefaultSchedule();
  }

  // Если уже v2 - проверяем и исправляем структуру
  if (oldSchedule.version === 2 && typeof oldSchedule.days === 'object' && oldSchedule.days) {
    const schedule = oldSchedule as unknown as BotScheduleV2;
    // Проверяем, что у всех дней есть массив sessions
    for (let day = 0; day <= 6; day++) {
      const dayKey = day.toString() as keyof typeof schedule.days;
      const dayData = schedule.days[dayKey];
      if (!dayData.sessions || !Array.isArray(dayData.sessions)) {
        dayData.sessions = [];
      }
    }
    return schedule;
  }

  // Миграция с v1 (плоская структура с массивами для каждого дня)
  const newSchedule = createEmptySchedule();

  for (let day = 0; day <= 6; day++) {
    const dayKey = day.toString();
    const oldDay = oldSchedule[dayKey];

    // v1: oldDay - это массив слотов
    if (oldDay && Array.isArray(oldDay) && oldDay.length > 0) {
      const sessions: ScheduleSession[] = [];

      // Конвертируем все слоты v1 в сессии v2
      for (const slot of oldDay) {
        if (slot && typeof slot === 'object') {
          const slotRecord = slot as LegacyScheduleSlot;
          sessions.push({
            id: generateSessionId(),
            start: slotRecord.start || '09:00',
            end: slotRecord.end || '17:00',
            enabled: slotRecord.enabled ?? false,
            profile: slotRecord.profile || 'farming',
            type: 'active',
          });
        }
      }

      // Считаем день включенным, если хотя бы одна сессия enabled
      const hasEnabledSession = sessions.some((s) => s.enabled);

      newSchedule.days[dayKey as keyof typeof newSchedule.days] = {
        enabled: hasEnabledSession,
        sessions: sessions,
      };
    }
  }

  newSchedule.updated_at = Date.now();
  return newSchedule;
}

/**
 * Генерирует уникальный ID для сессии
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Конвертирует время HH:MM в минуты от начала дня
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Конвертирует минуты в формат HH:MM
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Сортирует сессии по времени начала
 */
export function sortSessions(sessions: ScheduleSession[]): ScheduleSession[] {
  // Defensive check: ensure sessions is an array
  const sessionsArray = Array.isArray(sessions) ? sessions : [];
  return [...sessionsArray].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

/**
 * Валидирует сессии на пересечения и корректность
 */
export function validateSessions(sessions: ScheduleSession[]): ScheduleValidationError[] {
  const errors: ScheduleValidationError[] = [];

  // Defensive check: ensure sessions is an array
  const sessionsArray = Array.isArray(sessions) ? sessions : [];
  // Сортируем для проверки пересечений
  const sorted = sortSessions(sessionsArray);

  for (let i = 0; i < sorted.length; i++) {
    const session = sorted[i];

    // Проверка формата времени
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(session.start)) {
      errors.push({
        sessionId: session.id,
        message: `Invalid start time format: ${session.start}`,
      });
    }

    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(session.end)) {
      errors.push({
        sessionId: session.id,
        message: `Invalid end time format: ${session.end}`,
      });
    }

    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);

    // Проверка длительности (минимум 15 минут)
    // Учитываем переход через полночь: end может быть меньше start
    const crossesMidnight = endMin < startMin;
    const duration = crossesMidnight
      ? 1440 - startMin + endMin // Минут до полуночи + минут с полуночи
      : endMin - startMin;

    if (duration < 15) {
      errors.push({
        sessionId: session.id,
        message: `Session must be at least 15 minutes: ${session.start}-${session.end}`,
      });
    }

    // Проверка пересечений с предыдущей сессией
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

/**
 * Проверяет, пересекается ли новая сессия с существующими
 */
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

    // Обе сессии пересекают полночь - всегда пересекаются
    if (newCrossesMidnight && existingCrossesMidnight) return true;

    // Новая сессия пересекает полночь
    if (newCrossesMidnight) {
      // Пересекается, если существующая начинается до полуночи и заканчивается после начала новой
      // или начинается после полуночи и до конца новой
      return (
        (existingStart >= newStart && existingStart < 1440) || // До полуночи
        (existingEnd > 0 && existingEnd <= newEnd) || // После полуночи
        (existingStart < newStart && existingEnd > newEnd)
      ); // Охватывает всю новую
    }

    // Существующая сессия пересекает полночь
    if (existingCrossesMidnight) {
      // Пересекается, если новая начинается до полуночи и заканчивается после начала существующей
      // или начинается после полуночи и до конца существующей
      return (
        (newStart >= existingStart && newStart < 1440) ||
        (newEnd > 0 && newEnd <= existingEnd) ||
        (newStart < existingStart && newEnd > existingEnd)
      );
    }

    // Обычный случай - ни одна не пересекает полночь
    return (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    );
  });
}

/**
 * Рассчитывает статистику для дня
 */
export function calculateDayStats(sessions: ScheduleSession[]): DayScheduleStats {
  // Defensive check: ensure sessions is an array
  const sessionsArray = Array.isArray(sessions) ? sessions : [];
  const sorted = sortSessions(sessionsArray.filter((s) => s.enabled));

  let totalActiveMinutes = 0;

  for (const session of sorted) {
    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);
    // Учитываем переход через полночь
    if (endMin < startMin) {
      totalActiveMinutes += 1440 - startMin + endMin;
    } else {
      totalActiveMinutes += endMin - startMin;
    }
  }

  // Перерывы - это время между сессиями
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
    activePercentage: Math.round((totalActiveMinutes / 1440) * 100), // 1440 = minutes in a day
  };
}

/**
 * Форматирует минуты в читаемый вид (Xh Ym)
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Получает даты текущей недели (понедельник-воскресенье)
 */
export function getWeekDates(baseDate: Date = new Date()): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay(); // 0 = Sunday, 1 = Monday

  // Находим понедельник текущей недели
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  // Генерируем 7 дней
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }

  return dates;
}

/**
 * Получает даты для карусели на 14 дней (2 недели)
 * Каждый день недели повторяется с тем же расписанием
 */
export function getCarouselDates(baseDate: Date = new Date()): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay(); // 0 = Sunday, 1 = Monday

  // Находим понедельник текущей недели
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  // Генерируем 14 дней (2 недели)
  for (let i = 0; i < 14; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }

  return dates;
}

/**
 * Получает день недели (0-6) для индекса карусели (0-13)
 * Используется для отображения 14 дней с повторяющимся расписанием
 */
export function getCarouselDayIndex(carouselIndex: number): number {
  // Day order: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  return dayOrder[carouselIndex % 7];
}

/**
 * Форматирует дату для отображения (DD.MM)
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Получает название дня недели
 */
export function getDayName(dayIndex: number, short: boolean = true): string {
  const days = short
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex];
}

/**
 * Генерирует JSON для лаунчера
 */
export function generateScheduleForLauncher(
  schedule: BotScheduleV2,
  botId: string,
): LauncherSchedulePayload {
  const weekDates = getWeekDates();
  const currentWeek: LauncherScheduleWeek = {};

  weekDates.forEach((date, index) => {
    const dayKey = index.toString() as keyof typeof schedule.days;
    const daySchedule = schedule.days[dayKey];
    const dateStr = date.toISOString().split('T')[0];

    const sortedSessions = sortSessions(daySchedule.sessions.filter((s) => s.enabled));
    const slots: LauncherScheduleSlot[] = [];

    let lastEndMinutes = 0;

    sortedSessions.forEach((session) => {
      const startMin = timeToMinutes(session.start);
      const endMin = timeToMinutes(session.end);

      // Если есть перерыв перед сессией - добавляем stop
      if (startMin > lastEndMinutes && lastEndMinutes > 0) {
        slots.push({
          start: minutesToTime(lastEndMinutes),
          end: session.start,
          action: 'stop',
          profile: undefined,
        });
      }

      // Добавляем start сессии
      slots.push({
        start: session.start,
        end: session.end,
        action: 'start',
        profile: session.profile,
      });

      lastEndMinutes = endMin;
    });

    // Если есть активность - добавляем stop на конец дня
    if (lastEndMinutes > 0 && lastEndMinutes < 1440) {
      slots.push({
        start: minutesToTime(lastEndMinutes),
        end: '23:59',
        action: 'stop',
        profile: undefined,
      });
    }

    const stats = calculateDayStats(daySchedule.sessions);

    currentWeek[dateStr] = {
      day_of_week: index,
      enabled: daySchedule.enabled,
      total_active_minutes: stats.totalActiveMinutes,
      slots,
    };
  });

  return {
    bot_id: botId,
    schedule_version: schedule.version,
    timezone: schedule.timezone,
    current_week: currentWeek,
    generated_at: Date.now(),
  };
}

/**
 * Добавляет сессию в день
 */
export function addSessionToDay(
  day: ScheduleDay,
  session: Omit<ScheduleSession, 'id'>,
): ScheduleDay {
  const newSession: ScheduleSession = {
    ...session,
    id: generateSessionId(),
  };

  return {
    ...day,
    sessions: sortSessions([...day.sessions, newSession]),
  };
}

/**
 * Обновляет сессию в дне
 */
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

/**
 * Удаляет сессию из дня
 */
export function removeSessionFromDay(day: ScheduleDay, sessionId: string): ScheduleDay {
  return {
    ...day,
    sessions: day.sessions.filter((s) => s.id !== sessionId),
  };
}

/**
 * Проверяет, есть ли активные сессии в дне
 */
export function hasActiveSessions(day: ScheduleDay): boolean {
  return day.sessions.some((s) => s.enabled);
}

/**
 * Получает следующую доступную временную позицию для новой сессии
 */
export function getNextAvailableSlot(
  day: ScheduleDay,
  durationMinutes: number = 150, // 2.5 hours default
): { start: string; end: string } | null {
  const sorted = sortSessions(day.sessions);

  // Если нет сессий - предлагаем 9:00
  if (sorted.length === 0) {
    return { start: '09:00', end: minutesToTime(timeToMinutes('09:00') + durationMinutes) };
  }

  // Ищем промежуток между сессиями
  for (let i = 0; i < sorted.length; i++) {
    const currentEnd = timeToMinutes(sorted[i].end);
    const nextStart = i < sorted.length - 1 ? timeToMinutes(sorted[i + 1].start) : 1440; // End of day

    if (nextStart - currentEnd >= durationMinutes) {
      return {
        start: minutesToTime(currentEnd + 30), // +30 min break
        end: minutesToTime(currentEnd + 30 + durationMinutes),
      };
    }
  }

  return null;
}

/**
 * Генерирует случайное целое число в диапазоне [min, max]
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Валидирует параметры генерации расписания
 */
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

    // Проверка на пересечение окон (упрощенная)
    const w1s = timeToMinutes(params.startTime);
    const w1e = timeToMinutes(params.endTime);
    const w2s = timeToMinutes(params.startTime2);
    const w2e = timeToMinutes(params.endTime2);

    const isOverlap = () => {
      // Просто проверим 1440 минутный массив
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

  // Проверка целевого времени активности
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

  // Проверка минимальной длительности сессии
  if (params.minSessionMinutes < 15) {
    errors.push('Minimum session duration must be at least 15 minutes');
  }

  if (params.minSessionMinutes > 480) {
    errors.push('Minimum session duration cannot exceed 8 hours');
  }

  // Проверка минимального перерыва
  if (params.minBreakMinutes < 5) {
    errors.push('Minimum break duration must be at least 5 minutes');
  }

  // Проверка рандомного отклонения
  if (params.randomOffsetMinutes < 0) {
    errors.push('Random offset cannot be negative');
  }

  // Проверка достижимости цели с учетом перерывов
  if (totalWindowDuration > 0) {
    // Максимально плотный график:
    // Сессии максимально длинные (до 4 часов), перерывы минимальные
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

/**
 * Генерирует расписание для одного дня с имитацией человеческой активности
 */
export function generateDaySchedule(
  params: ScheduleGenerationParams,
  dayIndex?: number,
): ScheduleDay {
  void dayIndex;
  const { targetActiveMinutes, minSessionMinutes, minBreakMinutes, profile = 'farming' } = params;

  // 1. Собираем все доступные временные интервалы (минуты дня)
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

  // Пробуем разные стратегии количества сессий
  const sessionCountsToTry = [
    Math.max(1, Math.round(targetActiveMinutes / 180)), // Сессии по ~3ч
    Math.max(1, Math.round(targetActiveMinutes / 120)), // Сессии по ~2ч
    Math.max(1, Math.round(targetActiveMinutes / 240)), // Сессии по ~4ч
  ].filter((v, i, a) => a.indexOf(v) === i); // Убираем дубли

  for (const numSessions of sessionCountsToTry) {
    // Пытаемся разместить сессии (несколько попыток для каждой стратегии)
    for (let attempt = 0; attempt < 25; attempt++) {
      // 2. Распределяем минуты между сессиями для этой попытки
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

      // Сортируем длительности (сначала длинные)
      const sortedDurations = [...sessionDurations].sort((a, b) => b - a);

      for (const duration of sortedDurations) {
        const possibleStarts: number[] = [];

        // Ищем все возможные точки начала
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
            // Проверяем минимальный перерыв до и после
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
          // Выбираем точку старта
          let start: number;
          // Если места мало (target > 65% от allowed), предпочитаем края для компактности
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

/**
 * Генерирует расписание на основе параметров для всех 7 дней
 */
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

  // Генерируем для каждого дня недели
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
