import type { CharacterFormData } from './types';

export const RACE_ICONS: Record<string, string> = {
  orc: 'https://wow.zamimg.com/images/wow/icons/race/orc_male.jpg',
  troll: 'https://wow.zamimg.com/images/wow/icons/race/troll_male.jpg',
  tauren: 'https://wow.zamimg.com/images/wow/icons/race/tauren_male.jpg',
  undead: 'https://wow.zamimg.com/images/wow/icons/race/undead_male.jpg',
  blood_elf: 'https://wow.zamimg.com/images/wow/icons/race/bloodelf_male.jpg',
  human: 'https://wow.zamimg.com/images/wow/icons/race/human_male.jpg',
  dwarf: 'https://wow.zamimg.com/images/wow/icons/race/dwarf_male.jpg',
  gnome: 'https://wow.zamimg.com/images/wow/icons/race/gnome_male.jpg',
  night_elf: 'https://wow.zamimg.com/images/wow/icons/race/nightelf_male.jpg',
  draenei: 'https://wow.zamimg.com/images/wow/icons/race/draenei_male.jpg',
};

export const DEFAULT_FORM_DATA: CharacterFormData = {
  name: '',
  level: 1,
  server: '',
  faction: '',
  race: '',
  class: '',
};
