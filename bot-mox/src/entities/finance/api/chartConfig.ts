import { uiLogger } from '../../../observability/uiLogger';
import { readSettingsPath, writeSettingsPath } from '../../settings/api/settingsPathClient';
import type { ChartSeriesConfig } from '../model/chart';

const CHART_CONFIG_PATH = 'finance/chart_config';

export async function saveFinanceChartConfig(config: ChartSeriesConfig[]): Promise<void> {
  await writeSettingsPath(CHART_CONFIG_PATH, config);
}

export async function getFinanceChartConfig(): Promise<ChartSeriesConfig[] | null> {
  try {
    const response = await readSettingsPath<unknown>(CHART_CONFIG_PATH);
    return Array.isArray(response) ? (response as ChartSeriesConfig[]) : null;
  } catch (error) {
    uiLogger.error('Error fetching finance chart config:', error);
    return null;
  }
}
