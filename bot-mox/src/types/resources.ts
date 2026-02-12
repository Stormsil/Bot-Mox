import type { BotStatus } from './core';

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
  bot?: boolean;
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

// Глобальные настройки предупреждений по ресурсам
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

