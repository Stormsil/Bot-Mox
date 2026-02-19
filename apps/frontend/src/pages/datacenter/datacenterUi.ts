import styles from './DatacenterPage.module.css';

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
