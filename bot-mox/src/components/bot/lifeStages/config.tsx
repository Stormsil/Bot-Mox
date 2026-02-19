import {
  BuildOutlined,
  ExperimentOutlined,
  FireOutlined,
  GoldOutlined,
  LoadingOutlined,
  RiseOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { InventoryItem, LevelingProgress, ProfessionProgress } from '../../../types';

export type LifeStage = 'prepare' | 'leveling' | 'professions' | 'farm' | 'banned';

export const mockLeveling: LevelingProgress = {
  current_level: 42,
  current_xp: 125000,
  max_xp: 180000,
  xp_per_hour: 8500,
  estimated_time_to_level: 6.5,
  location: 'Stranglethorn Vale',
};

export const mockProfessions: ProfessionProgress[] = [
  { name: 'Mining', level: 275, max_level: 375, skill_points: 275, max_skill_points: 375 },
  { name: 'Herbalism', level: 0, max_level: 375, skill_points: 0, max_skill_points: 375 },
  { name: 'Skinning', level: 0, max_level: 375, skill_points: 0, max_skill_points: 375 },
  { name: 'Engineering', level: 0, max_level: 375, skill_points: 0, max_skill_points: 375 },
];

export const mockInventory: InventoryItem[] = [
  { id: '1', name: 'Runecloth', quantity: 120, quality: 'common' },
  { id: '2', name: 'Thorium Ore', quantity: 45, quality: 'uncommon' },
  { id: '3', name: 'Arcane Crystal', quantity: 3, quality: 'rare' },
  { id: '4', name: 'Black Lotus', quantity: 1, quality: 'epic' },
];

export const mockFarmStats = {
  total_gold: 15420,
  gold_per_hour: 125.5,
  session_start: Date.now() - 3600000 * 6,
};

export const mockAnalytics = {
  leveling: {
    totalTime: 48,
    levelsGained: 42,
    avgXpPerHour: 8500,
    trend: [1200, 3500, 5800, 7200, 8500, 9200, 8800, 9000],
  },
  professions: {
    totalTime: 24,
    skillsGained: 275,
    avgSkillPerHour: 11.5,
    trend: [50, 120, 180, 220, 250, 275],
  },
  farm: {
    totalTime: 72,
    totalGold: 15420,
    avgGoldPerHour: 125.5,
    trend: [100, 110, 125, 130, 128, 125, 122, 125],
  },
};

export const getProfessionIcon = (name: string) => {
  switch (name.toLowerCase()) {
    case 'mining':
      return <BuildOutlined />;
    case 'herbalism':
      return <ExperimentOutlined />;
    case 'skinning':
      return <FireOutlined />;
    default:
      return <ToolOutlined />;
  }
};

export const getProfessionColor = (name: string) => {
  switch (name.toLowerCase()) {
    case 'mining':
      return '#8b4513';
    case 'herbalism':
      return '#228b22';
    case 'skinning':
      return '#cd853f';
    case 'engineering':
      return '#4682b4';
    default:
      return '#eb2f96';
  }
};

export const getQualityColor = (quality: InventoryItem['quality']) => {
  switch (quality) {
    case 'common':
      return '#9ca3af';
    case 'uncommon':
      return '#22c55e';
    case 'rare':
      return '#3b82f6';
    case 'epic':
      return '#a855f7';
    default:
      return '#9ca3af';
  }
};

export const getStageIcon = (stage: LifeStage) => {
  switch (stage) {
    case 'prepare':
      return <LoadingOutlined />;
    case 'leveling':
      return <RiseOutlined />;
    case 'professions':
      return <ToolOutlined />;
    case 'farm':
      return <GoldOutlined />;
    case 'banned':
      return <StopOutlined />;
  }
};

export const getStageLabel = (stage: LifeStage) => {
  switch (stage) {
    case 'prepare':
      return 'Preparation';
    case 'leveling':
      return 'Leveling';
    case 'professions':
      return 'Professions';
    case 'farm':
      return 'Farm';
    case 'banned':
      return 'Banned';
  }
};

export const getStageColor = (stage: LifeStage) => {
  switch (stage) {
    case 'prepare':
      return '#8c8c8c';
    case 'leveling':
      return '#722ed1';
    case 'professions':
      return '#13c2c2';
    case 'farm':
      return '#faad14';
    case 'banned':
      return '#ff4d4f';
  }
};

export const formatDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};
