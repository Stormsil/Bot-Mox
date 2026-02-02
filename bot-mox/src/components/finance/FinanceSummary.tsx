import React from 'react';
import { Card, Row, Col, Statistic, Typography, Empty } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  GoldOutlined,
  ShoppingOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import type { FinanceSummary as FinanceSummaryType, CategoryBreakdown, TimeSeriesData } from '../../types';
import './FinanceSummary.css';

const { Title, Text } = Typography;

// Цвета для графиков
const COLORS = {
  income: '#52c41a',
  expense: '#f5222d',
  profit: '#1890ff',
  categories: ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'],
};

interface FinanceSummaryProps {
  summary: FinanceSummaryType;
  incomeBreakdown: CategoryBreakdown[];
  expenseBreakdown: CategoryBreakdown[];
  timeSeriesData: TimeSeriesData[];
  loading?: boolean;
}

export const FinanceSummary: React.FC<FinanceSummaryProps> = ({
  summary,
  incomeBreakdown,
  expenseBreakdown,
  timeSeriesData,
  loading = false,
}) => {
  // Форматирование валюты
  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  // Форматирование золота
  const formatGold = (value: number) => {
    return `${value.toLocaleString()}g`;
  };

  // Данные для круговой диаграммы расходов
  const expensePieData = expenseBreakdown.map((item) => ({
    name: item.category.replace(/_/g, ' ').toUpperCase(),
    value: item.amount,
    percentage: item.percentage,
  }));

  // Данные для круговой диаграммы доходов
  const incomePieData = incomeBreakdown.map((item) => ({
    name: item.category.toUpperCase(),
    value: item.amount,
    percentage: item.percentage,
  }));

  // Кастомный tooltip для графиков
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-label">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="chart-tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Кастомный tooltip для pie chart
  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-label">{data.name}</p>
          <p className="chart-tooltip-value">
            {formatCurrency(data.value)} ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="finance-summary-container">
      {/* Основные метрики */}
      <Row gutter={[16, 16]} className="metrics-row">
        <Col span={6}>
          <Card className="metric-card income" loading={loading}>
            <Statistic
              title="Total Income"
              value={summary.totalIncome}
              prefix={<ArrowUpOutlined />}
              suffix="USD"
              precision={2}
              valueStyle={{ color: COLORS.income }}
            />
            <Text className="metric-label">From all sources</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="metric-card expense" loading={loading}>
            <Statistic
              title="Total Expenses"
              value={summary.totalExpenses}
              prefix={<ArrowDownOutlined />}
              suffix="USD"
              precision={2}
              valueStyle={{ color: COLORS.expense }}
            />
            <Text className="metric-label">All categories</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="metric-card profit" loading={loading}>
            <Statistic
              title="Net Profit"
              value={summary.netProfit}
              prefix={<DollarOutlined />}
              suffix="USD"
              precision={2}
              valueStyle={{
                color: summary.netProfit >= 0 ? COLORS.income : COLORS.expense,
              }}
            />
            <Text className="metric-label">
              {summary.netProfit >= 0 ? 'Profit' : 'Loss'}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="metric-card gold" loading={loading}>
            <Statistic
              title="Gold Sold"
              value={summary.totalGoldSold}
              prefix={<GoldOutlined />}
              suffix="g"
              precision={0}
              valueStyle={{ color: '#faad14' }}
            />
            <Text className="metric-label">
              Avg price: ${summary.averageGoldPrice.toFixed(4)}/1000g
            </Text>
          </Card>
        </Col>
      </Row>

      {/* График доходов и расходов по времени */}
      <Card className="chart-card" title="Income & Expenses Over Time" loading={loading}>
        {timeSeriesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--proxmox-border)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--proxmox-text-muted)', fontSize: 12 }}
                stroke="var(--proxmox-border)"
              />
              <YAxis
                tick={{ fill: 'var(--proxmox-text-muted)', fontSize: 12 }}
                stroke="var(--proxmox-border)"
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke={COLORS.income}
                strokeWidth={2}
                dot={{ fill: COLORS.income, strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expenses"
                stroke={COLORS.expense}
                strokeWidth={2}
                dot={{ fill: COLORS.expense, strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke={COLORS.profit}
                strokeWidth={2}
                dot={{ fill: COLORS.profit, strokeWidth: 2 }}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Empty description="No data available" />
        )}
      </Card>

      {/* Pie charts для категорий */}
      <Row gutter={[16, 16]} className="charts-row">
        <Col span={12}>
          <Card className="chart-card" title="Income by Category" loading={loading}>
            {incomePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={incomePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {incomePieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS.categories[index % COLORS.categories.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No income data" />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card className="chart-card" title="Expenses by Category" loading={loading}>
            {expensePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expensePieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS.categories[index % COLORS.categories.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No expense data" />
            )}
          </Card>
        </Col>
      </Row>

      {/* График распределения по категориям (бар) */}
      <Card className="chart-card" title="Category Breakdown" loading={loading}>
        {expenseBreakdown.length > 0 || incomeBreakdown.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={[
                ...expenseBreakdown.map((item) => ({
                  name: item.category.replace(/_/g, ' '),
                  amount: item.amount,
                  type: 'Expense',
                })),
                ...incomeBreakdown.map((item) => ({
                  name: item.category,
                  amount: item.amount,
                  type: 'Income',
                })),
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--proxmox-border)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--proxmox-text-muted)', fontSize: 12 }}
                stroke="var(--proxmox-border)"
              />
              <YAxis
                tick={{ fill: 'var(--proxmox-text-muted)', fontSize: 12 }}
                stroke="var(--proxmox-border)"
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="amount" fill={COLORS.profit} name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty description="No category data" />
        )}
      </Card>
    </div>
  );
};
