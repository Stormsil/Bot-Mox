import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DollarOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useState } from 'react';
import type { Bot } from '../../types';
import styles from './BotFinance.module.css';
import { mockTransactions } from './botFinanceData';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface BotFinanceProps {
  bot: Bot;
}

type Transaction = (typeof mockTransactions)[number];

const columns: ColumnsType<Transaction> = [
  {
    title: <span className={styles.tableHeader}>Date</span>,
    dataIndex: 'date',
    key: 'date',
    width: 120,
    onCell: () => ({ className: styles.tableCell }),
  },
  {
    title: <span className={styles.tableHeader}>Type</span>,
    dataIndex: 'type',
    key: 'type',
    width: 100,
    render: (type: string) => (
      <Tag color={type === 'income' ? 'green' : 'red'} className={styles['transaction-type-tag']}>
        {type === 'income' ? 'Income' : 'Expense'}
      </Tag>
    ),
    onCell: () => ({ className: styles.tableCell }),
  },
  {
    title: <span className={styles.tableHeader}>Category</span>,
    dataIndex: 'category',
    key: 'category',
    width: 120,
    render: (category: string) => <Tag className={styles['category-tag']}>{category}</Tag>,
    onCell: () => ({ className: styles.tableCell }),
  },
  {
    title: <span className={styles.tableHeader}>Description</span>,
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
    onCell: () => ({ className: styles.tableCell }),
  },
  {
    title: <span className={styles.tableHeader}>Amount</span>,
    dataIndex: 'amount',
    key: 'amount',
    width: 150,
    align: 'right' as const,
    render: (amount: number, record: { type: string; currency: string }) => (
      <Text
        className={record.type === 'income' ? styles['amount-income'] : styles['amount-expense']}
      >
        {record.type === 'income' ? '+' : '-'}
        {amount.toLocaleString()} {record.currency}
      </Text>
    ),
    onCell: () => ({ className: styles.tableCell }),
  },
];

export const BotFinance: React.FC<BotFinanceProps> = () => {
  const [filterType, setFilterType] = useState<string>('all');

  const totalIncome = mockTransactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + (t.currency === 'gold' ? t.amount / 100 : t.amount), 0);

  const totalExpenses = mockTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const netProfit = totalIncome - totalExpenses;

  const filteredTransactions =
    filterType === 'all' ? mockTransactions : mockTransactions.filter((t) => t.type === filterType);

  return (
    <div className={styles['bot-finance']}>
      <Row gutter={[16, 16]} className={styles['finance-summary']}>
        <Col span={8}>
          <Card className={styles['finance-stat-card']} styles={{ body: { padding: 20 } }}>
            <Statistic
              title={<span className={styles.statTitle}>Total Income</span>}
              value={totalIncome}
              prefix={<ArrowUpOutlined className={styles.statPrefix} />}
              suffix="USD"
              precision={2}
              valueStyle={{
                color: 'var(--boxmox-color-status-success)',
                fontFamily: 'var(--font-condensed)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 600,
              }}
            />
            <div className={styles['stat-detail']}>
              <Text className={styles['stat-label']}>From farming & sales</Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['finance-stat-card']} styles={{ body: { padding: 20 } }}>
            <Statistic
              title={<span className={styles.statTitle}>Total Expenses</span>}
              value={totalExpenses}
              prefix={<ArrowDownOutlined className={styles.statPrefix} />}
              suffix="USD"
              precision={2}
              valueStyle={{
                color: 'var(--boxmox-color-status-danger)',
                fontFamily: 'var(--font-condensed)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 600,
              }}
            />
            <div className={styles['stat-detail']}>
              <Text className={styles['stat-label']}>Proxy, subs & session</Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['finance-stat-card']} styles={{ body: { padding: 20 } }}>
            <Statistic
              title={<span className={styles.statTitle}>Net Profit</span>}
              value={netProfit}
              prefix={<DollarOutlined className={styles.statPrefix} />}
              suffix="USD"
              precision={2}
              valueStyle={{
                color:
                  netProfit >= 0
                    ? 'var(--boxmox-color-status-success)'
                    : 'var(--boxmox-color-status-danger)',
                fontFamily: 'var(--font-condensed)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 600,
              }}
            />
            <div className={styles['stat-detail']}>
              <Text className={styles['stat-label']}>Current balance</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className={styles['costs-breakdown']}>
        <Col span={12}>
          <Card
            className={styles['costs-card']}
            title="Cost Breakdown"
            styles={{
              header: {
                background: 'var(--boxmox-color-surface-muted)',
                borderBottom: '1px solid var(--boxmox-color-border-default)',
              },
            }}
          >
            <div className={styles['cost-item']}>
              <Text className={styles.lineLabel}>Proxy Costs</Text>
              <Text className={styles.lineValue}>$15.00</Text>
            </div>
            <div className={styles['cost-item']}>
              <Text className={styles.lineLabel}>Subscription</Text>
              <Text className={styles.lineValue}>$25.00</Text>
            </div>
            <div className={styles['cost-item']}>
              <Text className={styles.lineLabel}>Session Costs</Text>
              <Text className={styles.lineValue}>$5.00</Text>
            </div>
            <div className={styles['cost-divider']} />
            <div className={styles['cost-item']}>
              <Text className={styles.lineLabelStrong}>Total Costs</Text>
              <Text className={[styles.lineValueStrong, styles.totalAmount].join(' ')}>$45.00</Text>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            className={styles['roi-card']}
            title="ROI Analysis"
            styles={{
              header: {
                background: 'var(--boxmox-color-surface-muted)',
                borderBottom: '1px solid var(--boxmox-color-border-default)',
              },
            }}
          >
            <div className={styles['roi-item']}>
              <Text className={styles.lineLabel}>Total Invested</Text>
              <Text className={styles.lineValue}>$120.00</Text>
            </div>
            <div className={styles['roi-item']}>
              <Text className={styles.lineLabel}>Total Returned</Text>
              <Text className={[styles.lineValue, styles.positive].join(' ')}>$187.50</Text>
            </div>
            <div className={styles['roi-item']}>
              <Text className={styles.lineLabel}>Payback Period</Text>
              <Text className={styles.lineValue}>12 days</Text>
            </div>
            <div className={styles['roi-divider']} />
            <div className={styles['roi-item']}>
              <Text className={styles.lineLabelStrong}>Profit per Day</Text>
              <Text className={[styles.lineValueStrong, styles.positive].join(' ')}>$5.62</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        className={styles['transactions-card']}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
        }}
        title={
          <div className={styles['transactions-header']}>
            <span>Transaction History</span>
            <Space>
              <Select
                value={filterType}
                onChange={setFilterType}
                style={{ width: 120 }}
                size="small"
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'income', label: 'Income' },
                  { value: 'expense', label: 'Expense' },
                ]}
              />
              <RangePicker size="small" />
              <Button icon={<DownloadOutlined />} size="small">
                Export
              </Button>
            </Space>
          </div>
        }
      >
        <Table
          dataSource={filteredTransactions}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10, className: styles.tablePagination }}
          size="small"
          className={styles['transactions-table']}
          rowClassName={() => styles['transaction-row']}
        />
      </Card>
    </div>
  );
};
