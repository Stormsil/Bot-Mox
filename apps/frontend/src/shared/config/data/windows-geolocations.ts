import { loadLazyJson } from './lazy-json';

/** Windows GeoId entries for Set-WinHomeLocation. */
export interface WindowsGeoLocation {
  id: number;
  name: string;
  iso2: string;
}

const WINDOWS_GEOLOCATIONS_URL = new URL('./windows-geolocations.json', import.meta.url).href;

export function getWindowsGeoLocations(): Promise<WindowsGeoLocation[]> {
  return loadLazyJson<WindowsGeoLocation[]>(WINDOWS_GEOLOCATIONS_URL);
}
