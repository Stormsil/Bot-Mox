import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Table, DatePicker, Select, Button, Space, Tag, Typography } from 'antd';
import {
  DollarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { Bot } from '../../types';
import styles from './BotFinance.module.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface BotFinanceProps {
  bot: Bot;
}

// Моковые данные транзакций
const mockTransactions = [
  { id: '1', date: '2024-01-28', type: 'income', category: 'Farming', description: 'Gold farmed - Shadowmoon Valley', amount: 1250, currency: 'gold' },
  { id: '2', date: '2024-01-28', type: 'expense', category: 'Proxy', description: 'Proxy renewal', amount: 5, currency: 'USD' },
  { id: '3', date: '2024-01-27', type: 'income', category: 'Farming', description: 'Gold farmed - Nagrand', amount: 980, currency: 'gold' },
  { id: '4', date: '2024-01-27', type: 'expense', category: 'Subscription', description: 'Bot subscription', amount: 25, currency: 'USD' },
  { id: '5', date: '2024-01-26', type: 'income', category: 'Farming', description: 'Gold farmed - Netherstorm', amount: 1450, currency: 'gold' },
  { id: '6', date: '2024-01-26', type: 'expense', category: 'Session', description: 'Game time', amount: 2, currency: 'USD' },
  { id: '7', date: '2024-01-25', type: 'income', category: 'Farming', description: 'Gold farmed - Terokkar', amount: 1100, currency: 'gold' },
  { id: '8', date: '2024-01-25', type: 'expense', category: 'Proxy', description: 'Proxy renewal', amount: 5, currency: 'USD' },
];

const columns = [
  {
    title: 'Date',
    dataIndex: 'date',
    key: 'date',
    width: 120,
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    render: (type: string) => (
      <Tag
        color={type === 'income' ? 'green' : 'red'}
        className={styles['transaction-type-tag']}
      >
        {type === 'income' ? 'Income' : 'Expense'}
      </Tag>
    ),
  },
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    width: 120,
    render: (category: string) => (
      <Tag className={styles['category-tag']}>{category}</Tag>
    ),
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
  {
    title: 'Amount',
    dataIndex: 'amount',
    key: 'amount',
    width: 150,
    align: 'right' as const,
    render: (amount: number, record: { type: string; currency: string }) => (
      <Text
        className={record.type === 'income' ? styles['amount-income'] : styles['amount-expense']}
      >
        {record.type === 'income' ? '+' : '-'}{amount.toLocaleString()} {record.currency}
      </Text>
    ),
  },
];

export const BotFinance: React.FC<BotFinanceProps> = () => {
  const [filterType, setFilterType] = useState<string>('all');

  const totalIncome = mockTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + (t.currency === 'gold' ? t.amount / 100 : t.amount), 0);

  const totalExpenses = mockTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const netProfit = totalIncome - totalExpenses;

  const filteredTransactions = filterType === 'all'
    ? mockTransactions
    : mockTransactions.filter(t => t.type === filterType);

  return (
    <div className={styles['bot-finance']}>
      {/* Финансовая сводка */}
      <Row gutter={[16, 16]} className={styles['finance-summary']}>
        <Col span={8}>
          <Card className={styles['finance-stat-card']}>
            <Statistic
              title="Total Income"
              value={totalIncome}
              prefix={<ArrowUpOutlined />}
              suffix="USD"
              precision={2}
              valueStyle={{ color: 'var(--boxmox-color-status-success)' }}
            />
            <div className={styles['stat-detail']}>
              <Text className={styles['stat-label']}>From farming & sales</Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['finance-stat-card']}>
            <Statistic
              title="Total Expenses"
              value={totalExpenses}
              prefix={<ArrowDownOutlined />}
              suffix="USD"
              precision={2}
              valueStyle={{ color: 'var(--boxmox-color-status-danger)' }}
            />
            <div className={styles['stat-detail']}>
              <Text className={styles['stat-label']}>Proxy, subs & session</Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['finance-stat-card']}>
            <Statistic
              title="Net Profit"
              value={netProfit}
              prefix={<DollarOutlined />}
              suffix="USD"
              precision={2}
              valueStyle={{
                color: netProfit >= 0 ? 'var(--boxmox-color-status-success)' : 'var(--boxmox-color-status-danger)'
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
          <Card className={styles['costs-card']} title="Cost Breakdown">
            <div className={styles['cost-item']}>
              <Text>Proxy Costs</Text>
              <Text strong>$15.00</Text>
            </div>
            <div className={styles['cost-item']}>
              <Text>Subscription</Text>
              <Text strong>$25.00</Text>
            </div>
            <div className={styles['cost-item']}>
              <Text>Session Costs</Text>
              <Text strong>$5.00</Text>
            </div>
            <div className={styles['cost-divider']} />
            <div className={[styles['cost-item'], styles.total].join(' ')}>
              <Text strong>Total Costs</Text>
              <Text strong className={styles['total-amount']}>
                $45.00
              </Text>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card className={styles['roi-card']} title="ROI Analysis">
            <div className={styles['roi-item']}>
              <Text>Total Invested</Text>
              <Text strong>$120.00</Text>
            </div>
            <div className={styles['roi-item']}>
              <Text>Total Returned</Text>
              <Text strong className={styles.positive}>$187.50</Text>
            </div>
            <div className={styles['roi-item']}>
              <Text>Payback Period</Text>
              <Text strong>12 days</Text>
            </div>
            <div className={styles['roi-divider']} />
            <div className={[styles['roi-item'], styles.total].join(' ')}>
              <Text strong>Profit per Day</Text>
              <Text strong className={styles.positive}>$5.62</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Таблица транзакций */}
      <Card
        className={styles['transactions-card']}
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
        />
      </Card>
    </div>
  );
};
