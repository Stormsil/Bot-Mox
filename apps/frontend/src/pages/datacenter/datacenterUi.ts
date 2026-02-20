import layoutStyles from './DatacenterPageLayout.module.css';
import metricStyles from './DatacenterPageMetrics.module.css';

const styles = { ...layoutStyles, ...metricStyles };

export function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

export const mapCardStyles = {
  body: { padding: '14px 16px' },
} as const;
