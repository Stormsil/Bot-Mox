import { type ClassValue, clsx } from 'clsx';

type CssModuleMap = Record<string, string>;

export function cx(...values: ClassValue[]): string {
  return clsx(values);
}

export function bindCssModuleCx(...styleMaps: CssModuleMap[]): (...values: ClassValue[]) => string {
  return (...values: ClassValue[]) =>
    clsx(values)
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => {
        for (const styles of styleMaps) {
          if (styles[name]) {
            return styles[name];
          }
        }
        return name;
      })
      .join(' ');
}
