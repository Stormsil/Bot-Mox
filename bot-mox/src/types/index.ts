// Bot Types - Оптимизировано для 360 МБ/день трафика
export interface Bot {
  id: string;
  name: string;
  project_id: 'wow_tbc' | 'wow_midnight';
  status: BotStatus;
  character: Character;
  last_seen: number;
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
  start: string;        // HH:MM format
  end: string;          // HH:MM format
  enabled: boolean;
  profile?: string;     // farming, leveling, etc.
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
    "0": ScheduleDay;  // Sunday
    "1": ScheduleDay;  // Monday
    "2": ScheduleDay;  // Tuesday
    "3": ScheduleDay;  // Wednesday
    "4": ScheduleDay;  // Thursday
    "5": ScheduleDay;  // Friday
    "6": ScheduleDay;  // Saturday
  };
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
  /** Время начала фарма (HH:MM) */
  startTime: string;
  /** Время конца фарма (HH:MM) */
  endTime: string;
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

// Result of schedule generation
export interface GeneratedSchedule {
  days: {
    "0": ScheduleDay;
    "1": ScheduleDay;
    "2": ScheduleDay;
    "3": ScheduleDay;
    "4": ScheduleDay;
    "5": ScheduleDay;
    "6": ScheduleDay;
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

// Finance Types - Расширенные типы для финансовой системы

// Тип операции
export type FinanceOperationType = 'income' | 'expense';

// Категории расходов
export type ExpenseCategory =
  | 'subscription_bot'
  | 'subscription_game'
  | 'proxy'
  | 'license'
  | 'other';

// Категории доходов
export type IncomeCategory = 'sale' | 'other';

// Объединенный тип категорий
export type FinanceCategory = ExpenseCategory | IncomeCategory;

// Финансовая операция (транзакция)
export interface FinanceOperation {
  id: string;
  type: FinanceOperationType;
  category: FinanceCategory;
  // Опциональная привязка к боту (null для глобальных операций)
  bot_id: string | null;
  // Привязка к проекту (для продаж золота)
  project_id: 'wow_tbc' | 'wow_midnight' | null;
  description: string;
  amount: number;
  currency: 'USD' | 'gold';
  // Цена золота на момент операции (для продаж)
  gold_price_at_time: number | null;
  // Для продаж золота - количество
  gold_amount?: number;
  date: number; // timestamp операции
  created_at: number; // timestamp создания записи
  updated_at?: number; // timestamp обновления записи
}

// Данные формы для создания/редактирования операции
export interface FinanceOperationFormData {
  type: FinanceOperationType;
  category: FinanceCategory;
  bot_id: string | null;
  project_id: 'wow_tbc' | 'wow_midnight' | null;
  description: string;
  amount: number;
  currency: 'USD' | 'gold';
  gold_price_at_time: number | null;
  gold_amount?: number;
  date: string; // YYYY-MM-DD для формы
}

// Ежедневная статистика
export interface FinanceDailyStats {
  date: string; // YYYY-MM-DD
  total_expenses: number;
  total_revenue: number;
  net_profit: number;
  active_bots: number;
  total_farmed: {
    wow_tbc?: { gold: number };
    wow_midnight?: { gold: number };
  };
}

// История цен на золото
export interface GoldPriceHistory {
  [date: string]: {
    price: number; // цена за 1000 золота
  };
}

// Сводка по финансам
export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  totalGoldSold: number;
  totalGoldFarmed: number;
  averageGoldPrice: number;
}

// Распределение по категориям (для графиков)
export interface CategoryBreakdown {
  category: FinanceCategory;
  amount: number;
  percentage: number;
}

// Данные для графика временного ряда
export interface TimeSeriesData {
  date: string;
  income: number;
  expense: number;
  profit: number;
}

// Фильтры для транзакций
export interface FinanceFilters {
  type: FinanceOperationType | 'all';
  category: FinanceCategory | 'all';
  project_id: 'wow_tbc' | 'wow_midnight' | 'all';
  dateFrom: string | null;
  dateTo: string | null;
}

// Legacy type for backward compatibility
export interface FinanceEntry {
  id: string;
  type: 'income' | 'expense';
  category: 'subscription' | 'game' | 'proxy' | 'sale';
  amount: number;
  description: string;
  timestamp: number;
}

// License Types - Лицензии ботов (v1.5.0 - упрощенная структура)
export interface BotLicense {
  id: string;
  key: string;
  type: string; // Изменено: теперь может быть любой строкой, не только 'sin' | 'other'
  status: 'active' | 'expired' | 'revoked';
  // Массив ID ботов вместо одного (для SIN можно несколько)
  bot_ids: string[];
  // DEPRECATED: bot_names больше не используется, имена берутся из bots.character.name
  // Оставлено для обратной совместимости при миграции
  bot_names?: string[];
  expires_at: number;
  created_at: number;
  updated_at: number;
}

// Для автодополнения названий ботов (DEPRECATED - больше не используется)
// Оставлено для обратной совместимости при миграции
export interface LicenseBotName {
  id: string;
  name: string;
  created_at: number;
}

// Расширенный интерфейс для UI
export interface LicenseWithBots extends BotLicense {
  botDetails?: Array<{
    id: string;
    name: string;
    characterName?: string;
    vmName?: string;
    fullDisplay?: string;
  }>;
}

// Proxy Types - Прокси
export interface Proxy {
  id: string;
  ip: string;
  port: number;
  login: string;
  password: string;
  provider: string;
  country: string;
  country_code?: string;
  type: 'http' | 'socks5';
  status: 'active' | 'expired' | 'banned';
  bot_id: string | null;
  // IPQS Data
  fraud_score: number;
  vpn?: boolean;
  proxy?: boolean;
  tor?: boolean;
  bot_status?: boolean;
  isp?: string;
  organization?: string;
  city?: string;
  region?: string;
  zip_code?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  // Timestamps
  expires_at: number;
  created_at: number;
  updated_at: number;
  last_checked?: number;
}

// IPQS Response Type
export interface IPQSResponse {
  success: boolean;
  message?: string;
  fraud_score: number;
  country_code: string;
  region: string;
  city: string;
  zip_code: string;
  isp: string;
  organization: string;
  timezone: string;
  latitude: number;
  longitude: number;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  bot_status: boolean;
  [key: string]: unknown;
}

// Subscription Types - Подписки
export type SubscriptionType = 'wow' | 'bot' | 'proxy' | 'vpn' | 'other';

// Статусы в БД (active/cancelled - expired вычисляется)
export type SubscriptionDbStatus = 'active' | 'cancelled';

// Вычисляемые статусы для UI
export type ComputedSubscriptionStatus = 'active' | 'expiring_soon' | 'expired';

export interface Subscription {
  id: string;
  type: SubscriptionType;
  // Статус в БД - active или cancelled (expired вычисляется)
  status: SubscriptionDbStatus;
  expires_at: number;
  created_at: number;
  updated_at: number;
  // Обязательная привязка к боту
  bot_id: string;
  // Привязка к аккаунту (для wow подписок - общая на аккаунт)
  account_email?: string;
  // Автопродление (только для wow подписок, для ботов бессмысленно)
  auto_renew?: boolean;
  // Проект (для wow подписок - может быть общей для tbc и midnight)
  project_id?: 'wow_tbc' | 'wow_midnight';
  // Описание/заметки
  notes?: string;
}

// Расширенный интерфейс для UI с вычисляемыми полями
export interface SubscriptionWithDetails extends Subscription {
  // Вычисляемые поля
  computedStatus: ComputedSubscriptionStatus;
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  
  // Данные бота
  botName?: string;
  botCharacter?: string;
  botStatus?: BotStatus;
  botVmName?: string;
}

// Настройки приложения для подписок
export interface SubscriptionSettings {
  // За сколько дней показывать предупреждение
  warning_days: number;
  updated_at: number;
  updated_by?: string;
}

// Данные формы создания/редактирования подписки
export interface SubscriptionFormData {
  bot_id: string;
  type: SubscriptionType;
  expires_at: string; // формат ДД.ММ.ГГГГ
  account_email?: string;
  auto_renew?: boolean;
  project_id?: 'wow_tbc' | 'wow_midnight';
  notes?: string;
}

export interface SubscriptionSummary {
  total_active: number;
  total_expired: number;
  by_type: Record<string, {
    active_count: number;
    expired_count: number;
    total_count: number;
  }>;
  expiring_soon: Record<string, {
    id: string;
    bot_id: string;
    type: string;
    expires_at: number;
    days_remaining: number;
  }>;
  last_updated: number;
}

// API Keys Types
export interface IPQSApiKey {
  api_key: string;
  enabled: boolean;
}

export interface TelegramApiKey {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
}

export interface ApiKeys {
  ipqs: IPQSApiKey;
  telegram: TelegramApiKey;
}

// Proxy Settings Types
export interface ProxySettings {
  auto_check_on_add: boolean;
  fraud_score_threshold: number;
  check_interval_hours: number;
}

// Notification Event Types
export interface NotificationEvents {
  bot_banned: boolean;
  bot_offline: boolean;
  bot_online: boolean;
  level_up: boolean;
  profession_maxed: boolean;
  low_fraud_score: boolean;
  daily_report: boolean;
}

// Extended Notification Settings
export interface NotificationSettings {
  telegram_bot_token?: string; // DEPRECATED
  telegram_chat_id?: string;   // DEPRECATED
  alerts: {
    bot_offline_delay_minutes: number;
    low_roi_threshold: number;
    daily_report_time: string;
  };
  events: NotificationEvents;
}

// System Settings Types
export interface SystemSettings {
  app_name: string;
  theme: 'dark' | 'light';
  currency: 'USD' | 'EUR';
}

export interface OfflineDetectionSettings {
  offline_timeout_sec: number;
}

export interface DataRetentionSettings {
  logs_retention_days: number;
}

export interface ROICalculationSettings {
  include_proxy_cost: boolean;
  include_subscription_cost: boolean;
  include_session_cost: boolean;
  depreciation_days: number;
}

export interface DataExportSettings {
  auto_archive_daily: boolean;
  local_storage_key: string;
}

export interface DevelopmentSettings {
  show_example_data: boolean;
  use_mock_data: boolean;
}

// Main Settings Interface
export interface AppSettings {
  system: SystemSettings;
  offline_detection: OfflineDetectionSettings;
  data_retention: DataRetentionSettings;
  api_keys: ApiKeys;
  proxy: ProxySettings;
  notifications: NotificationSettings;
  roi_calculation: ROICalculationSettings;
  data_export: DataExportSettings;
  development: DevelopmentSettings;
}
