import type { InventoryItem } from '../../../shared/types';

export const wowClassColors = {
  deathKnight: '#c41e3a',
  druid: '#ff7c0a',
  hunter: '#aad372',
  mage: '#3fc7eb',
  monk: '#00ff98',
  paladin: '#f48cba',
  priest: '#ffffff',
  rogue: '#fff468',
  shaman: '#0070dd',
  warlock: '#8788ee',
  warrior: '#c69b6d',
} as const;

export const wowRarityColors: Record<InventoryItem['quality'], string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
};

export const wowProfessionColors = {
  engineering: '#4682b4',
  herbalism: '#228b22',
  mining: '#8b4513',
  skinning: '#cd853f',
  unknown: '#eb2f96',
} as const;

export const wowLifeStageColors = {
  banned: '#ff4d4f',
  farm: '#faad14',
  leveling: '#722ed1',
  prepare: '#8c8c8c',
  professions: '#13c2c2',
} as const;

export const wowMetricColors = {
  farmGold: '#ffd700',
  farmGoldPerHour: '#52c41a',
  farmSessionTime: '#1890ff',
  levelingCurrent: '#722ed1',
  levelingTimeToLevel: '#1890ff',
  levelingXpPerHour: '#52c41a',
} as const;

export const getWowRarityColor = (quality: InventoryItem['quality']): string =>
  wowRarityColors[quality];

export const getWowProfessionColor = (name: string): string => {
  switch (name.toLowerCase()) {
    case 'mining':
      return wowProfessionColors.mining;
    case 'herbalism':
      return wowProfessionColors.herbalism;
    case 'skinning':
      return wowProfessionColors.skinning;
    case 'engineering':
      return wowProfessionColors.engineering;
    default:
      return wowProfessionColors.unknown;
  }
};
