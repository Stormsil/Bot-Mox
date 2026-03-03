import { uiLogger } from '../../../observability/uiLogger';
import { readSettingsPath, writeSettingsPath } from '../../settings/api/settingsPathClient';
import type { ChartSeriesConfig } from '../model/chart';

const CHART_CONFIG_PATH = 'finance/chart_config';

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const FALLBACK_COLOR_BY_KEY: Record<string, string> = {
  income: 'var(--botmox-color-status-success)',
  expense: 'var(--botmox-color-status-danger)',
  profit: 'var(--botmox-color-brand-primary)',
  dailyProfit: 'var(--botmox-color-text-secondary)',
  gold_price_wow_tbc: 'var(--botmox-color-status-info)',
  gold_price_wow_midnight: 'var(--botmox-color-brand-warning)',
};

const LEGACY_HEX_TO_TOKEN: Record<string, string> = {
  '#52c41a': 'var(--botmox-color-status-success)',
  '#ff4d4f': 'var(--botmox-color-status-danger)',
  '#1890ff': 'var(--botmox-color-brand-primary)',
  '#8c8c8c': 'var(--botmox-color-text-secondary)',
  '#13c2c2': 'var(--botmox-color-status-info)',
  '#faad14': 'var(--botmox-color-brand-warning)',
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getFallbackColor(key: string): string {
  return FALLBACK_COLOR_BY_KEY[key] ?? 'var(--botmox-color-text-secondary)';
}

function sanitizeColor(color: unknown, key: string): string {
  if (typeof color !== 'string') {
    return getFallbackColor(key);
  }

  const normalizedColor = color.trim();
  if (normalizedColor.startsWith('var(--botmox-')) {
    return normalizedColor;
  }

  if (HEX_COLOR_PATTERN.test(normalizedColor)) {
    const mapped = LEGACY_HEX_TO_TOKEN[normalizedColor.toLowerCase()];
    return mapped ?? getFallbackColor(key);
  }

  return getFallbackColor(key);
}

function sanitizeChartConfigItem(value: unknown): ChartSeriesConfig | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const key = typeof value.key === 'string' ? value.key : '';
  const name = typeof value.name === 'string' ? value.name : '';
  const yAxisId = typeof value.yAxisId === 'string' ? value.yAxisId : '';
  const unit = typeof value.unit === 'string' ? value.unit : '';
  const visible = typeof value.visible === 'boolean' ? value.visible : true;

  if (key.length === 0 || name.length === 0 || yAxisId.length === 0 || unit.length === 0) {
    return null;
  }

  const type = value.type === 'bar' || value.type === 'line' ? value.type : 'line';

  return {
    key,
    name,
    color: sanitizeColor(value.color, key),
    type,
    yAxisId,
    visible,
    unit,
  };
}

function sanitizeChartConfig(config: unknown): ChartSeriesConfig[] {
  if (!Array.isArray(config)) {
    return [];
  }

  return config
    .map((item) => sanitizeChartConfigItem(item))
    .filter((item): item is ChartSeriesConfig => item !== null);
}

export async function saveFinanceChartConfig(config: ChartSeriesConfig[]): Promise<void> {
  await writeSettingsPath(CHART_CONFIG_PATH, sanitizeChartConfig(config));
}

export async function getFinanceChartConfig(): Promise<ChartSeriesConfig[] | null> {
  try {
    const response = await readSettingsPath<unknown>(CHART_CONFIG_PATH);
    if (!Array.isArray(response)) {
      return null;
    }

    return sanitizeChartConfig(response);
  } catch (error) {
    uiLogger.error('Error fetching finance chart config:', error);
    return null;
  }
}
