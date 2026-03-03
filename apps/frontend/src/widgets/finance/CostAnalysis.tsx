import type React from 'react';
import { useMemo } from 'react';
import type { CategoryBreakdown } from '../../entities/finance/model/types';
import {
  AppCard as Card,
  AppList as List,
  AppProgress as Progress,
  AppTypography as Typography,
} from '../../shared/ui';
import styles from './FinanceSummary.module.css';

const { Text } = Typography;

interface CostAnalysisProps {
  expenseBreakdown: CategoryBreakdown[];
  totalExpenses: number;
  loading?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  subscription_bot: 'Bot Licenses (Software)',
  subscription_game: 'Game Subscriptions (WoW)',
  proxy: 'Proxies & VPN',
  license: 'Other Licenses',
  other: 'Miscellaneous',
  server: 'Server/Hosting',
};

const CATEGORY_COLORS: Record<string, string> = {
  subscription_bot: 'var(--botmox-color-border-subtle)',
  subscription_game: 'var(--botmox-color-border-subtle)',
  proxy: 'var(--botmox-color-border-subtle)',
  license: 'var(--botmox-color-border-subtle)',
  other: 'var(--botmox-color-border-subtle)',
};

export const CostAnalysis: React.FC<CostAnalysisProps> = ({
  expenseBreakdown,
  totalExpenses,
  loading = false,
}) => {
  // Sort by amount desc
  const sortedExpenses = useMemo(() => {
    return [...expenseBreakdown].sort((a, b) => b.amount - a.amount);
  }, [expenseBreakdown]);

  return (
    <Card
      title="Cost Structure Analysis"
      variant="borderless"
      className={styles.costAnalysisCard}
      loading={loading}
    >
      <List
        itemLayout="horizontal"
        dataSource={sortedExpenses}
        renderItem={(item) => {
          const percentage = totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0;
          const label = CATEGORY_LABELS[item.category] || item.category.replace(/_/g, ' ');
          const color = CATEGORY_COLORS[item.category] || 'var(--botmox-color-status-danger)';

          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text strong>{label}</Text>
                <Text>
                  $
                  {item.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    ({percentage.toFixed(1)}%)
                  </Text>
                </Text>
              </div>
              <Progress
                percent={percentage}
                strokeColor={color}
                trailColor="var(--botmox-color-surface-muted)"
                showInfo={false}
                size="small"
              />
            </div>
          );
        }}
      />
      {totalExpenses === 0 && (
        <div
          style={{ textAlign: 'center', padding: '20px', color: 'var(--botmox-color-text-muted)' }}
        >
          No expense data available for the selected period.
        </div>
      )}
    </Card>
  );
};
