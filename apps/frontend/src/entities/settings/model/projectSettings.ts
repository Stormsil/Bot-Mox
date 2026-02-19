export interface ProjectSettings {
  id: string;
  name: string;
  game?: string;
  expansion?: string;
  max_level?: number;
  currency?: string;
  currency_symbol?: string;
  server_region?: string;
  professions?: string[];
  referenceData?: unknown;
  created_at?: number;
  updated_at?: number;
  [key: string]: unknown;
}
