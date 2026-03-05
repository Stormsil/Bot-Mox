import {
  type FinanceBreakdownContractRecord,
  type FinanceGoldPriceHistoryContractMap,
  type FinanceOperationContractRecord,
  type FinanceSummaryContractRecord,
  type FinanceTimeSeriesContractRecord,
  getFinanceBreakdownViaContract,
  getFinanceGoldPriceHistoryViaContract,
  getFinanceProjectPerformanceViaContract,
  getFinanceSummaryViaContract,
  getFinanceTimeSeriesViaContract,
} from '../../../shared/api/providers/finance-contract-client';

export interface FinanceAggregateQuery {
  from_ts?: number;
  to_ts?: number;
  currency?: string;
  project_id?: string;
  bot_id?: string;
}

export interface FinanceTimeSeriesQuery extends FinanceAggregateQuery {
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export type {
  FinanceBreakdownContractRecord,
  FinanceOperationContractRecord,
  FinanceGoldPriceHistoryContractMap,
  FinanceSummaryContractRecord,
  FinanceTimeSeriesContractRecord,
};

export {
  getFinanceBreakdownViaContract,
  getFinanceGoldPriceHistoryViaContract,
  getFinanceProjectPerformanceViaContract,
  getFinanceSummaryViaContract,
  getFinanceTimeSeriesViaContract,
};
