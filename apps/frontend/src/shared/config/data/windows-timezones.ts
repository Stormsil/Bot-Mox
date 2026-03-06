import { loadLazyJson } from './lazy-json';

/** Windows timezone IDs with UTC offset and display name. */
export interface WindowsTimezone {
  id: string;
  utcOffset: string;
  displayName: string;
}

const WINDOWS_TIMEZONES_URL = new URL('./windows-timezones.json', import.meta.url).href;

export function getWindowsTimezones(): Promise<WindowsTimezone[]> {
  return loadLazyJson<WindowsTimezone[]>(WINDOWS_TIMEZONES_URL);
}
