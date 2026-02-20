import styles from '../SettingsPage.module.css';

export function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}
