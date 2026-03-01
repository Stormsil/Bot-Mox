import { SettingOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, ColorPicker, Popover, Select } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getFinanceChartConfig,
  saveFinanceChartConfig,
} from '../../entities/finance/api/chartConfig';
import type { ChartSeriesConfig } from '../../entities/finance/model/chart';
import type { GoldPriceHistoryEntry, TimeSeriesData } from '../../entities/finance/model/types';
import styles from './UniversalChart.module.css';

interface UniversalChartProps {
  timeSeriesData: TimeSeriesData[];
  goldPriceHistory: GoldPriceHistoryEntry[];
  loading?: boolean;
  timeRange: number;
  onTimeRangeChange: (days: number) => void;
}

const DEFAULT_CONFIG: ChartSeriesConfig[] = [
  {
    key: 'income',
    name: 'Income',
    color: '#9a9a9a',
    type: 'line',
    yAxisId: 'left',
    visible: true,
    unit: '$',
  },
  {
    key: 'expense',
    name: 'Expense',
    color: '#7a7a7a',
    type: 'line',
    yAxisId: 'left',
    visible: true,
    unit: '$',
  },
  {
    key: 'profit',
    name: 'Profit',
    color: '#8b8b8b',
    type: 'line',
    yAxisId: 'left',
    visible: true,
    unit: '$',
  },
  {
    key: 'dailyProfit',
    name: 'Daily Net',
    color: '#5f5f5f',
    type: 'bar',
    yAxisId: 'left',
    visible: false,
    unit: '$',
  },
  {
    key: 'gold_price_wow_tbc',
    name: 'Gold Price (TBC)',
    color: '#8a8a8a',
    type: 'line',
    yAxisId: 'right',
    visible: true,
    unit: '$',
  },
  {
    key: 'gold_price_wow_midnight',
    name: 'Gold Price (Midnight)',
    color: '#6f6f6f',
    type: 'line',
    yAxisId: 'right',
    visible: true,
    unit: '$',
  },
];

type ChartDataPoint = {
  date: string;
} & Record<string, string | number | undefined>;

interface TooltipPayloadEntry {
  dataKey?: string;
  color?: string;
  name?: string;
  value?: number | string;
}

interface CustomChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  config: ChartSeriesConfig[];
}

const CustomChartTooltip: React.FC<CustomChartTooltipProps> = ({
  active,
  payload,
  label,
  config,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipDate}>{label}</p>
        {payload.map((entry) => {
          const dataKey = String(entry.dataKey || '');
          const conf = config.find((item) => item.key === dataKey);
          if (!conf) return null;

          return (
            <p key={dataKey || entry.name} style={{ color: entry.color }}>
              {entry.name}:{' '}
              {conf.unit === '$' ? `$${Number(entry.value || 0).toFixed(2)}` : entry.value}
            </p>
          );
        })}
      </div>
    );
  }

  return null;
};

export const UniversalChart: React.FC<UniversalChartProps> = (props) => {
  const { timeSeriesData, goldPriceHistory, loading = false } = props;
  const [config, setConfig] = useState<ChartSeriesConfig[]>(DEFAULT_CONFIG);

  // Load config from DB on mount
  useEffect(() => {
    getFinanceChartConfig().then((savedConfig) => {
      if (savedConfig) {
        // Merge saved config with default to ensure new keys exist
        const mergedConfig = [...savedConfig];

        // Add any missing keys from DEFAULT_CONFIG
        DEFAULT_CONFIG.forEach((defaultItem) => {
          if (!mergedConfig.find((c) => c.key === defaultItem.key)) {
            mergedConfig.push(defaultItem);
          }
        });

        setConfig(mergedConfig);
      }
    });
  }, []);

  // Merge data
  const chartData = useMemo(() => {
    const dataMap = new Map<string, ChartDataPoint>();

    // Add time series data
    timeSeriesData.forEach((item) => {
      dataMap.set(item.date, {
        ...item,
        // Ensure cumulativeProfit is present (it is in item, but explicit check doesn't hurt)
      });
    });

    // Add gold price data
    goldPriceHistory.forEach((item) => {
      const existing = dataMap.get(item.date) || { date: item.date };
      // Handle compatibility project IDs if needed or just use current ones
      const key = `gold_price_${item.project_id}`;
      existing[key] = item.price;
      dataMap.set(item.date, existing);
    });

    // Convert to array and sort
    return Array.from(dataMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [timeSeriesData, goldPriceHistory]);

  const handleConfigChange = (key: string, updates: Partial<ChartSeriesConfig>) => {
    const newConfig = config.map((item) => (item.key === key ? { ...item, ...updates } : item));
    setConfig(newConfig);
    // Debounce save or just save? Let's just save for now, it's low frequency.
    saveFinanceChartConfig(newConfig);
  };

  const renderSettingsContent = () => (
    <div className={styles.settingsPopover}>
      {config.map((item) => (
        <div key={item.key} className={styles.settingRow}>
          <Checkbox
            checked={item.visible}
            onChange={(e) => handleConfigChange(item.key, { visible: e.target.checked })}
          >
            {item.name}
          </Checkbox>
          <div className={styles.settingControls}>
            <ColorPicker
              value={item.color}
              onChange={(c) => handleConfigChange(item.key, { color: c.toHexString() })}
              size="small"
            />
            <Select
              value={item.type}
              onChange={(val) => handleConfigChange(item.key, { type: val })}
              size="small"
              style={{ width: 80 }}
              options={[
                { value: 'line', label: 'Line' },
                { value: 'bar', label: 'Bar' },
              ]}
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card
      className={styles.card}
      title="Financial Overview"
      loading={loading}
      extra={
        <Popover
          content={renderSettingsContent}
          title="Chart Settings"
          trigger="click"
          placement="bottomRight"
        >
          <Button
            className={styles.settingsButton}
            icon={<SettingOutlined />}
            size="small"
            type="text"
          >
            Settings
          </Button>
        </Popover>
      }
    >
      <div className={styles.container}>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--boxmox-color-border-default)"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--boxmox-color-text-secondary)' }}
              tickFormatter={(date) =>
                new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              }
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              tickFormatter={(val) => `$${val}`}
              tick={{ fontSize: 11, fill: 'var(--boxmox-color-text-secondary)' }}
              label={{
                value: 'Amount (USD)',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: 'var(--boxmox-color-text-muted)' },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(val) => `$${val}`}
              tick={{ fontSize: 11, fill: 'var(--boxmox-color-text-secondary)' }}
              label={{
                value: 'Gold Price',
                angle: 90,
                position: 'insideRight',
                style: { textAnchor: 'middle', fill: 'var(--boxmox-color-text-muted)' },
              }}
            />
            <Tooltip content={<CustomChartTooltip config={config} />} />
            <Legend wrapperStyle={{ color: 'var(--boxmox-color-text-secondary)', fontSize: 11 }} />

            {config.map((item) => {
              if (!item.visible) return null;

              if (item.type === 'bar') {
                return (
                  <Bar
                    key={item.key}
                    dataKey={item.key}
                    name={item.name}
                    fill={item.color}
                    yAxisId={item.yAxisId}
                  />
                );
              }

              return (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.name}
                  stroke={item.color}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6 }}
                  yAxisId={item.yAxisId}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
