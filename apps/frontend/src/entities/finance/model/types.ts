// Finance Types - domain model for finance entity

export type FinanceOperationType = 'income' | 'expense';

export type ExpenseCategory = 'subscription_game' | 'proxy' | 'bot_license' | 'other';
export type IncomeCategory = 'sale' | 'other';
export type FinanceCategory = ExpenseCategory | IncomeCategory;

export interface FinanceOperation {
  id: string;
  type: FinanceOperationType;
  category: FinanceCategory;
  bot_id: string | null;
  project_id: 'wow_tbc' | 'wow_midnight' | null;
  description: string;
  amount: number;
  currency: 'USD' | 'gold';
  gold_price_at_time: number | null;
  gold_amount?: number;
  date: number;
  created_at: number;
  updated_at?: number;
}

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
  date: string;
}

export interface FinanceDailyStats {
  date: string;
  total_expenses: number;
  total_revenue: number;
  net_profit: number;
  active_bots: number;
  total_farmed: {
    wow_tbc?: { gold: number };
    wow_midnight?: { gold: number };
  };
}

export interface GoldPriceHistoryEntry {
  date: string;
  price: number;
  project_id: 'wow_tbc' | 'wow_midnight';
}

/**
 * @deprecated Prices are stored in operations.gold_price_at_time.
 */
export interface GoldPriceHistory {
  [date: string]: {
    price: number;
  };
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  totalGoldSold: number;
  totalGoldFarmed: number;
  averageGoldPrice: number;
}

export interface CategoryBreakdown {
  category: FinanceCategory;
  amount: number;
  percentage: number;
}

export interface TimeSeriesData {
  date: string;
  income: number;
  expense: number;
  profit: number;
  cumulativeProfit: number;
  dailyProfit: number;
}

export interface FinanceFilters {
  type: FinanceOperationType | 'all';
  category: FinanceCategory | 'all';
  project_id: 'wow_tbc' | 'wow_midnight' | 'all';
  dateFrom: string | null;
  dateTo: string | null;
}
