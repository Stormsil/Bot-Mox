import { KEYBOARD_GROUPS_PART1 } from './windows-keyboards/groups-part1';
import { KEYBOARD_GROUPS_PART2 } from './windows-keyboards/groups-part2';
import { KEYBOARD_GROUPS_PART3 } from './windows-keyboards/groups-part3';
import type { KeyboardLanguageGroup, KeyboardLayout } from './windows-keyboards/types';

export type { KeyboardLanguageGroup, KeyboardLayout } from './windows-keyboards/types';

export const KEYBOARD_GROUPS: KeyboardLanguageGroup[] = [
  ...KEYBOARD_GROUPS_PART1,
  ...KEYBOARD_GROUPS_PART2,
  ...KEYBOARD_GROUPS_PART3,
];

/** Get keyboard layouts for a given language tag. */
export function getKeyboardLayoutsForLanguage(tag: string): KeyboardLayout[] {
  const group = KEYBOARD_GROUPS.find((g) => g.tag === tag);
  return group?.layouts ?? [];
}

/** Format a keyboard pair as Windows inputLocale string (e.g. "0409:00000409"). */
export function formatInputLocale(languageId: string, layoutId: string): string {
  return `${languageId}:${layoutId}`;
}
