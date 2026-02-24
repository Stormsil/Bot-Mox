type ClassValue = string | false | null | undefined;
type CssModuleMap = Record<string, string>;

function splitClassNames(value: ClassValue): string[] {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean);
}

export function cx(...values: ClassValue[]): string {
  return values.flatMap(splitClassNames).join(' ');
}

export function bindCssModuleCx(...styleMaps: CssModuleMap[]): (...values: ClassValue[]) => string {
  return (...values: ClassValue[]) =>
    values
      .flatMap(splitClassNames)
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

