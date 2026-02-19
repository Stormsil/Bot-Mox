import { Card, Col, Empty, Row, Typography } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type {
  CategoryBreakdown,
  FinanceOperation,
  FinanceSummary as FinanceSummaryType,
  GoldPriceHistoryEntry,
  TimeSeriesData,
} from '../../entities/finance/model/types';
import { CostAnalysis } from './CostAnalysis';
import styles from './FinanceSummary.module.css';
import { ProjectPerformanceTable } from './ProjectPerformanceTable';
import { UniversalChart } from './UniversalChart';

const { Text } = Typography;

type MetricTone = 'positive' | 'negative' | 'neutral' | 'accent';

interface PieTooltipPayloadItem {
  payload: {
    name: string;
    value: number;
    percentage: number;
  };
}

interface PieTooltipContentProps {
  active?: boolean;
  payload?: PieTooltipPayloadItem[];
  formatCurrency: (value: number) => string;
}

interface MetricBlockProps {
  label: string;
  value: React.ReactNode;
  unit: string;
  hint: React.ReactNode;
  tone: MetricTone;
  loading: boolean;
}

// Цвета для графиков
const COLORS = {
  // Muted, professional palette (non-grey, low saturation)
  categories: ['#5b6f8f', '#4f8a8b', '#8b5a3c', '#7a5c8f', '#6b7a88', '#8a8f4f'],
};

const PieTooltipContent: React.FC<PieTooltipContentProps> = ({
  active,
  payload,
  formatCurrency,
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className={styles.chartTooltip}>
        <p className={styles.chartTooltipLabel}>{data.name}</p>
        <p className={styles.chartTooltipValue}>
          {formatCurrency(data.value)} ({data.percentage}%)
        </p>
      </div>
    );
  }

  return null;
};

const MetricBlock: React.FC<MetricBlockProps> = ({ label, value, unit, hint, tone, loading }) => (
  <Card
    className={[
      styles.metricCard,
      tone === 'positive'
        ? styles.metricPositive
        : tone === 'negative'
          ? styles.metricNegative
          : tone === 'accent'
            ? styles.metricAccent
            : styles.metricNeutral,
    ].join(' ')}
    loading={loading}
    variant="borderless"
    styles={{
      body: { padding: '4px 2px' },
    }}
  >
    <div className={styles.metricHeader}>
      <Text className={styles.metricTitle}>{label}</Text>
      <Text className={styles.metricUnit}>{unit}</Text>
    </div>
    <div className={styles.metricValue}>{value}</div>
    <Text className={styles.metricLabel}>{hint}</Text>
  </Card>
);

interface FinanceSummaryProps {
  summary: FinanceSummaryType;
  incomeBreakdown: CategoryBreakdown[];
  expenseBreakdown: CategoryBreakdown[];
  timeSeriesData: TimeSeriesData[];
  goldPriceHistory: GoldPriceHistoryEntry[];
  loading?: boolean;
  timeRange: number;
  onTimeRangeChange: (days: number) => void;
  selectedProject: 'all' | 'wow_tbc' | 'wow_midnight';
  operations: FinanceOperation[]; // Added operations prop
}

export const FinanceSummary: React.FC<FinanceSummaryProps> = (props) => {
  const {
    summary,
    expenseBreakdown,
    timeSeriesData,
    goldPriceHistory,
    loading = false,
    timeRange,
    onTimeRangeChange,
    selectedProject,
    operations,
  } = props;
  // Форматирование валюты
  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatSignedCurrency = (value: number) => {
    if (value === 0) return formatCurrency(0);
    return `${value > 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
  };

  // Данные для круговой диаграммы расходов
  const expensePieData = expenseBreakdown.map((item) => {
    const label = item.category
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return {
      name: label,
      value: item.amount,
      percentage: item.percentage,
    };
  });

  const goldByProject = useMemo(() => {
    const base = {
      wow_tbc: { totalGold: 0, priceSum: 0, priceCount: 0, avgPrice: 0 },
      wow_midnight: { totalGold: 0, priceSum: 0, priceCount: 0, avgPrice: 0 },
    };

    operations.forEach((op) => {
      if (op.type !== 'income' || op.category !== 'sale') return;
      if (!op.project_id) return;
      if (!(op.project_id in base)) return;

      const key = op.project_id as 'wow_tbc' | 'wow_midnight';
      base[key].totalGold += op.gold_amount || 0;
      if (typeof op.gold_price_at_time === 'number' && op.gold_price_at_time > 0) {
        base[key].priceSum += op.gold_price_at_time;
        base[key].priceCount += 1;
      }
    });

    (Object.keys(base) as Array<'wow_tbc' | 'wow_midnight'>).forEach((key) => {
      const entry = base[key];
      entry.avgPrice = entry.priceCount > 0 ? entry.priceSum / entry.priceCount : 0;
    });

    return base;
  }, [operations]);

  const renderGoldValue = () => {
    if (selectedProject !== 'all') {
      return `${summary.totalGoldSold.toLocaleString()} g`;
    }

    return (
      <div className={styles.metricMulti}>
        <div className={styles.metricMultiRow}>
          <span className={styles.metricMultiLabel}>WoW TBC</span>
          <span>{goldByProject.wow_tbc.totalGold.toLocaleString()} g</span>
        </div>
        <div className={styles.metricMultiRow}>
          <span className={styles.metricMultiLabel}>WoW Midnight</span>
          <span>{goldByProject.wow_midnight.totalGold.toLocaleString()} g</span>
        </div>
      </div>
    );
  };

  const renderGoldHint = () => {
    if (selectedProject !== 'all') {
      return `Avg price: $${summary.averageGoldPrice.toFixed(4)}/1000g`;
    }

    return (
      <span className={styles.metricHintStack}>
        <span>WoW TBC: ${goldByProject.wow_tbc.avgPrice.toFixed(4)}/1000g</span>
        <span>WoW Midnight: ${goldByProject.wow_midnight.avgPrice.toFixed(4)}/1000g</span>
      </span>
    );
  };
  /*  */
  return (
    <div className={styles.container}>
      {/* Основные метрики */}
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <MetricBlock
            label="Total Income"
            value={formatCurrency(summary.totalIncome)}
            unit="USD"
            hint="All sources"
            tone="neutral"
            loading={loading}
          />
        </Col>
        <Col span={6}>
          <MetricBlock
            label="Total Expenses"
            value={formatCurrency(summary.totalExpenses)}
            unit="USD"
            hint="All categories"
            tone="neutral"
            loading={loading}
          />
        </Col>
        <Col span={6}>
          <MetricBlock
            label="Net Profit"
            value={formatSignedCurrency(summary.netProfit)}
            unit="USD"
            hint={summary.netProfit >= 0 ? 'Net gain' : 'Net loss'}
            tone="neutral"
            loading={loading}
          />
        </Col>
        <Col span={6}>
          <MetricBlock
            label="Gold Sold"
            value={renderGoldValue()}
            unit="Volume"
            hint={renderGoldHint()}
            tone="neutral"
            loading={loading}
          />
        </Col>
      </Row>

      {/* Универсальный график */}
      <UniversalChart
        timeSeriesData={timeSeriesData}
        goldPriceHistory={goldPriceHistory}
        loading={loading}
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
      />

      {/* Project Performance Table */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <ProjectPerformanceTable operations={operations} loading={loading} />
        </Col>
      </Row>

      {/* Expense Analysis (Pie + Cost Structure) */}
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card
            className={styles.chartCard}
            title="Expenses Distribution"
            loading={loading}
            variant="borderless"
          >
            {expensePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={84}
                    outerRadius={104}
                    paddingAngle={2}
                    dataKey="value"
                    label={false}
                    labelLine={false}
                    stroke="var(--boxmox-color-surface-base)"
                    strokeWidth={2}
                  >
                    {expensePieData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS.categories[index % COLORS.categories.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltipContent formatCurrency={formatCurrency} />} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{
                      color: 'var(--boxmox-color-text-secondary)',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No expense data" />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <CostAnalysis
            expenseBreakdown={expenseBreakdown}
            totalExpenses={summary.totalExpenses}
            loading={loading}
          />
        </Col>
      </Row>
    </div>
  );
};
