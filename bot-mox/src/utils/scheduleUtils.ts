import type { BotScheduleV2, ScheduleDay, ScheduleSession, ScheduleValidationError, DayScheduleStats, ScheduleGenerationParams, GeneratedSchedule } from '../types';

const DEFAULT_TIMEZONE = 'Europe/Moscow';

/**
 * Создает пустое расписание для нового бота
 */
export function createEmptySchedule(): BotScheduleV2 {
  const emptyDay = (): ScheduleDay => ({
    enabled: false,
    sessions: []
  });

  return {
    version: 2,
    timezone: DEFAULT_TIMEZONE,
    days: {
      "0": emptyDay(),
      "1": emptyDay(),
      "2": emptyDay(),
      "3": emptyDay(),
      "4": emptyDay(),
      "5": emptyDay(),
      "6": emptyDay()
    },
    updated_at: Date.now()
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
    type: 'active'
  };

  const workDay = (): ScheduleDay => ({
    enabled: true,
    sessions: [{ ...workSession, id: generateSessionId() }]
  });

  return {
    version: 2,
    timezone: DEFAULT_TIMEZONE,
    days: {
      "0": workDay(),   // Sunday
      "1": workDay(),   // Monday
      "2": workDay(),   // Tuesday
      "3": workDay(),   // Wednesday
      "4": workDay(),   // Thursday
      "5": workDay(),   // Friday
      "6": workDay()    // Saturday
    },
    updated_at: Date.now()
  };
}

/**
 * Мигрирует старое расписание (v1) в новый формат (v2)
 * v1: { "0": [{start, end, enabled, profile}], "1": [...], ... }
 * v2: { version: 2, timezone: "...", days: { "0": { enabled, sessions: [...] }, ... } }
 */
export function migrateSchedule(oldSchedule: Record<string, any> | null): BotScheduleV2 {
  // Если нет расписания - создаем дефолтное
  if (!oldSchedule) {
    return createDefaultSchedule();
  }

  // Если уже v2 - проверяем и исправляем структуру
  if (oldSchedule.version === 2 && oldSchedule.days) {
    const schedule = oldSchedule as BotScheduleV2;
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
          sessions.push({
            id: generateSessionId(),
            start: slot.start || '09:00',
            end: slot.end || '17:00',
            enabled: slot.enabled ?? false,
            profile: slot.profile || 'farming',
            type: 'active'
          });
        }
      }
      
      // Считаем день включенным, если хотя бы одна сессия enabled
      const hasEnabledSession = sessions.some(s => s.enabled);
      
      newSchedule.days[dayKey as keyof typeof newSchedule.days] = {
        enabled: hasEnabledSession,
        sessions: sessions
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
        message: `Invalid start time format: ${session.start}`
      });
    }

    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(session.end)) {
      errors.push({
        sessionId: session.id,
        message: `Invalid end time format: ${session.end}`
      });
    }

    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);

    // Проверка длительности (минимум 15 минут)
    // Учитываем переход через полночь: end может быть меньше start
    const crossesMidnight = endMin < startMin;
    const duration = crossesMidnight 
      ? (1440 - startMin) + endMin  // Минут до полуночи + минут с полуночи
      : endMin - startMin;
    
    if (duration < 15) {
      errors.push({
        sessionId: session.id,
        message: `Session must be at least 15 minutes: ${session.start}-${session.end}`
      });
    }

    // Проверка пересечений с предыдущей сессией
    if (i > 0) {
      const prevEnd = timeToMinutes(sorted[i - 1].end);
      if (startMin < prevEnd) {
        errors.push({
          sessionId: session.id,
          message: `Session overlaps with previous: ${sorted[i - 1].start}-${sorted[i - 1].end} and ${session.start}-${session.end}`
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
  excludeId?: string
): boolean {
  const newStart = timeToMinutes(newSession.start);
  const newEnd = timeToMinutes(newSession.end);
  const newCrossesMidnight = newEnd < newStart;

  return existingSessions.some(session => {
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
      return (existingStart >= newStart && existingStart < 1440) || // До полуночи
             (existingEnd > 0 && existingEnd <= newEnd) || // После полуночи
             (existingStart < newStart && existingEnd > newEnd); // Охватывает всю новую
    }

    // Существующая сессия пересекает полночь
    if (existingCrossesMidnight) {
      // Пересекается, если новая начинается до полуночи и заканчивается после начала существующей
      // или начинается после полуночи и до конца существующей
      return (newStart >= existingStart && newStart < 1440) ||
             (newEnd > 0 && newEnd <= existingEnd) ||
             (newStart < existingStart && newEnd > existingEnd);
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
  const sorted = sortSessions(sessionsArray.filter(s => s.enabled));

  let totalActiveMinutes = 0;

  for (const session of sorted) {
    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);
    // Учитываем переход через полночь
    if (endMin < startMin) {
      totalActiveMinutes += (1440 - startMin) + endMin;
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
    activePercentage: Math.round((totalActiveMinutes / 1440) * 100) // 1440 = minutes in a day
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
    month: '2-digit'
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
  botId: string
): Record<string, any> {
  const weekDates = getWeekDates();
  const currentWeek: Record<string, any> = {};

  weekDates.forEach((date, index) => {
    const dayKey = index.toString() as keyof typeof schedule.days;
    const daySchedule = schedule.days[dayKey];
    const dateStr = date.toISOString().split('T')[0];

    const sortedSessions = sortSessions(daySchedule.sessions.filter(s => s.enabled));
    const slots: Array<{ start: string; end: string; action: string; profile?: string }> = [];

    let lastEndMinutes = 0;

    sortedSessions.forEach(session => {
      const startMin = timeToMinutes(session.start);
      const endMin = timeToMinutes(session.end);

      // Если есть перерыв перед сессией - добавляем stop
      if (startMin > lastEndMinutes && lastEndMinutes > 0) {
        slots.push({
          start: minutesToTime(lastEndMinutes),
          end: session.start,
          action: 'stop',
          profile: undefined
        });
      }

      // Добавляем start сессии
      slots.push({
        start: session.start,
        end: session.end,
        action: 'start',
        profile: session.profile
      });

      lastEndMinutes = endMin;
    });

    // Если есть активность - добавляем stop на конец дня
    if (lastEndMinutes > 0 && lastEndMinutes < 1440) {
      slots.push({
        start: minutesToTime(lastEndMinutes),
        end: '23:59',
        action: 'stop',
        profile: undefined
      });
    }

    const stats = calculateDayStats(daySchedule.sessions);

    currentWeek[dateStr] = {
      day_of_week: index,
      enabled: daySchedule.enabled,
      total_active_minutes: stats.totalActiveMinutes,
      slots
    };
  });

  return {
    bot_id: botId,
    schedule_version: schedule.version,
    timezone: schedule.timezone,
    current_week: currentWeek,
    generated_at: Date.now()
  };
}

/**
 * Добавляет сессию в день
 */
export function addSessionToDay(
  day: ScheduleDay,
  session: Omit<ScheduleSession, 'id'>
): ScheduleDay {
  const newSession: ScheduleSession = {
    ...session,
    id: generateSessionId()
  };

  return {
    ...day,
    sessions: sortSessions([...day.sessions, newSession])
  };
}

/**
 * Обновляет сессию в дне
 */
export function updateSessionInDay(
  day: ScheduleDay,
  sessionId: string,
  updates: Partial<Omit<ScheduleSession, 'id'>>
): ScheduleDay {
  return {
    ...day,
    sessions: day.sessions.map(s =>
      s.id === sessionId ? { ...s, ...updates } : s
    )
  };
}

/**
 * Удаляет сессию из дня
 */
export function removeSessionFromDay(
  day: ScheduleDay,
  sessionId: string
): ScheduleDay {
  return {
    ...day,
    sessions: day.sessions.filter(s => s.id !== sessionId)
  };
}

/**
 * Проверяет, есть ли активные сессии в дне
 */
export function hasActiveSessions(day: ScheduleDay): boolean {
  return day.sessions.some(s => s.enabled);
}

/**
 * Получает следующую доступную временную позицию для новой сессии
 */
export function getNextAvailableSlot(
  day: ScheduleDay,
  durationMinutes: number = 150 // 2.5 hours default
): { start: string; end: string } | null {
  const sorted = sortSessions(day.sessions);

  // Если нет сессий - предлагаем 9:00
  if (sorted.length === 0) {
    return { start: '09:00', end: minutesToTime(timeToMinutes('09:00') + durationMinutes) };
  }

  // Ищем промежуток между сессиями
  for (let i = 0; i < sorted.length; i++) {
    const currentEnd = timeToMinutes(sorted[i].end);
    const nextStart = i < sorted.length - 1
      ? timeToMinutes(sorted[i + 1].start)
      : 1440; // End of day

    if (nextStart - currentEnd >= durationMinutes) {
      return {
        start: minutesToTime(currentEnd + 30), // +30 min break
        end: minutesToTime(currentEnd + 30 + durationMinutes)
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
export function validateGenerationParams(params: ScheduleGenerationParams): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const windowStart = timeToMinutes(params.startTime);
  const windowEnd = timeToMinutes(params.endTime);
  const windowDuration = windowEnd - windowStart;
  
  // Проверка временного окна
  if (windowDuration <= 0) {
    errors.push('End time must be after start time');
  }
  
  // Проверка целевого времени активности
  if (params.targetActiveMinutes < 30) {
    errors.push('Target active time must be at least 30 minutes');
  }
  
  if (params.targetActiveMinutes > 1380) {
    errors.push('Target active time cannot exceed 23 hours (1380 minutes)');
  }
  
  if (windowDuration > 0 && params.targetActiveMinutes > windowDuration) {
    errors.push(`Target active time cannot exceed window duration (${windowDuration} minutes)`);
  }
  
  // Проверка минимальной длительности сессии
  if (params.minSessionMinutes < 15) {
    errors.push('Minimum session duration must be at least 15 minutes');
  }
  
  if (params.minSessionMinutes > 240) {
    errors.push('Minimum session duration cannot exceed 4 hours (240 minutes)');
  }
  
  // Проверка минимального перерыва
  if (params.minBreakMinutes < 5) {
    errors.push('Minimum break duration must be at least 5 minutes');
  }
  
  if (params.minBreakMinutes > 120) {
    errors.push('Minimum break duration cannot exceed 2 hours (120 minutes)');
  }
  
  // Проверка рандомного отклонения
  if (params.randomOffsetMinutes < 0) {
    errors.push('Random offset cannot be negative');
  }
  
  if (params.randomOffsetMinutes > 60) {
    errors.push('Random offset cannot exceed 60 minutes');
  }
  
  // Проверка достижимости цели - УЛУЧШЕННАЯ ВЕРСИЯ
  if (windowDuration > 0) {
    // Формула: для N сессий нужно N * minSession + (N-1) * minBreak <= windowDuration
    // Решаем относительно N: N <= (windowDuration + minBreak) / (minSession + minBreak)
    const maxPossibleSessions = Math.floor(
      (windowDuration + params.minBreakMinutes) / 
      (params.minSessionMinutes + params.minBreakMinutes)
    );
    const maxPossibleActiveTime = maxPossibleSessions * params.minSessionMinutes;
    
    if (params.targetActiveMinutes > maxPossibleActiveTime && maxPossibleSessions > 0) {
      const deficit = params.targetActiveMinutes - maxPossibleActiveTime;
      errors.push(
        `IMPOSSIBLE CONFIGURATION: With min session ${params.minSessionMinutes}min and break ${params.minBreakMinutes}min, ` +
        `maximum achievable active time is ${maxPossibleActiveTime}min (${Math.floor(maxPossibleActiveTime / 60)}h ${maxPossibleActiveTime % 60}m). ` +
        `You requested ${params.targetActiveMinutes}min (${Math.floor(params.targetActiveMinutes / 60)}h ${params.targetActiveMinutes % 60}m), ` +
        `which is ${deficit}min more than possible. ` +
        `Solutions: 1) Reduce target by ${deficit}min, 2) Decrease min session to ${Math.floor(windowDuration / Math.ceil(params.targetActiveMinutes / params.minSessionMinutes)) - params.minBreakMinutes}min, ` +
        `3) Decrease break to ${Math.floor((windowDuration - params.targetActiveMinutes) / Math.ceil(params.targetActiveMinutes / params.minSessionMinutes))}min, ` +
        `4) Extend time window by ${Math.ceil((params.targetActiveMinutes - maxPossibleActiveTime) / 60)}h`
      );
    }
    
    // Дополнительная проверка: target не должен превышать 80% окна для комфортной генерации
    const comfortableMaxActive = Math.floor(windowDuration * 0.8);
    if (params.targetActiveMinutes > comfortableMaxActive && errors.length === 0) {
      console.warn(
        `[validateGenerationParams] Warning: Target ${params.targetActiveMinutes}min is ${Math.round((params.targetActiveMinutes / windowDuration) * 100)}% of window. ` +
        `Recommended maximum is ${comfortableMaxActive}min (80%) for stable generation.`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Определяет временные зоны для распределения активности
 * Имитирует реальный игровой паттерн человека
 */
function calculateActivityZones(
  windowStart: number,
  windowEnd: number,
  targetActiveMinutes: number
): Array<{ start: number; end: number; targetMinutes: number; priority: number }> {
  const windowDuration = windowEnd - windowStart;
  const zones: Array<{ start: number; end: number; targetMinutes: number; priority: number }> = [];
  
  // Определяем границы зон (в минутах от начала дня)
  const morningEnd = Math.min(windowEnd, 12 * 60);      // 12:00 или endTime
  const dayEnd = Math.min(windowEnd, 17 * 60);          // 17:00 или endTime
  const eveningEnd = Math.min(windowEnd, 22 * 60);      // 22:00 или endTime
  
  // Утренняя зона (если окно начинается до 12:00)
  if (windowStart < morningEnd) {
    const zoneDuration = morningEnd - windowStart;
    const zoneRatio = zoneDuration / windowDuration;
    // Утром 15-20% активности
    zones.push({
      start: windowStart,
      end: morningEnd,
      targetMinutes: Math.floor(targetActiveMinutes * zoneRatio * 0.85),
      priority: 1
    });
  }
  
  // Дневная зона (12:00-17:00)
  if (morningEnd < dayEnd && windowStart < dayEnd) {
    const zoneStart = Math.max(windowStart, morningEnd);
    const zoneDuration = dayEnd - zoneStart;
    const zoneRatio = zoneDuration / windowDuration;
    // Днём 25-30% активности
    zones.push({
      start: zoneStart,
      end: dayEnd,
      targetMinutes: Math.floor(targetActiveMinutes * zoneRatio * 1.1),
      priority: 2
    });
  }
  
  // Вечерняя зона (17:00-22:00) - пик активности
  if (dayEnd < eveningEnd && windowStart < eveningEnd) {
    const zoneStart = Math.max(windowStart, dayEnd);
    const zoneDuration = eveningEnd - zoneStart;
    const zoneRatio = zoneDuration / windowDuration;
    // Вечером 35-40% активности (пик)
    zones.push({
      start: zoneStart,
      end: eveningEnd,
      targetMinutes: Math.floor(targetActiveMinutes * zoneRatio * 1.25),
      priority: 3
    });
  }
  
  // Ночная зона (после 22:00)
  if (eveningEnd < windowEnd) {
    const zoneStart = Math.max(windowStart, eveningEnd);
    const zoneDuration = windowEnd - zoneStart;
    const zoneRatio = zoneDuration / windowDuration;
    // Ночью 15-20% активности
    zones.push({
      start: zoneStart,
      end: windowEnd,
      targetMinutes: Math.floor(targetActiveMinutes * zoneRatio * 0.9),
      priority: 1
    });
  }
  
  // Нормализуем целевое время чтобы сумма соответствовала targetActiveMinutes
  const totalTarget = zones.reduce((sum, z) => sum + z.targetMinutes, 0);
  console.log(`[DEBUG calculateActivityZones] Before normalization: totalTarget=${totalTarget}, targetActiveMinutes=${targetActiveMinutes}`);
  
  if (totalTarget > 0) {
    const scaleFactor = targetActiveMinutes / totalTarget;
    console.log(`[DEBUG calculateActivityZones] scaleFactor: ${scaleFactor}`);
    zones.forEach(z => {
      const oldTarget = z.targetMinutes;
      z.targetMinutes = Math.floor(z.targetMinutes * scaleFactor);
      console.log(`[DEBUG calculateActivityZones] Zone ${minutesToTime(z.start)}-${minutesToTime(z.end)}: ${oldTarget} -> ${z.targetMinutes} min`);
    });
  }
  
  const filteredZones = zones.filter(z => z.targetMinutes >= 30); // Фильтруем зоны с малым временем
  console.log(`[DEBUG calculateActivityZones] After filtering (>=30min): ${filteredZones.length} zones, total target: ${filteredZones.reduce((sum, z) => sum + z.targetMinutes, 0)} min`);
  
  return filteredZones;
}

/**
 * Генерирует сессии для одной зоны с равномерным распределением
 */
function generateSessionsForZone(
  zone: { start: number; end: number; targetMinutes: number; priority: number },
  minSessionMinutes: number,
  minBreakMinutes: number,
  randomOffsetMinutes: number,
  profile: string
): ScheduleSession[] {
  const sessions: ScheduleSession[] = [];
  const zoneDuration = zone.end - zone.start;
  
  console.log(`[DEBUG generateSessionsForZone] Zone: ${minutesToTime(zone.start)}-${minutesToTime(zone.end)}, target: ${zone.targetMinutes}min, duration: ${zoneDuration}min`);
  
  if (zone.targetMinutes <= 0 || zoneDuration < minSessionMinutes) {
    console.log(`[DEBUG generateSessionsForZone] Skipping zone: target=${zone.targetMinutes}, zoneDuration=${zoneDuration}, minSession=${minSessionMinutes}`);
    return sessions;
  }
  
  // Определяем количество сессий в зоне на основе приоритета
  let numSessions: number;
  const avgSessionDuration = 90 + randomInt(0, 60); // 1.5-2.5 часа в среднем
  
  if (zone.priority === 3) {
    // Вечерний пик - 1-2 длинные сессии
    numSessions = zone.targetMinutes > 180 ? 2 : 1;
  } else if (zone.priority === 2) {
    // День - 2-3 средние сессии
    numSessions = Math.max(2, Math.min(3, Math.floor(zone.targetMinutes / avgSessionDuration)));
  } else {
    // Утро/Ночь - 1-2 сессии
    numSessions = zone.targetMinutes > 120 ? 2 : 1;
  }
  
  console.log(`[DEBUG generateSessionsForZone] numSessions: ${numSessions}, avgSessionDuration: ${avgSessionDuration}`);
  
  // Распределяем время активности между сессиями
  const baseSessionDuration = Math.floor(zone.targetMinutes / numSessions);
  const breakTimeTotal = zoneDuration - zone.targetMinutes;
  const breakBetweenSessions = numSessions > 1 ? Math.floor(breakTimeTotal / (numSessions - 1)) : 0;
  
  console.log(`[DEBUG generateSessionsForZone] baseSessionDuration: ${baseSessionDuration}, breakTimeTotal: ${breakTimeTotal}, breakBetweenSessions: ${breakBetweenSessions}`);
  
  let currentTime = zone.start;
  let remainingActive = zone.targetMinutes;
  let previousSessionEnd = 0;
  
  for (let i = 0; i < numSessions && remainingActive > 0; i++) {
    // Рандомизируем длительность сессии (±20% от базовой)
    const durationVariation = Math.floor(baseSessionDuration * 0.2);
    let sessionDuration = baseSessionDuration + randomInt(-durationVariation, durationVariation);
    sessionDuration = Math.max(minSessionMinutes, Math.min(sessionDuration, remainingActive));
    
    // Рассчитываем минимальное время начала сессии (с учётом перерыва)
    let minSessionStart = zone.start;
    if (i > 0) {
      // Следующая сессия должна начаться не раньше, чем закончилась предыдущая + minBreakMinutes
      minSessionStart = previousSessionEnd + minBreakMinutes;
    }
    
    // Рандомизируем время начала: только вперёд (0 до randomOffsetMinutes), но не раньше minSessionStart
    const startOffset = randomInt(0, randomOffsetMinutes);
    let sessionStart = Math.max(minSessionStart, currentTime + startOffset);
    
    console.log(`[DEBUG generateSessionsForZone] Session ${i + 1}: minSessionStart=${minSessionStart}, currentTime=${currentTime}, startOffset=${startOffset}, sessionStart=${sessionStart}`);
    
    // Убеждаемся, что сессия укладывается в зону
    if (sessionStart + minSessionMinutes > zone.end) {
      console.log(`[DEBUG generateSessionsForZone] Session ${i + 1} skipped: not enough space in zone (start=${sessionStart}, minSession=${minSessionMinutes}, zoneEnd=${zone.end})`);
      break; // Не хватает места для сессии
    }
    
    // Рассчитываем время окончания
    let sessionEnd = sessionStart + sessionDuration;
    
    // Проверяем границы зоны
    if (sessionEnd > zone.end) {
      sessionEnd = zone.end;
      sessionDuration = sessionEnd - sessionStart;
      
      console.log(`[DEBUG generateSessionsForZone] Session ${i + 1} truncated to zone end: ${sessionStart}-${sessionEnd} (${sessionDuration} min)`);
      
      // Если сессия стала слишком короткой, пропускаем
      if (sessionDuration < minSessionMinutes) {
        console.log(`[DEBUG generateSessionsForZone] Session ${i + 1} skipped: too short after truncation (${sessionDuration} < ${minSessionMinutes})`);
        break;
      }
    }
    
    if (sessionDuration >= minSessionMinutes) {
      sessions.push({
        id: generateSessionId(),
        start: minutesToTime(sessionStart),
        end: minutesToTime(sessionEnd),
        enabled: true,
        profile,
        type: 'active'
      });
      
      remainingActive -= sessionDuration;
      previousSessionEnd = sessionEnd;
      
      console.log(`[DEBUG generateSessionsForZone] Session ${i + 1} created: ${minutesToTime(sessionStart)}-${minutesToTime(sessionEnd)} (${sessionDuration} min), remainingActive: ${remainingActive}`);
    }
    
    // Переходим к следующей сессии
    if (i < numSessions - 1 && remainingActive > 0) {
      // Добавляем перерыв: строго minBreakMinutes + рандомное увеличение
      const breakExtension = randomInt(0, Math.min(randomOffsetMinutes, minBreakMinutes));
      currentTime = sessionEnd + minBreakMinutes + breakExtension;
      
      console.log(`[DEBUG generateSessionsForZone] After session ${i + 1}: breakExtension=${breakExtension}, currentTime=${currentTime}, next session needs: ${currentTime + minSessionMinutes}, zone ends: ${zone.end}`);
      
      // Если вышли за границы зоны, прекращаем
      if (currentTime + minSessionMinutes > zone.end) {
        console.log(`[DEBUG generateSessionsForZone] Stopping: next session would exceed zone`);
        break;
      }
    }
  }
  
  console.log(`[DEBUG generateSessionsForZone] Total sessions created: ${sessions.length}, total active time: ${sessions.reduce((sum, s) => sum + timeToMinutes(s.end) - timeToMinutes(s.start), 0)} min`);
  
  return sessions;
}

/**
 * Генерирует расписание для одного дня с имитацией человеческой активности
 */
export function generateDaySchedule(
  params: ScheduleGenerationParams,
  dayIndex?: number
): ScheduleDay {
  const {
    startTime,
    endTime,
    targetActiveMinutes,
    minSessionMinutes,
    minBreakMinutes,
    randomOffsetMinutes,
    profile = 'farming'
  } = params;

  const sessions: ScheduleSession[] = [];
  
  // Конвертируем время в минуты
  const windowStart = timeToMinutes(startTime);
  const windowEnd = timeToMinutes(endTime);
  const windowDuration = windowEnd - windowStart;
  
  // Проверяем валидность параметров
  if (windowDuration <= 0) {
    console.log('[DEBUG] Invalid window duration:', windowDuration);
    return { enabled: false, sessions: [] };
  }
  
  if (targetActiveMinutes > windowDuration) {
    console.log('[DEBUG] Target exceeds window:', targetActiveMinutes, '>', windowDuration);
    return { enabled: false, sessions: [] };
  }

  // Рассчитываем временные зоны
  const zones = calculateActivityZones(windowStart, windowEnd, targetActiveMinutes);
  console.log('[DEBUG] Zones calculated:', zones.map(z => ({ 
    start: minutesToTime(z.start), 
    end: minutesToTime(z.end), 
    target: z.targetMinutes,
    priority: z.priority 
  })));
  
  // Генерируем сессии для каждой зоны
  for (const zone of zones) {
    const zoneSessions = generateSessionsForZone(
      zone,
      minSessionMinutes,
      minBreakMinutes,
      randomOffsetMinutes,
      profile
    );
    console.log(`[DEBUG] Zone ${minutesToTime(zone.start)}-${minutesToTime(zone.end)} (target: ${zone.targetMinutes}min, priority: ${zone.priority}) generated ${zoneSessions.length} sessions:`);
    zoneSessions.forEach((s, idx) => {
      const duration = timeToMinutes(s.end) - timeToMinutes(s.start);
      console.log(`  Session ${idx + 1}: ${s.start}-${s.end} (${duration} min)`);
    });
    sessions.push(...zoneSessions);
  }
  
  // Сортируем сессии по времени начала
  let sortedSessions = sortSessions(sessions);
  
  // Исправляем перерывы между сессиями (особенно между зонами)
  console.log('[DEBUG] Starting break adjustment. minBreakMinutes:', minBreakMinutes);
  
  // Сначала проверяем, есть ли сессии, которые выходят за пределы окна
  for (let i = 0; i < sortedSessions.length; i++) {
    const session = sortedSessions[i];
    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);
    
    if (endMin > windowEnd) {
      console.warn(`[DEBUG] Session ${i + 1} exceeds window: ${session.start}-${session.end}, window ends at ${minutesToTime(windowEnd)}`);
      if (startMin + minSessionMinutes <= windowEnd) {
        // Обрезаем до конца окна
        session.end = minutesToTime(windowEnd);
        console.log(`[DEBUG] Session ${i + 1} truncated to ${session.start}-${session.end}`);
      } else {
        // Удаляем сессию
        console.warn(`[DEBUG] Removing session ${i + 1}: cannot fit in window`);
        sortedSessions.splice(i, 1);
        i--;
      }
    }
  }
  
  // Затем исправляем перерывы между сессиями
  for (let i = 1; i < sortedSessions.length; i++) {
    const prevSession = sortedSessions[i - 1];
    const currSession = sortedSessions[i];
    
    const prevEndMin = timeToMinutes(prevSession.end);
    const currStartMin = timeToMinutes(currSession.start);
    const breakDuration = currStartMin - prevEndMin;
    
    console.log(`[DEBUG] Break ${i}: ${prevSession.end} -> ${currSession.start} = ${breakDuration} min (need >= ${minBreakMinutes})`);
    
    // Если перерыв меньше минимального, сдвигаем текущую сессию
    if (breakDuration < minBreakMinutes) {
      const newStartMin = prevEndMin + minBreakMinutes;
      const sessionDuration = timeToMinutes(currSession.end) - currStartMin;
      const newEndMin = newStartMin + sessionDuration;
      
      console.log(`[DEBUG] Adjusting session ${i}: newStart=${minutesToTime(newStartMin)}, newEnd=${minutesToTime(newEndMin)}, windowEnd=${minutesToTime(windowEnd)}`);
      
      // Проверяем, что сессия укладывается в окно
      if (newEndMin <= windowEnd) {
        currSession.start = minutesToTime(newStartMin);
        currSession.end = minutesToTime(newEndMin);
        console.log(`[DEBUG] Session ${i} adjusted successfully`);
      } else {
        // Если не укладывается - обрезаем сессию или пропускаем
        console.warn(`[DEBUG] Cannot adjust session ${i}: exceeds window. Truncating or removing.`);
        if (newStartMin + minSessionMinutes <= windowEnd) {
          // Обрезаем сессию до конца окна
          currSession.start = minutesToTime(newStartMin);
          currSession.end = minutesToTime(windowEnd);
          console.log(`[DEBUG] Session ${i} truncated to ${currSession.start}-${currSession.end}`);
        } else {
          // Удаляем сессию, если она стала слишком короткой
          console.warn(`[DEBUG] Removing session ${i}: too short after adjustment`);
          sortedSessions.splice(i, 1);
          i--; // Корректируем индекс
        }
      }
    }
  }
  
  // Пересортируем после корректировки
  sortedSessions = sortSessions(sortedSessions);
  
  // Подсчитываем фактическое активное время
  let actualActiveMinutes = 0;
  for (const session of sortedSessions) {
    actualActiveMinutes += timeToMinutes(session.end) - timeToMinutes(session.start);
  }
  
  // DEBUG: Логирование перерывов между сессиями
  console.log('=== Schedule Generation Debug ===');
  console.log('Params:', { startTime, endTime, targetActiveMinutes, minSessionMinutes, minBreakMinutes, randomOffsetMinutes });
  console.log('Window duration:', windowDuration, 'min');
  console.log('Target active:', targetActiveMinutes, 'min');
  console.log('Actual active:', actualActiveMinutes, 'min');
  console.log('Difference:', targetActiveMinutes - actualActiveMinutes, 'min');
  console.log('minBreakMinutes:', minBreakMinutes);
  console.log('Total sessions:', sortedSessions.length);
  
  for (let i = 0; i < sortedSessions.length; i++) {
    const session = sortedSessions[i];
    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);
    
    if (i > 0) {
      const prevEndMin = timeToMinutes(sortedSessions[i - 1].end);
      const breakDuration = startMin - prevEndMin;
      const isValid = breakDuration >= minBreakMinutes;
      
      console.log(`Break ${i}: ${sortedSessions[i - 1].end} -> ${session.start} = ${breakDuration} min ${isValid ? '✓' : '✗ VIOLATION!'}`);
      
      if (!isValid) {
        console.warn(`WARNING: Break too short! Expected >= ${minBreakMinutes}, got ${breakDuration}`);
      }
    }
    
    console.log(`Session ${i + 1}: ${session.start} - ${session.end} (${endMin - startMin} min)`);
  }
  
  // Если не удалось сгенерировать сессии, используем fallback
  if (sortedSessions.length === 0 && targetActiveMinutes > 0) {
    // Fallback: одна большая сессия
    const sessionStart = windowStart + randomInt(0, Math.min(randomOffsetMinutes, windowDuration / 4));
    const sessionEnd = Math.min(windowEnd, sessionStart + targetActiveMinutes);
    
    if (sessionEnd - sessionStart >= minSessionMinutes) {
      sortedSessions.push({
        id: generateSessionId(),
        start: minutesToTime(sessionStart),
        end: minutesToTime(sessionEnd),
        enabled: true,
        profile,
        type: 'active'
      });
      console.log('[DEBUG] Fallback session created:', sortedSessions[0]);
    }
  }

  return {
    enabled: sortedSessions.length > 0,
    sessions: sortedSessions
  };
}

/**
 * Генерирует расписание на основе параметров для всех 7 дней
 */
export function generateSchedule(
  params: ScheduleGenerationParams
): GeneratedSchedule {
  const days: GeneratedSchedule['days'] = {
    "0": { enabled: true, sessions: [] },
    "1": { enabled: true, sessions: [] },
    "2": { enabled: true, sessions: [] },
    "3": { enabled: true, sessions: [] },
    "4": { enabled: true, sessions: [] },
    "5": { enabled: true, sessions: [] },
    "6": { enabled: true, sessions: [] }
  };

  // Генерируем для каждого дня недели
  for (let day = 0; day <= 6; day++) {
    const dayKey = day.toString() as keyof typeof days;
    days[dayKey] = generateDaySchedule(params, day);
  }

  return { days };
}
