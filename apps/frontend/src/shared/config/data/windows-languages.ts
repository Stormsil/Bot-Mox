import { loadLazyJson } from './lazy-json';

/** Windows UI language definitions (locale tag -> display name). */
export interface WindowsLanguage {
  tag: string;
  name: string;
  nativeName: string;
}

const WINDOWS_LANGUAGES_URL = new URL('./windows-languages.json', import.meta.url).href;

export function getWindowsLanguages(): Promise<WindowsLanguage[]> {
  return loadLazyJson<WindowsLanguage[]>(WINDOWS_LANGUAGES_URL);
}
