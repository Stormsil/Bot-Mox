import { loadLazyJson } from './lazy-json';
import type { KeyboardLanguageGroup, KeyboardLayout } from './windows-keyboards/types';

export type { KeyboardLanguageGroup, KeyboardLayout } from './windows-keyboards/types';

const WINDOWS_KEYBOARDS_URL = new URL('./windows-keyboards.json', import.meta.url).href;

export function getKeyboardGroups(): Promise<KeyboardLanguageGroup[]> {
  return loadLazyJson<KeyboardLanguageGroup[]>(WINDOWS_KEYBOARDS_URL);
}

/** Get keyboard layouts for a given language tag. */
export function getKeyboardLayoutsForLanguage(
  groups: KeyboardLanguageGroup[],
  tag: string,
): KeyboardLayout[] {
  const group = groups.find((entry) => entry.tag === tag);
  return group?.layouts ?? [];
}

/** Format a keyboard pair as Windows inputLocale string (e.g. "0409:00000409"). */
export function formatInputLocale(languageId: string, layoutId: string): string {
  return `${languageId}:${layoutId}`;
}
