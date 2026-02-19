export interface ChartSeriesConfig {
  key: string;
  name: string;
  color: string;
  type: 'line' | 'bar';
  yAxisId: string;
  visible: boolean;
  unit: string;
}
