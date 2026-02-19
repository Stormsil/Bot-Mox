import type { BotLifecycle } from './botLifecycle';

// Bot Types - Оптимизировано для 360 МБ/день трафика
export interface Bot {
  id: string;
  name: string;
  project_id: 'wow_tbc' | 'wow_midnight';
  status: BotStatus;
  character: Character;
  last_seen: number;
  generation_locks?: GenerationLocks;
  // Lifecycle tracking
  lifecycle?: BotLifecycle;
}

export interface GenerationLocks {
  character_name?: boolean;
  account_email?: boolean;
  account_password?: boolean;
  person_data?: boolean;
  schedule?: boolean;
}

export type BotStatus = 'offline' | 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';

export interface Character {
  name: string;
  level: number;
  class: string;
  race: string;
  server: string;
  faction: FactionType;
  inventory?: InventoryItem[];
}

// Reference Data Types - Справочники
export type FactionType = 'alliance' | 'horde';

export interface GameServer {
  id: string;
  name: string;
  region: string;
  type: 'pve' | 'pvp' | 'rp' | 'rppvp';
}

export interface GameRace {
  id: string;
  name: string;
  faction: FactionType;
  available_classes: string[];
  icon?: string;
}

export interface GameClass {
  id: string;
  name: string;
  role: 'tank' | 'healer' | 'dps';
  resource: 'mana' | 'rage' | 'energy' | 'runic';
}

export interface GameFaction {
  id: FactionType;
  name: string;
  icon: string;
}

// Project with Reference Data - Проект со справочниками
export interface ProjectWithReferenceData extends Project {
  referenceData: {
    servers: Record<string, GameServer>;
    races: Record<string, GameRace>;
    classes: Record<string, GameClass>;
    factions: Record<string, GameFaction>;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  quality: 'common' | 'uncommon' | 'rare' | 'epic';
}

// Account Types - Данные аккаунта игры
export interface AccountData {
  email: string;
  password: string;
  registration_date: number;
}

// Person Types - Данные персоны
export interface PersonData {
  first_name: string;
  last_name: string;
  birth_date: string;
  country: string;
  city: string;
  address: string;
  zip: string;
}

// Leveling Types - Прогресс прокачки уровня
export interface LevelingProgress {
  current_level: number;
  current_xp: number;
  max_xp: number;
  xp_per_hour: number;
  estimated_time_to_level: number;
  location: string;
}

// Profession Types - Прогресс профессии
export interface ProfessionProgress {
  name: string;
  level: number;
  max_level: number;
  skill_points: number;
  max_skill_points: number;
}

// Schedule Types - Расписание работы (Legacy v1)
export interface ScheduleEntry {
  id: string;
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start_time: string;
  end_time: string;
  enabled: boolean;
}

// Schedule Types v2 - Новая система с сессиями
export interface ScheduleSession {
  id: string;
  start: string; // HH:MM format
  end: string; // HH:MM format
  enabled: boolean;
  profile?: string; // farming, leveling, etc.
  type: 'active' | 'break';
}

export interface ScheduleDay {
  enabled: boolean;
  sessions: ScheduleSession[];
}

export interface BotScheduleV2 {
  version: number;
  timezone: string;
  days: {
    '0': ScheduleDay; // Sunday
    '1': ScheduleDay; // Monday
    '2': ScheduleDay; // Tuesday
    '3': ScheduleDay; // Wednesday
    '4': ScheduleDay; // Thursday
    '5': ScheduleDay; // Friday
    '6': ScheduleDay; // Saturday
  };
  allowedWindows?: Array<{ start: string; end: string }>;
  updated_at: number;
}

// Schedule validation errors
export interface ScheduleValidationError {
  sessionId: string;
  message: string;
}

// Schedule stats for a day
export interface DayScheduleStats {
  totalActiveMinutes: number;
  totalBreakMinutes: number;
  sessionCount: number;
  activePercentage: number;
}

// Schedule Generation Types
export interface ScheduleGenerationParams {
  /** Время начала фарма (HH:MM) - Окно 1 */
  startTime: string;
  /** Время конца фарма (HH:MM) - Окно 1 */
  endTime: string;
  /** Использовать второе окно времени */
  useSecondWindow?: boolean;
  /** Время начала фарма (HH:MM) - Окно 2 */
  startTime2?: string;
  /** Время конца фарма (HH:MM) - Окно 2 */
  endTime2?: string;
  /** Целевое время активности в дне (минуты) */
  targetActiveMinutes: number;
  /** Минимальное время активной сессии (минуты) */
  minSessionMinutes: number;
  /** Минимальное время отдыха между сессиями (минуты) */
  minBreakMinutes: number;
  /** Рандомное отклонение ± (минуты) */
  randomOffsetMinutes: number;
  /** Профиль для сессий (опционально) */
  profile?: string;
}

// Schedule Template
export interface ScheduleTemplate {
  id: string;
  name: string;
  params: ScheduleGenerationParams;
  created_at: number;
  updated_at: number;
}

// Result of schedule generation
export interface GeneratedSchedule {
  days: {
    '0': ScheduleDay;
    '1': ScheduleDay;
    '2': ScheduleDay;
    '3': ScheduleDay;
    '4': ScheduleDay;
    '5': ScheduleDay;
    '6': ScheduleDay;
  };
}

// Note Types - Заметки с чекбоксами
export interface Note {
  id: string;
  text: string;
  completed: boolean;
  created_at: number;
}

// Log Types - Только важные события
export type LogEventType = 'ban' | 'level_up' | 'death';

export interface LogEntry {
  id: string;
  bot_id: string;
  type: LogEventType;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

// Project Types - Минимальная информация
export interface Project {
  id: 'wow_tbc' | 'wow_midnight';
  name: string;
  game: string;
  max_level: number;
}

// Dashboard Types - Только необходимые метрики
export interface DashboardMetrics {
  totalBots: number;
  activeBots: number;
  levelingBots: number;
  farmingBots: number;
  bannedBots: number;
}

// User Types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'operator';
}
