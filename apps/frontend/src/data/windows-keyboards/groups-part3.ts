import type { KeyboardLanguageGroup } from './types';

export const KEYBOARD_GROUPS_PART3: KeyboardLanguageGroup[] = [
  {
    tag: 'ro-RO',
    name: 'Romanian',
    languageId: '0418',
    layouts: [
      { id: '00010418', name: 'Romanian (Standard)', languageId: '0418' },
      { id: '00000418', name: 'Romanian (Legacy)', languageId: '0418' },
      { id: '00020418', name: 'Romanian (Programmers)', languageId: '0418' },
    ],
  },
  {
    tag: 'ru-RU',
    name: 'Russian',
    languageId: '0419',
    layouts: [
      { id: '00000419', name: 'Russian', languageId: '0419' },
      { id: '00010419', name: 'Russian (Typewriter)', languageId: '0419' },
      { id: '00020419', name: 'Russian - Mnemonic', languageId: '0419' },
    ],
  },
  {
    tag: 'sk-SK',
    name: 'Slovak',
    languageId: '041B',
    layouts: [
      { id: '0000041B', name: 'Slovak', languageId: '041B' },
      { id: '0001041B', name: 'Slovak (QWERTY)', languageId: '041B' },
    ],
  },
  {
    tag: 'sl-SI',
    name: 'Slovenian',
    languageId: '0424',
    layouts: [{ id: '00000424', name: 'Slovenian', languageId: '0424' }],
  },
  {
    tag: 'sr-Latn-RS',
    name: 'Serbian (Latin)',
    languageId: '081A',
    layouts: [{ id: '0000081A', name: 'Serbian (Latin)', languageId: '081A' }],
  },
  {
    tag: 'sv-SE',
    name: 'Swedish',
    languageId: '041D',
    layouts: [
      { id: '0000041D', name: 'Swedish', languageId: '041D' },
      { id: '0000083B', name: 'Swedish with Sami', languageId: '041D' },
    ],
  },
  {
    tag: 'th-TH',
    name: 'Thai',
    languageId: '041E',
    layouts: [
      { id: '0000041E', name: 'Thai Kedmanee', languageId: '041E' },
      { id: '0001041E', name: 'Thai Pattachote', languageId: '041E' },
      { id: '0002041E', name: 'Thai Kedmanee (non-ShiftLock)', languageId: '041E' },
      { id: '0003041E', name: 'Thai Pattachote (non-ShiftLock)', languageId: '041E' },
    ],
  },
  {
    tag: 'tr-TR',
    name: 'Turkish',
    languageId: '041F',
    layouts: [
      { id: '0000041F', name: 'Turkish Q', languageId: '041F' },
      { id: '0001041F', name: 'Turkish F', languageId: '041F' },
    ],
  },
  {
    tag: 'uk-UA',
    name: 'Ukrainian',
    languageId: '0422',
    layouts: [
      { id: '00000422', name: 'Ukrainian', languageId: '0422' },
      { id: '00020422', name: 'Ukrainian (Enhanced)', languageId: '0422' },
    ],
  },
  {
    tag: 'vi-VN',
    name: 'Vietnamese',
    languageId: '042A',
    layouts: [{ id: '0000042A', name: 'Vietnamese', languageId: '042A' }],
  },
  {
    tag: 'zh-CN',
    name: 'Chinese (Simplified)',
    languageId: '0804',
    layouts: [
      { id: 'E0010804', name: 'Chinese (Simplified) - Microsoft Pinyin', languageId: '0804' },
      { id: '00000804', name: 'Chinese (Simplified) - US', languageId: '0804' },
    ],
  },
  {
    tag: 'zh-TW',
    name: 'Chinese (Traditional)',
    languageId: '0404',
    layouts: [
      { id: 'E0010404', name: 'Chinese (Traditional) - New Phonetic', languageId: '0404' },
      { id: 'E0020404', name: 'Chinese (Traditional) - ChangJie', languageId: '0404' },
      { id: '00000404', name: 'Chinese (Traditional) - US', languageId: '0404' },
    ],
  },
];
