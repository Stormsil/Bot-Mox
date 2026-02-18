import React, { useState, useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  DatePicker,
  Select,
  Input,
  Row,
  Col,
  Popconfirm,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { FinanceOperation, FinanceOperationType, FinanceCategory } from '../../types';
import { formatTimestampToDate } from '../../services/financeService';
import { TableActionButton, TableActionGroup } from '../ui/TableActionButton';
import commonStyles from './FinanceCommon.module.css';
import styles from './FinanceTransactions.module.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface FinanceTransactionsProps {
  operations: FinanceOperation[];
  loading?: boolean;
  onAdd: () => void;
  onEdit: (operation: FinanceOperation) => void;
  onDelete: (id: string) => void;
}

// Цвета для категорий
// Метки для категорий
const CATEGORY_LABELS: Record<string, string> = {
  sale: 'Sale',
  subscription_bot: 'Bot Subscription',
  subscription_game: 'Game Subscription',
  proxy: 'Proxy',
  license: 'License',
  other: 'Other',
};

export const FinanceTransactions: React.FC<FinanceTransactionsProps> = ({
  operations,
  loading = false,
  onAdd,
  onEdit,
  onDelete,
}) => {
  // Состояния фильтров
  const [filterType, setFilterType] = useState<FinanceOperationType | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<FinanceCategory | 'all'>('all');
  const [filterProject, setFilterProject] = useState<'wow_tbc' | 'wow_midnight' | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // Фильтрация операций
  const filteredOperations = useMemo(() => {
    return operations.filter((op) => {
      // Фильтр по типу
      if (filterType !== 'all' && op.type !== filterType) return false;

      // Фильтр по категории
      if (filterCategory !== 'all' && op.category !== filterCategory) return false;

      // Фильтр по проекту
      if (filterProject !== 'all' && op.project_id !== filterProject) return false;

      // Фильтр по поиску
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesDescription = op.description.toLowerCase().includes(searchLower);
        const matchesAmount = op.amount.toString().includes(searchLower);
        if (!matchesDescription && !matchesAmount) return false;
      }

      // Фильтр по дате
      if (dateRange) {
        const [start, end] = dateRange;
        const opDate = formatTimestampToDate(op.date);
        if (opDate < start || opDate > end) return false;
      }

      return true;
    });
  }, [operations, filterType, filterCategory, filterProject, searchText, dateRange]);

  const tableCellClassName = styles.tableCell;
  const tableHeaderCellProps = { className: styles.tableHeaderCell };

  // Колонки таблицы
  const columns: ColumnsType<FinanceOperation> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      className: tableCellClassName,
      onHeaderCell: () => tableHeaderCellProps,
      render: (date: number) => formatTimestampToDate(date),
      sorter: (a: FinanceOperation, b: FinanceOperation) => a.date - b.date,
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      className: tableCellClassName,
      onHeaderCell: () => tableHeaderCellProps,
      render: (type: FinanceOperationType) => (
        <Tag className={`${commonStyles.financeTag} ${styles.transactionTypeTag}`}>
          {type === 'income' ? 'Income' : 'Expense'}
        </Tag>
      ),
      filters: [
        { text: 'Income', value: 'income' },
        { text: 'Expense', value: 'expense' },
      ],
      onFilter: (value: React.Key | boolean, record: FinanceOperation) => record.type === value,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      className: tableCellClassName,
      onHeaderCell: () => tableHeaderCellProps,
      render: (category: string) => (
        <Tag className={commonStyles.financeTag}>
          {CATEGORY_LABELS[category] || category}
        </Tag>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'project_id',
      key: 'project_id',
      width: 120,
      className: tableCellClassName,
      onHeaderCell: () => tableHeaderCellProps,
      render: (projectId: string | null) => {
        if (!projectId) return '-';
        return (
          <Tag className={commonStyles.financeTag}>
            {projectId === 'wow_tbc' ? 'TBC' : 'Midnight'}
          </Tag>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      className: tableCellClassName,
      onHeaderCell: () => tableHeaderCellProps,
    },
    {
      title: 'Gold Amount',
      dataIndex: 'gold_amount',
      key: 'gold_amount',
      width: 120,
      className: tableCellClassName,
      onHeaderCell: () => tableHeaderCellProps,
      render: (amount: number | undefined) => {
        if (!amount) return '-';
        return <Text>{amount.toLocaleString()}g</Text>;
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      className: tableCellClassName,
      onHeaderCell: () => tableHeaderCellProps,
      render: (amount: number, record: FinanceOperation) => (
        <Text className={styles.amountNeutral}>
          {record.type === 'income' ? '+' : '-'}${amount.toFixed(2)}
        </Text>
      ),
      sorter: (a: FinanceOperation, b: FinanceOperation) => a.amount - b.amount,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      className: tableCellClassName,
      onHeaderCell: () => tableHeaderCellProps,
      render: (_value: unknown, record: FinanceOperation) => (
        <TableActionGroup>
          <TableActionButton icon={<EditOutlined />} onClick={() => onEdit(record)} tooltip="Edit" />
          <Popconfirm
            title="Delete transaction"
            description="Are you sure you want to delete this transaction?"
            onConfirm={() => onDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <TableActionButton danger icon={<DeleteOutlined />} tooltip="Delete" />
          </Popconfirm>
        </TableActionGroup>
      ),
    },
  ];

  // Экспорт в CSV
  const handleExport = () => {
    const headers = ['Date', 'Type', 'Category', 'Project', 'Description', 'Gold Amount', 'Amount'];
    const rows = filteredOperations.map((op) => [
      formatTimestampToDate(op.date),
      op.type,
      op.category,
      op.project_id || '',
      op.description,
      op.gold_amount?.toString() || '',
      op.amount.toString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `finance_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className={styles.container}>
      {/* Фильтры */}
      <Card className={styles.filtersCard}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Space wrap className={styles.filtersRow}>
              <Select
                value={filterType}
                onChange={setFilterType}
                className={styles.filterTypeSelect}
                placeholder="Type"
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'income', label: 'Income' },
                  { value: 'expense', label: 'Expense' },
                ]}
              />
              <Select
                value={filterCategory}
                onChange={setFilterCategory}
                className={styles.filterCategorySelect}
                placeholder="Category"
                options={[
                  { value: 'all', label: 'All Categories' },
                  { value: 'sale', label: 'Sale' },
                  { value: 'subscription_bot', label: 'Bot Subscription' },
                  { value: 'subscription_game', label: 'Game Subscription' },
                  { value: 'proxy', label: 'Proxy' },
                  { value: 'license', label: 'License' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              <Select
                value={filterProject}
                onChange={setFilterProject}
                className={styles.filterProjectSelect}
                placeholder="Project"
                options={[
                  { value: 'all', label: 'All Projects' },
                  { value: 'wow_tbc', label: 'WoW TBC' },
                  { value: 'wow_midnight', label: 'WoW Midnight' },
                ]}
              />
              <RangePicker
                className={styles.filterRange}
                onChange={(dates) => {
                  if (dates) {
                    setDateRange([dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')]);
                  } else {
                    setDateRange(null);
                  }
                }}
              />
              <Input
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined />}
                className={styles.filterSearch}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                Export
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                Add Transaction
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Таблица транзакций */}
      <Card className={styles.transactionsCard} styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={filteredOperations}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} transactions`,
          }}
          size="small"
          className={styles.transactionsTable}
          rowClassName={() => styles.tableRow}
          locale={{
            emptyText: <Empty description="No transactions found" />,
          }}
        />
      </Card>
    </div>
  );
};
