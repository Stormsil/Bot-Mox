import type React from 'react';
import { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type {
  CategoryBreakdown,
  FinanceSummary as FinanceSummaryType,
  GoldPriceHistoryEntry,
  TimeSeriesData,
} from '../../entities/finance/model/types';
import {
  AppCard as Card,
  AppCol as Col,
  AppEmpty as Empty,
  AppRow as Row,
  AppTypography as Typography,
} from '../../shared/ui';
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
  categories: [
    'var(--botmox-color-brand-primary)',
    'var(--botmox-color-status-info)',
    'var(--botmox-color-status-success)',
    'var(--botmox-color-status-warning)',
    'var(--botmox-color-brand-warning)',
    'var(--botmox-color-text-muted)',
  ],
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
  projectPerformance: Array<{
    project_id: string;
    income_total: number;
    expense_total: number;
    net_total?: number;
    margin_percent?: number;
    operation_count?: number;
    gold_volume?: number;
  }>;
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
    projectPerformance,
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
      wow_tbc: { totalGold: 0 },
      wow_midnight: { totalGold: 0 },
    };

    projectPerformance.forEach((entry) => {
      if (entry.project_id !== 'wow_tbc' && entry.project_id !== 'wow_midnight') {
        return;
      }
      base[entry.project_id].totalGold += entry.gold_volume || 0;
    });

    return base;
  }, [projectPerformance]);

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
        <span>WoW TBC: Avg price from summary filter</span>
        <span>WoW Midnight: Avg price from summary filter</span>
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
          <ProjectPerformanceTable projectPerformance={projectPerformance} loading={loading} />
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
                    stroke="var(--botmox-color-surface-base)"
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
                      color: 'var(--botmox-color-text-secondary)',
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
