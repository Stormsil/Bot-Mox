// Finance Types - Расширенные типы для финансовой системы

// Тип операции
export type FinanceOperationType = 'income' | 'expense';

// Категории расходов
export type ExpenseCategory = 'subscription_game' | 'proxy' | 'bot_license' | 'other';

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

// История цен на золото (извлекается из операций)
export interface GoldPriceHistoryEntry {
  date: string; // YYYY-MM-DD
  price: number; // цена за 1000 золота
  project_id: 'wow_tbc' | 'wow_midnight';
}

// @deprecated - больше не используется, цены хранятся в operations.gold_price_at_time
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
  cumulativeProfit: number;
  dailyProfit: number;
}

// Фильтры для транзакций
export interface FinanceFilters {
  type: FinanceOperationType | 'all';
  category: FinanceCategory | 'all';
  project_id: 'wow_tbc' | 'wow_midnight' | 'all';
  dateFrom: string | null;
  dateTo: string | null;
}

// Compatibility type for backward compatibility
export interface FinanceEntry {
  id: string;
  type: 'income' | 'expense';
  category: 'subscription' | 'game' | 'proxy' | 'sale';
  amount: number;
  description: string;
  timestamp: number;
}
