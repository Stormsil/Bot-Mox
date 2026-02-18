import React, { useMemo } from 'react';
import { Table, Tag, Card, Typography } from 'antd';
import type { FinanceOperation } from '../../types';
import commonStyles from './FinanceCommon.module.css';
import styles from './FinanceSummary.module.css';

const { Text } = Typography;

interface ProjectPerformanceTableProps {
  operations: FinanceOperation[];
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

export const ProjectPerformanceTable: React.FC<ProjectPerformanceTableProps> = ({
  operations,
  loading = false,
}) => {
  const data = useMemo(() => {
    const statsMap = new Map<string, ProjectStats>();

    // Initialize projects (hardcoded for now to ensure they appear even if empty)
    const projects = ['wow_tbc', 'wow_midnight'];
    
    projects.forEach(proj => {
      statsMap.set(proj, {
        key: proj,
        project: proj === 'wow_tbc' ? 'WoW TBC Classic' : 'WoW Midnight',
        income: 0,
        expense: 0,
        profit: 0,
        margin: 0,
        goldVolume: 0,
        transactionCount: 0,
      });
    });

    // Also handle global/other operations
    statsMap.set('global', {
      key: 'global',
      project: 'Global / Infrastructure',
      income: 0,
      expense: 0,
      profit: 0,
      margin: 0,
      goldVolume: 0,
      transactionCount: 0,
    });

    operations.forEach(op => {
      const key = op.project_id || 'global';
      const stats = statsMap.get(key);
      
      if (stats) {
        if (op.type === 'income') {
          stats.income += op.amount;
          if (op.category === 'sale') {
            stats.goldVolume += (op.gold_amount || 0);
          }
        } else {
          stats.expense += op.amount;
        }
        stats.transactionCount += 1;
      }
    });

    // Calculate derived metrics
    return Array.from(statsMap.values()).map(stat => {
      stat.profit = stat.income - stat.expense;
      stat.margin = stat.income > 0 ? (stat.profit / stat.income) * 100 : 0;
      return stat;
    }).filter(stat => stat.transactionCount > 0); // Hide completely empty rows
  }, [operations]);

  const columns = [
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
          {val >= 0 ? '+' : ''}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        // If it's pure expense (Global), margin doesn't make sense
        if (record.income === 0) return <Tag className={commonStyles.financeTag}>N/A</Tag>;
        
        return <Tag className={commonStyles.financeTag}>{val.toFixed(1)}%</Tag>;
      },
    },
    {
      title: 'Gold Sold',
      dataIndex: 'goldVolume',
      key: 'goldVolume',
      render: (val: number) => val > 0 ? `${val.toLocaleString()} g` : '-',
    },
  ];

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
