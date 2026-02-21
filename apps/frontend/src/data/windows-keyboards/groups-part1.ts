import type { KeyboardLanguageGroup } from './types';

export const KEYBOARD_GROUPS_PART1: KeyboardLanguageGroup[] = [
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
      { id: '00000C0C', name: 'Canadian French (Classic)', languageId: '0C0C' },
      { id: '00011009', name: 'Canadian Multilingual Standard', languageId: '0C0C' },
    ],
  },
];
