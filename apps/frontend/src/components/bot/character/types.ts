import type {
  Bot,
  FactionType,
  GameClass,
  GameFaction,
  GameRace,
  GameServer,
} from '../../../types';

export interface BotCharacterProps {
  bot: Bot;
  mode?: 'view' | 'edit';
}

export interface CharacterFormData {
  name: string;
  level: number;
  server: string;
  faction: FactionType | '';
  race: string;
  class: string;
}

export interface ReferenceData {
  servers: Record<string, GameServer>;
  races: Record<string, GameRace>;
  classes: Record<string, GameClass>;
  factions: Record<string, GameFaction>;
}
