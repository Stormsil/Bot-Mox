import { Card, Empty, Spin } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GoldPriceHistoryEntry } from '../../entities/finance/model/types';
import styles from './GoldPriceChart.module.css';

interface GoldPriceChartProps {
  data: GoldPriceHistoryEntry[];
  loading?: boolean;
}

interface ChartDataPoint {
  date: string;
  wow_tbc: number | null;
  wow_midnight: number | null;
}

interface GoldChartTooltipPayloadEntry {
  color: string;
  name: string;
  value: number | null;
}

interface GoldChartTooltipProps {
  active?: boolean;
  payload?: GoldChartTooltipPayloadEntry[];
  label?: string;
}

/**
 * Форматирует дату для отображения на графике
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Форматирует цену для отображения в tooltip
 */
function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

const GoldChartTooltip: React.FC<GoldChartTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipDate}>{label}</p>
        {payload.map((entry) =>
          entry.value !== null ? (
            <p key={entry.name} className={styles.tooltipPrice} style={{ color: entry.color }}>
              {entry.name}: {formatPrice(entry.value)}
            </p>
          ) : null,
        )}
      </div>
    );
  }
  return null;
};

export const GoldPriceChart: React.FC<GoldPriceChartProps> = ({ data, loading = false }) => {
  // Подготавливаем данные для графика
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!data || data.length === 0) return [];

    // Группируем данные по дате
    const grouped = new Map<string, { wow_tbc: number | null; wow_midnight: number | null }>();

    data.forEach((entry) => {
      const existing = grouped.get(entry.date);
      if (existing) {
        existing[entry.project_id] = entry.price;
      } else {
        grouped.set(entry.date, {
          wow_tbc: entry.project_id === 'wow_tbc' ? entry.price : null,
          wow_midnight: entry.project_id === 'wow_midnight' ? entry.price : null,
        });
      }
    });

    // Преобразуем в массив и сортируем по дате
    return Array.from(grouped.entries())
      .map(([date, prices]) => ({
        date,
        ...prices,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  // Проверяем наличие данных для каждого проекта
  const hasTBCData = useMemo(() => chartData.some((d) => d.wow_tbc !== null), [chartData]);
  const hasMidnightData = useMemo(
    () => chartData.some((d) => d.wow_midnight !== null),
    [chartData],
  );

  if (loading) {
    return (
      <Card title="Gold Price History" className={styles.card}>
        <div className={styles.loading}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card title="Gold Price History" className={styles.card}>
        <Empty
          description="No gold price data available. Add gold sale transactions to see the history."
          className={styles.empty}
        />
      </Card>
    );
  }

  return (
    <Card title="Gold Price History" className={styles.card}>
      <div className={styles.container}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#8c8c8c"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              stroke="#8c8c8c"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value}`}
              label={{
                value: 'Price per 1000g (USD)',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#8c8c8c' },
              }}
            />
            <Tooltip content={<GoldChartTooltip />} />
            <Legend verticalAlign="top" height={36} iconType="line" />
            {hasTBCData && (
              <Line
                type="monotone"
                dataKey="wow_tbc"
                name="WoW TBC Classic"
                stroke="#1890ff"
                strokeWidth={2}
                dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#1890ff', strokeWidth: 2 }}
                connectNulls={false}
              />
            )}
            {hasMidnightData && (
              <Line
                type="monotone"
                dataKey="wow_midnight"
                name="WoW Midnight"
                stroke="#52c41a"
                strokeWidth={2}
                dot={{ fill: '#52c41a', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#52c41a', strokeWidth: 2 }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.info}>
        <p className={styles.infoText}>
          Prices are recorded from gold sale transactions. Each point represents a sale.
        </p>
      </div>
    </Card>
  );
};
