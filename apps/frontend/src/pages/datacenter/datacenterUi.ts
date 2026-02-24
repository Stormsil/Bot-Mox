import { bindCssModuleCx } from '../../shared/lib/classNames';
import layoutStyles from './DatacenterPageLayout.module.css';
import metricStyles from './DatacenterPageMetrics.module.css';

const styles = { ...layoutStyles, ...metricStyles };

export const cx = bindCssModuleCx(styles);

export const mapCardStyles = {
  body: { padding: '14px 16px' },
} as const;
