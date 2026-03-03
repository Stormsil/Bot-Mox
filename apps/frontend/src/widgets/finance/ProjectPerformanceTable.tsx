import React, { useMemo } from 'react';
import {
  AppCard as Card,
  AppTable as Table,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../shared/ui';
import commonStyles from './FinanceCommon.module.css';
import styles from './FinanceSummary.module.css';

const { Text } = Typography;

interface ProjectPerformanceTableProps {
  projectPerformance: Array<{
    project_id: string;
    income_total: number;
    expense_total: number;
    net_total?: number;
    margin_percent?: number;
    gold_volume?: number;
    operation_count?: number;
  }>;
  loading?: boolean;
}

interface ProjectStats {
  key: string;
  project: string;
  income: number;
  expense: number;
  profit: number;
  margin: number;
  goldVolume: number;
  transactionCount: number;
}

const ProjectPerformanceTableImpl: React.FC<ProjectPerformanceTableProps> = ({
  projectPerformance,
  loading = false,
}) => {
  const data = useMemo(() => {
    const toProjectLabel = (projectId: string): string => {
      if (projectId === 'wow_tbc') return 'WoW TBC Classic';
      if (projectId === 'wow_midnight') return 'WoW Midnight';
      if (projectId === 'global') return 'Global / Infrastructure';
      return projectId;
    };

    return projectPerformance
      .map((item): ProjectStats => {
        const income = Number.isFinite(item.income_total) ? item.income_total : 0;
        const expense = Number.isFinite(item.expense_total) ? item.expense_total : 0;
        const profit =
          item.net_total === undefined ||
          item.net_total === null ||
          !Number.isFinite(item.net_total)
            ? income - expense
            : item.net_total;
        const margin =
          item.margin_percent === undefined ||
          item.margin_percent === null ||
          !Number.isFinite(item.margin_percent)
            ? income > 0
              ? (profit / income) * 100
              : 0
            : item.margin_percent;
        const transactionCount =
          item.operation_count !== undefined &&
          item.operation_count !== null &&
          Number.isFinite(item.operation_count)
            ? Math.max(0, Math.trunc(item.operation_count))
            : 0;
        const goldVolume =
          item.gold_volume !== undefined &&
          item.gold_volume !== null &&
          Number.isFinite(item.gold_volume)
            ? item.gold_volume
            : 0;

        return {
          key: item.project_id,
          project: toProjectLabel(item.project_id),
          income,
          expense,
          profit,
          margin,
          goldVolume,
          transactionCount,
        };
      })
      .filter(
        (item) =>
          item.transactionCount > 0 || item.income > 0 || item.expense > 0 || item.goldVolume > 0,
      );
  }, [projectPerformance]);

  const columns = useMemo(
    () => [
      {
        title: 'Project / Scope',
        dataIndex: 'project',
        key: 'project',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: 'Income',
        dataIndex: 'income',
        key: 'income',
        render: (val: number) => (
          <Text>
            ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        ),
        sorter: (a: ProjectStats, b: ProjectStats) => a.income - b.income,
      },
      {
        title: 'Expenses',
        dataIndex: 'expense',
        key: 'expense',
        render: (val: number) => (
          <Text>
            ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        ),
        sorter: (a: ProjectStats, b: ProjectStats) => a.expense - b.expense,
      },
      {
        title: 'Net Profit',
        dataIndex: 'profit',
        key: 'profit',
        render: (val: number) => (
          <Text style={{ fontWeight: 600 }}>
            {val >= 0 ? '+' : ''}$
            {val.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        ),
        sorter: (a: ProjectStats, b: ProjectStats) => a.profit - b.profit,
        defaultSortOrder: 'descend' as const,
      },
      {
        title: 'Margin',
        dataIndex: 'margin',
        key: 'margin',
        render: (val: number, record: ProjectStats) => {
          if (record.income === 0) return <Tag className={commonStyles.financeTag}>N/A</Tag>;
          return <Tag className={commonStyles.financeTag}>{val.toFixed(1)}%</Tag>;
        },
      },
      {
        title: 'Gold Sold',
        dataIndex: 'goldVolume',
        key: 'goldVolume',
        render: (val: number) => (val > 0 ? <Text code>{`${val.toLocaleString()} g`}</Text> : '-'),
      },
    ],
    [],
  );

  return (
    <Card
      title="Project Performance Analysis"
      variant="borderless"
      className={styles.projectPerformanceCard}
      loading={loading}
    >
      <Table
        className={styles.projectPerformanceTable}
        dataSource={data}
        columns={columns}
        pagination={false}
        size="small"
      />
    </Card>
  );
};
export const ProjectPerformanceTable = React.memo(ProjectPerformanceTableImpl);
