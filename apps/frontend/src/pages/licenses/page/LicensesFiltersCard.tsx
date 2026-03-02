import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';

import type React from 'react';
import {
  AppButton as Button,
  AppCard as Card,
  AppInput as Input,
  AppSelect as Select,
  AppSpace as Space,
} from '../../../shared/ui';
import styles from '../LicensesPage.module.css';

const { Option } = Select;

interface LicensesFiltersCardProps {
  searchText: string;
  statusFilter: string;
  typeFilter: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onReset: () => void;
}

export const LicensesFiltersCard: React.FC<LicensesFiltersCardProps> = ({
  searchText,
  statusFilter,
  typeFilter,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onReset,
}) => (
  <Card className={styles.filters}>
    <Space wrap className={styles.filtersSpace}>
      <Input
        placeholder="Search by key or bot..."
        prefix={<SearchOutlined />}
        size="small"
        value={searchText}
        onChange={(event) => onSearchChange(event.target.value)}
        className={styles.filterSearch}
        variant="filled"
      />
      <Select
        placeholder="Status"
        size="small"
        value={statusFilter}
        onChange={onStatusChange}
        className={styles.filterSelect}
        variant="filled"
      >
        <Option value="all">All Statuses</Option>
        <Option value="active">Active</Option>
        <Option value="expired">Expired</Option>
        <Option value="revoked">Revoked</Option>
      </Select>
      <Select
        placeholder="Type"
        size="small"
        value={typeFilter}
        onChange={onTypeChange}
        className={styles.filterSelect}
        variant="filled"
      >
        <Option value="all">All Types</Option>
        <Option value="sin">SIN</Option>
        <Option value="other">Other</Option>
      </Select>
      <Button
        icon={<ReloadOutlined />}
        size="small"
        onClick={onReset}
        className={styles.resetButton}
      >
        Reset
      </Button>
    </Space>
  </Card>
);
