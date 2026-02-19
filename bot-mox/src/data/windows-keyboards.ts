/**
 * Windows keyboard layouts grouped by language tag.
 * Format: languageId:layoutId (e.g. "0409:00000409" for US English).
 */

export interface KeyboardLayout {
  id: string; // e.g. "00000409"
  name: string; // e.g. "US"
  languageId: string; // e.g. "0409"
}

export interface KeyboardLanguageGroup {
  tag: string; // Windows locale tag, e.g. "en-US"
  name: string;
  languageId: string;
  layouts: KeyboardLayout[];
}

export const KEYBOARD_GROUPS: KeyboardLanguageGroup[] = [
  {
    tag: 'af-ZA',
    name: 'Afrikaans',
    languageId: '0436',
    layouts: [
      { id: '00000409', name: 'US', languageId: '0436' },
      { id: '00010409', name: 'US-Dvorak', languageId: '0436' },
    ],
  },
  {
    tag: 'ar-SA',
    name: 'Arabic (Saudi Arabia)',
    languageId: '0401',
    layouts: [
      { id: '00000401', name: 'Arabic (101)', languageId: '0401' },
      { id: '00010401', name: 'Arabic (102)', languageId: '0401' },
      { id: '00020401', name: 'Arabic (102) AZERTY', languageId: '0401' },
    ],
  },
  {
    tag: 'bg-BG',
    name: 'Bulgarian',
    languageId: '0402',
    layouts: [
      { id: '00030402', name: 'Bulgarian', languageId: '0402' },
      { id: '00000402', name: 'Bulgarian (Typewriter)', languageId: '0402' },
      { id: '00010402', name: 'Bulgarian (Latin)', languageId: '0402' },
      { id: '00040402', name: 'Bulgarian (Phonetic Traditional)', languageId: '0402' },
      { id: '00020402', name: 'Bulgarian (Phonetic)', languageId: '0402' },
    ],
  },
  {
    tag: 'cs-CZ',
    name: 'Czech',
    languageId: '0405',
    layouts: [
      { id: '00000405', name: 'Czech', languageId: '0405' },
      { id: '00010405', name: 'Czech (QWERTY)', languageId: '0405' },
      { id: '00020405', name: 'Czech Programmers', languageId: '0405' },
    ],
  },
  {
    tag: 'da-DK',
    name: 'Danish',
    languageId: '0406',
    layouts: [{ id: '00000406', name: 'Danish', languageId: '0406' }],
  },
  {
    tag: 'de-DE',
    name: 'German',
    languageId: '0407',
    layouts: [
      { id: '00000407', name: 'German', languageId: '0407' },
      { id: '00010407', name: 'German (IBM)', languageId: '0407' },
    ],
  },
  {
    tag: 'de-AT',
    name: 'German (Austria)',
    languageId: '0C07',
    layouts: [{ id: '00000407', name: 'German', languageId: '0C07' }],
  },
  {
    tag: 'de-CH',
    name: 'German (Switzerland)',
    languageId: '0807',
    layouts: [
      { id: '00000807', name: 'Swiss German', languageId: '0807' },
      { id: '00000807', name: 'Swiss French', languageId: '0807' },
    ],
  },
  {
    tag: 'el-GR',
    name: 'Greek',
    languageId: '0408',
    layouts: [
      { id: '00000408', name: 'Greek', languageId: '0408' },
      { id: '00010408', name: 'Greek (220)', languageId: '0408' },
      { id: '00030408', name: 'Greek (319)', languageId: '0408' },
      { id: '00020408', name: 'Greek (220) Latin', languageId: '0408' },
      { id: '00040408', name: 'Greek (319) Latin', languageId: '0408' },
      { id: '00050408', name: 'Greek Latin', languageId: '0408' },
      { id: '00060408', name: 'Greek Polytonic', languageId: '0408' },
    ],
  },
  {
    tag: 'en-US',
    name: 'English (US)',
    languageId: '0409',
    layouts: [
      { id: '00000409', name: 'US', languageId: '0409' },
      { id: '00010409', name: 'US-Dvorak', languageId: '0409' },
      { id: '00020409', name: 'United States-International', languageId: '0409' },
      { id: '00030409', name: 'US-Dvorak for Left Hand', languageId: '0409' },
      { id: '00040409', name: 'US-Dvorak for Right Hand', languageId: '0409' },
      { id: '00050409', name: 'US English Table for IBM Arabic 238_L', languageId: '0409' },
    ],
  },
  {
    tag: 'en-GB',
    name: 'English (UK)',
    languageId: '0809',
    layouts: [
      { id: '00000809', name: 'United Kingdom', languageId: '0809' },
      { id: '00000452', name: 'United Kingdom Extended', languageId: '0809' },
    ],
  },
  {
    tag: 'es-ES',
    name: 'Spanish (Spain)',
    languageId: '0C0A',
    layouts: [
      { id: '0000040A', name: 'Spanish', languageId: '0C0A' },
      { id: '0001040A', name: 'Spanish Variation', languageId: '0C0A' },
    ],
  },
  {
    tag: 'es-MX',
    name: 'Spanish (Mexico)',
    languageId: '080A',
    layouts: [{ id: '0000080A', name: 'Latin American', languageId: '080A' }],
  },
  {
    tag: 'et-EE',
    name: 'Estonian',
    languageId: '0425',
    layouts: [{ id: '00000425', name: 'Estonian', languageId: '0425' }],
  },
  {
    tag: 'fi-FI',
    name: 'Finnish',
    languageId: '040B',
    layouts: [
      { id: '0000040B', name: 'Finnish', languageId: '040B' },
      { id: '0001040B', name: 'Finnish with Sami', languageId: '040B' },
    ],
  },
  {
    tag: 'fr-FR',
    name: 'French (France)',
    languageId: '040C',
    layouts: [
      { id: '0000040C', name: 'French', languageId: '040C' },
      { id: '0001040C', name: 'French (AZERTY, NF Z71-300)', languageId: '040C' },
    ],
  },
  {
    tag: 'fr-CA',
    name: 'French (Canada)',
    languageId: '0C0C',
    layouts: [
      { id: '00001009', name: 'Canadian French', languageId: '0C0C' },
      { id: '00000C0C', name: 'Canadian French (Legacy)', languageId: '0C0C' },
      { id: '00011009', name: 'Canadian Multilingual Standard', languageId: '0C0C' },
    ],
  },
  {
    tag: 'he-IL',
    name: 'Hebrew',
    languageId: '040D',
    layouts: [
      { id: '0000040D', name: 'Hebrew', languageId: '040D' },
      { id: '0002040D', name: 'Hebrew (Standard)', languageId: '040D' },
    ],
  },
  {
    tag: 'hi-IN',
    name: 'Hindi',
    languageId: '0439',
    layouts: [
      { id: '00010439', name: 'Hindi Traditional', languageId: '0439' },
      { id: '00000439', name: 'Devanagari - INSCRIPT', languageId: '0439' },
    ],
  },
  {
    tag: 'hr-HR',
    name: 'Croatian',
    languageId: '041A',
    layouts: [{ id: '0000041A', name: 'Croatian', languageId: '041A' }],
  },
  {
    tag: 'hu-HU',
    name: 'Hungarian',
    languageId: '040E',
    layouts: [
      { id: '0000040E', name: 'Hungarian', languageId: '040E' },
      { id: '0001040E', name: 'Hungarian 101-key', languageId: '040E' },
    ],
  },
  {
    tag: 'id-ID',
    name: 'Indonesian',
    languageId: '0421',
    layouts: [{ id: '00000409', name: 'US', languageId: '0421' }],
  },
  {
    tag: 'it-IT',
    name: 'Italian',
    languageId: '0410',
    layouts: [
      { id: '00000410', name: 'Italian', languageId: '0410' },
      { id: '00010410', name: 'Italian (142)', languageId: '0410' },
    ],
  },
  {
    tag: 'ja-JP',
    name: 'Japanese',
    languageId: '0411',
    layouts: [
      { id: '00000411', name: 'Japanese', languageId: '0411' },
      { id: 'E0010411', name: 'Japanese (MS-IME)', languageId: '0411' },
    ],
  },
  {
    tag: 'ko-KR',
    name: 'Korean',
    languageId: '0412',
    layouts: [
      { id: 'E0010412', name: 'Korean (MS-IME)', languageId: '0412' },
      { id: '00000412', name: 'Korean', languageId: '0412' },
    ],
  },
  {
    tag: 'lt-LT',
    name: 'Lithuanian',
    languageId: '0427',
    layouts: [
      { id: '00010427', name: 'Lithuanian', languageId: '0427' },
      { id: '00000427', name: 'Lithuanian IBM', languageId: '0427' },
      { id: '00020427', name: 'Lithuanian Standard', languageId: '0427' },
    ],
  },
  {
    tag: 'lv-LV',
    name: 'Latvian',
    languageId: '0426',
    layouts: [
      { id: '00010426', name: 'Latvian (Standard)', languageId: '0426' },
      { id: '00000426', name: 'Latvian', languageId: '0426' },
    ],
  },
  {
    tag: 'nb-NO',
    name: 'Norwegian (Bokm\u00E5l)',
    languageId: '0414',
    layouts: [
      { id: '00000414', name: 'Norwegian', languageId: '0414' },
      { id: '0000043B', name: 'Norwegian with Sami', languageId: '0414' },
    ],
  },
  {
    tag: 'nl-NL',
    name: 'Dutch',
    languageId: '0413',
    layouts: [
      { id: '00000413', name: 'Dutch', languageId: '0413' },
      { id: '00000409', name: 'US', languageId: '0413' },
    ],
  },
  {
    tag: 'pl-PL',
    name: 'Polish',
    languageId: '0415',
    layouts: [
      { id: '00000415', name: 'Polish (Programmers)', languageId: '0415' },
      { id: '00010415', name: 'Polish (214)', languageId: '0415' },
    ],
  },
  {
    tag: 'pt-BR',
    name: 'Portuguese (Brazil)',
    languageId: '0416',
    layouts: [
      { id: '00000416', name: 'Portuguese (Brazilian ABNT)', languageId: '0416' },
      { id: '00010416', name: 'Portuguese (Brazilian ABNT2)', languageId: '0416' },
    ],
  },
  {
    tag: 'pt-PT',
    name: 'Portuguese (Portugal)',
    languageId: '0816',
    layouts: [{ id: '00000816', name: 'Portuguese', languageId: '0816' }],
  },
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

/** Get keyboard layouts for a given language tag. */
export function getKeyboardLayoutsForLanguage(tag: string): KeyboardLayout[] {
  const group = KEYBOARD_GROUPS.find((g) => g.tag === tag);
  return group?.layouts ?? [];
}

/** Format a keyboard pair as Windows inputLocale string (e.g. "0409:00000409"). */
export function formatInputLocale(languageId: string, layoutId: string): string {
  return `${languageId}:${layoutId}`;
}
