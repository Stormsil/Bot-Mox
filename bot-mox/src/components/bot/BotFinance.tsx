import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DollarOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
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
import type React from 'react';
import { useState } from 'react';
import type { Bot } from '../../types';
import styles from './BotFinance.module.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface BotFinanceProps {
  bot: Bot;
}

interface TransactionRecord {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  currency: string;
}

// Моковые данные транзакций
const mockTransactions: TransactionRecord[] = [
  {
    id: '1',
    date: '2024-01-28',
    type: 'income',
    category: 'Farming',
    description: 'Gold farmed - Shadowmoon Valley',
    amount: 1250,
    currency: 'gold',
  },
  {
    id: '2',
    date: '2024-01-28',
    type: 'expense',
    category: 'Proxy',
    description: 'Proxy renewal',
    amount: 5,
    currency: 'USD',
  },
  {
    id: '3',
    date: '2024-01-27',
    type: 'income',
    category: 'Farming',
    description: 'Gold farmed - Nagrand',
    amount: 980,
    currency: 'gold',
  },
  {
    id: '4',
    date: '2024-01-27',
    type: 'expense',
    category: 'Subscription',
    description: 'Bot subscription',
    amount: 25,
    currency: 'USD',
  },
  {
    id: '5',
    date: '2024-01-26',
    type: 'income',
    category: 'Farming',
    description: 'Gold farmed - Netherstorm',
    amount: 1450,
    currency: 'gold',
  },
  {
    id: '6',
    date: '2024-01-26',
    type: 'expense',
    category: 'Session',
    description: 'Game time',
    amount: 2,
    currency: 'USD',
  },
  {
    id: '7',
    date: '2024-01-25',
    type: 'income',
    category: 'Farming',
    description: 'Gold farmed - Terokkar',
    amount: 1100,
    currency: 'gold',
  },
  {
    id: '8',
    date: '2024-01-25',
    type: 'expense',
    category: 'Proxy',
    description: 'Proxy renewal',
    amount: 5,
    currency: 'USD',
  },
];

const transactionCellClassName = styles['transaction-cell'];
const transactionHeaderCellClassName = styles['transaction-header-cell'];

const columns: TableColumnsType<TransactionRecord> = [
  {
    title: 'Date',
    dataIndex: 'date',
    key: 'date',
    width: 120,
    className: transactionCellClassName,
    onHeaderCell: () => ({ className: transactionHeaderCellClassName }),
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    className: transactionCellClassName,
    onHeaderCell: () => ({ className: transactionHeaderCellClassName }),
    render: (type: string) => (
      <Tag color={type === 'income' ? 'green' : 'red'} className={styles['transaction-type-tag']}>
        {type === 'income' ? 'Income' : 'Expense'}
      </Tag>
    ),
  },
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    width: 120,
    className: transactionCellClassName,
    onHeaderCell: () => ({ className: transactionHeaderCellClassName }),
    render: (category: string) => <Tag className={styles['category-tag']}>{category}</Tag>,
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
    className: transactionCellClassName,
    onHeaderCell: () => ({ className: transactionHeaderCellClassName }),
  },
  {
    title: 'Amount',
    dataIndex: 'amount',
    key: 'amount',
    width: 150,
    align: 'right' as const,
    className: transactionCellClassName,
    onHeaderCell: () => ({ className: transactionHeaderCellClassName }),
    render: (amount: number, record: { type: string; currency: string }) => (
      <Text
        className={record.type === 'income' ? styles['amount-income'] : styles['amount-expense']}
      >
        {record.type === 'income' ? '+' : '-'}
        {amount.toLocaleString()} {record.currency}
      </Text>
    ),
  },
];

export const BotFinance: React.FC<BotFinanceProps> = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const statCardStyles = { body: { padding: 20 } };

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
      {/* Финансовая сводка */}
      <Row gutter={[16, 16]} className={styles['finance-summary']}>
        <Col span={8}>
          <Card className={styles['finance-stat-card']} styles={statCardStyles}>
            <Statistic
              value={totalIncome}
              prefix={<ArrowUpOutlined className={styles['stat-prefix-icon']} />}
              suffix="USD"
              precision={2}
              title={<span className={styles['stat-label']}>Total Income</span>}
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
          <Card className={styles['finance-stat-card']} styles={statCardStyles}>
            <Statistic
              value={totalExpenses}
              prefix={<ArrowDownOutlined className={styles['stat-prefix-icon']} />}
              suffix="USD"
              precision={2}
              title={<span className={styles['stat-label']}>Total Expenses</span>}
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
          <Card className={styles['finance-stat-card']} styles={statCardStyles}>
            <Statistic
              value={netProfit}
              prefix={<DollarOutlined className={styles['stat-prefix-icon']} />}
              suffix="USD"
              precision={2}
              title={<span className={styles['stat-label']}>Net Profit</span>}
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

      {/* Детализация затрат */}
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
              <Text className={styles['item-label']}>Proxy Costs</Text>
              <Text strong className={styles['item-value']}>
                $15.00
              </Text>
            </div>
            <div className={styles['cost-item']}>
              <Text className={styles['item-label']}>Subscription</Text>
              <Text strong className={styles['item-value']}>
                $25.00
              </Text>
            </div>
            <div className={styles['cost-item']}>
              <Text className={styles['item-label']}>Session Costs</Text>
              <Text strong className={styles['item-value']}>
                $5.00
              </Text>
            </div>
            <div className={styles['cost-divider']} />
            <div className={[styles['cost-item'], styles.total].join(' ')}>
              <Text strong className={styles['item-label-total']}>
                Total Costs
              </Text>
              <Text strong className={styles['total-amount']}>
                $45.00
              </Text>
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
              <Text className={styles['item-label']}>Total Invested</Text>
              <Text strong className={styles['item-value']}>
                $120.00
              </Text>
            </div>
            <div className={styles['roi-item']}>
              <Text className={styles['item-label']}>Total Returned</Text>
              <Text strong className={styles.positive}>
                $187.50
              </Text>
            </div>
            <div className={styles['roi-item']}>
              <Text className={styles['item-label']}>Payback Period</Text>
              <Text strong className={styles['item-value']}>
                12 days
              </Text>
            </div>
            <div className={styles['roi-divider']} />
            <div className={[styles['roi-item'], styles.total].join(' ')}>
              <Text strong className={styles['item-label-total']}>
                Profit per Day
              </Text>
              <Text strong className={styles.positive}>
                $5.62
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Таблица транзакций */}
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
          pagination={{ pageSize: 10 }}
          size="small"
          className={styles['transactions-table']}
          rowClassName={() => styles['transaction-row']}
        />
      </Card>
    </div>
  );
};
