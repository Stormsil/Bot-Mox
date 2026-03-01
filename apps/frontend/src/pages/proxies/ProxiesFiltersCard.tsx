import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select } from 'antd';
import type React from 'react';
import styles from './ProxiesPage.module.css';
import type { ProxiesTableFilterValues } from './proxiesTableFilters';

const { Option } = Select;

interface ProxiesFiltersCardProps {
  filters: ProxiesTableFilterValues;
  countries: string[];
  onChange: (nextPartial: Partial<ProxiesTableFilterValues>) => void;
  onReset: () => void;
}

export const ProxiesFiltersCard: React.FC<ProxiesFiltersCardProps> = ({
  filters,
  countries,
  onChange,
  onReset,
}) => (
  <Card className={styles.filters}>
    <div className={styles.filtersRow}>
      <Input
        placeholder="Search by IP, provider, country, ISP..."
        prefix={<SearchOutlined />}
        size="small"
        value={filters.q}
        onChange={(event) => onChange({ q: event.target.value })}
        className={styles.filterSearch}
      />
      <Select
        placeholder="Status"
        size="small"
        value={filters.status}
        onChange={(value) => onChange({ status: value })}
        className={styles.filterSelectMd}
      >
        <Option value="all">All Statuses</Option>
        <Option value="active">Active</Option>
        <Option value="expired">Expired</Option>
        <Option value="banned">Banned</Option>
      </Select>
      <Select
        placeholder="Type"
        size="small"
        value={filters.type}
        onChange={(value) => onChange({ type: value })}
        className={styles.filterSelectSm}
      >
        <Option value="all">All Types</Option>
        <Option value="http">HTTP</Option>
        <Option value="socks5">SOCKS5</Option>
      </Select>
      <Select
        placeholder="Country"
        size="small"
        value={filters.country}
        onChange={(value) => onChange({ country: value })}
        className={styles.filterSelectMd}
      >
        <Option value="all">All Countries</Option>
        {countries.map((country) => (
          <Option key={country} value={country}>
            {country}
          </Option>
        ))}
      </Select>
      <Button size="small" icon={<ReloadOutlined />} onClick={onReset}>
        Reset
      </Button>
    </div>
  </Card>
);
