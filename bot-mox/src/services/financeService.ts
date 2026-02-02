import { ref, push, set, update, remove, onValue, off, get } from 'firebase/database';
import { database } from '../utils/firebase';
import type {
  FinanceOperation,
  FinanceOperationFormData,
  FinanceDailyStats,
  GoldPriceHistory,
  FinanceSummary,
  CategoryBreakdown,
  TimeSeriesData,
  FinanceOperationType,
  FinanceCategory,
} from '../types';

const FINANCE_PATH = 'finance';
const OPERATIONS_PATH = `${FINANCE_PATH}/operations`;
const DAILY_STATS_PATH = `${FINANCE_PATH}/daily_stats`;
const GOLD_PRICE_PATH = `${FINANCE_PATH}/gold_price_history`;

/**
 * Преобразует дату из формата YYYY-MM-DD в timestamp
 */
export function parseDateToTimestamp(dateString: string): number {
  if (!dateString || typeof dateString !== 'string') {
    console.error('parseDateToTimestamp: invalid input', { dateString });
    return NaN;
  }

  const date = new Date(dateString + 'T00:00:00');
  const timestamp = date.getTime();

  if (isNaN(timestamp)) {
    console.error('parseDateToTimestamp: failed to create valid date', { dateString });
    return NaN;
  }

  return timestamp;
}

/**
 * Преобразует timestamp в формат YYYY-MM-DD
 */
export function formatTimestampToDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Создает новую финансовую операцию
 */
export async function createFinanceOperation(
  data: FinanceOperationFormData
): Promise<string> {
  if (!data.type) {
    throw new Error('type is required');
  }

  if (!data.category) {
    throw new Error('category is required');
  }

  if (data.amount === undefined || data.amount === null) {
    throw new Error('amount is required');
  }

  const dateTimestamp = parseDateToTimestamp(data.date);
  if (isNaN(dateTimestamp)) {
    throw new Error(`Invalid date format: ${data.date}. Expected YYYY-MM-DD`);
  }

  const operationsRef = ref(database, OPERATIONS_PATH);
  const newOperationRef = push(operationsRef);
  const id = newOperationRef.key;

  if (!id) {
    throw new Error('Failed to generate operation ID');
  }

  const operation: Omit<FinanceOperation, 'id'> = {
    type: data.type,
    category: data.category,
    bot_id: data.bot_id || null,
    project_id: data.project_id || null,
    description: data.description || '',
    amount: Number(data.amount),
    currency: data.currency || 'USD',
    gold_price_at_time: data.gold_price_at_time || null,
    ...(data.gold_amount && { gold_amount: Number(data.gold_amount) }),
    date: dateTimestamp,
    created_at: Date.now(),
  };

  try {
    await set(newOperationRef, operation);
    return id;
  } catch (firebaseError) {
    console.error('Firebase error creating operation:', firebaseError);
    throw new Error(`Firebase error: ${(firebaseError as Error).message}`);
  }
}

/**
 * Обновляет существующую финансовую операцию
 */
export async function updateFinanceOperation(
  id: string,
  data: Partial<FinanceOperationFormData>
): Promise<void> {
  const operationRef = ref(database, `${OPERATIONS_PATH}/${id}`);

  const updates: Partial<FinanceOperation> = {
    updated_at: Date.now(),
  };

  if (data.type !== undefined) updates.type = data.type;
  if (data.category !== undefined) updates.category = data.category;
  if (data.bot_id !== undefined) updates.bot_id = data.bot_id || null;
  if (data.project_id !== undefined) updates.project_id = data.project_id || null;
  if (data.description !== undefined) updates.description = data.description;
  if (data.amount !== undefined) updates.amount = Number(data.amount);
  if (data.currency !== undefined) updates.currency = data.currency;
  if (data.gold_price_at_time !== undefined) updates.gold_price_at_time = data.gold_price_at_time;
  if (data.gold_amount !== undefined) updates.gold_amount = Number(data.gold_amount);
  if (data.date !== undefined) {
    const dateTimestamp = parseDateToTimestamp(data.date);
    if (!isNaN(dateTimestamp)) {
      updates.date = dateTimestamp;
    }
  }

  await update(operationRef, updates);
}

/**
 * Удаляет финансовую операцию
 */
export async function deleteFinanceOperation(id: string): Promise<void> {
  const operationRef = ref(database, `${OPERATIONS_PATH}/${id}`);
  await remove(operationRef);
}

/**
 * Получает все операции (однократно)
 */
export async function getFinanceOperations(): Promise<FinanceOperation[]> {
  return new Promise((resolve, reject) => {
    const operationsRef = ref(database, OPERATIONS_PATH);

    onValue(
      operationsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          resolve([]);
          return;
        }

        const operations: FinanceOperation[] = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<FinanceOperation, 'id'>),
        }));

        // Сортируем по дате (новые сверху)
        operations.sort((a, b) => b.date - a.date);

        resolve(operations);
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

/**
 * Подписывается на изменения всех операций
 */
export function subscribeToFinanceOperations(
  callback: (operations: FinanceOperation[]) => void,
  onError?: (error: Error) => void
): () => void {
  const operationsRef = ref(database, OPERATIONS_PATH);

  const unsubscribe = onValue(
    operationsRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }

      const operations: FinanceOperation[] = Object.entries(data).map(([id, value]) => ({
        id,
        ...(value as Omit<FinanceOperation, 'id'>),
      }));

      // Сортируем по дате (новые сверху)
      operations.sort((a, b) => b.date - a.date);

      callback(operations);
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      }
    }
  );

  return unsubscribe;
}

/**
 * Получает операцию по ID
 */
export async function getFinanceOperationById(id: string): Promise<FinanceOperation | null> {
  return new Promise((resolve, reject) => {
    const operationRef = ref(database, `${OPERATIONS_PATH}/${id}`);

    onValue(
      operationRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          resolve(null);
          return;
        }

        resolve({
          id,
          ...data,
        });
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

/**
 * Получает ежедневную статистику
 */
export async function getFinanceDailyStats(): Promise<Record<string, FinanceDailyStats>> {
  return new Promise((resolve, reject) => {
    const statsRef = ref(database, DAILY_STATS_PATH);

    onValue(
      statsRef,
      (snapshot) => {
        const data = snapshot.val();
        resolve(data || {});
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

/**
 * Получает историю цен на золото
 */
export async function getGoldPriceHistory(): Promise<GoldPriceHistory> {
  return new Promise((resolve, reject) => {
    const pricesRef = ref(database, GOLD_PRICE_PATH);

    onValue(
      pricesRef,
      (snapshot) => {
        const data = snapshot.val();
        resolve(data || {});
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

/**
 * Вычисляет сводку по финансам
 */
export function calculateFinanceSummary(operations: FinanceOperation[]): FinanceSummary {
  const totalIncome = operations
    .filter((op) => op.type === 'income')
    .reduce((acc, op) => acc + op.amount, 0);

  const totalExpenses = operations
    .filter((op) => op.type === 'expense')
    .reduce((acc, op) => acc + op.amount, 0);

  const totalGoldSold = operations
    .filter((op) => op.type === 'income' && op.category === 'sale')
    .reduce((acc, op) => acc + (op.gold_amount || 0), 0);

  const goldSaleOperations = operations.filter(
    (op) => op.type === 'income' && op.category === 'sale' && op.gold_price_at_time
  );

  const averageGoldPrice = goldSaleOperations.length > 0
    ? goldSaleOperations.reduce((acc, op) => acc + (op.gold_price_at_time || 0), 0) / goldSaleOperations.length
    : 0;

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    totalGoldSold,
    totalGoldFarmed: 0, // Будет заполняться из daily_stats
    averageGoldPrice,
  };
}

/**
 * Вычисляет распределение по категориям
 */
export function calculateCategoryBreakdown(
  operations: FinanceOperation[],
  type: FinanceOperationType
): CategoryBreakdown[] {
  const filteredOps = operations.filter((op) => op.type === type);
  const total = filteredOps.reduce((acc, op) => acc + op.amount, 0);

  const categoryMap = new Map<string, number>();

  filteredOps.forEach((op) => {
    const current = categoryMap.get(op.category) || 0;
    categoryMap.set(op.category, current + op.amount);
  });

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category: category as FinanceCategory,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Подготавливает данные для графика временного ряда
 */
export function prepareTimeSeriesData(
  operations: FinanceOperation[],
  days: number = 30
): TimeSeriesData[] {
  const now = Date.now();
  const startDate = now - days * 24 * 60 * 60 * 1000;

  // Группируем операции по дате
  const grouped = new Map<string, { income: number; expense: number }>();

  // Инициализируем все даты
  for (let i = 0; i < days; i++) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateStr = formatTimestampToDate(date.getTime());
    grouped.set(dateStr, { income: 0, expense: 0 });
  }

  // Заполняем операциями
  operations.forEach((op) => {
    if (op.date < startDate) return;

    const dateStr = formatTimestampToDate(op.date);
    const current = grouped.get(dateStr) || { income: 0, expense: 0 };

    if (op.type === 'income') {
      current.income += op.amount;
    } else {
      current.expense += op.amount;
    }

    grouped.set(dateStr, current);
  });

  // Преобразуем в массив и сортируем по дате
  return Array.from(grouped.entries())
    .map(([date, data]) => ({
      date,
      income: data.income,
      expense: data.expense,
      profit: data.income - data.expense,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Фильтрует операции по заданным критериям
 */
export function filterOperations(
  operations: FinanceOperation[],
  filters: {
    type?: FinanceOperationType | 'all';
    category?: FinanceCategory | 'all';
    project_id?: string | 'all';
    dateFrom?: string | null;
    dateTo?: string | null;
  }
): FinanceOperation[] {
  return operations.filter((op) => {
    if (filters.type && filters.type !== 'all' && op.type !== filters.type) {
      return false;
    }

    if (filters.category && filters.category !== 'all' && op.category !== filters.category) {
      return false;
    }

    if (filters.project_id && filters.project_id !== 'all' && op.project_id !== filters.project_id) {
      return false;
    }

    if (filters.dateFrom) {
      const fromTimestamp = parseDateToTimestamp(filters.dateFrom);
      if (op.date < fromTimestamp) return false;
    }

    if (filters.dateTo) {
      const toTimestamp = parseDateToTimestamp(filters.dateTo);
      if (op.date > toTimestamp) return false;
    }

    return true;
  });
}

/**
 * Получает текущую цену золота для проекта
 */
export async function getCurrentGoldPrice(projectId: 'wow_tbc' | 'wow_midnight'): Promise<number> {
  try {
    const projectRef = ref(database, `projects/${projectId}/gold_price_usd`);
    const snapshot = await get(projectRef);
    
    if (snapshot.exists()) {
      return snapshot.val() * 1000; // Конвертируем цену за 1g в цену за 1000g
    }
    
    // Значения по умолчанию
    return projectId === 'wow_tbc' ? 12.5 : 8.5;
  } catch (error) {
    console.error('Error getting gold price:', error);
    return projectId === 'wow_tbc' ? 12.5 : 8.5;
  }
}
