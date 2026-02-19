import { Injectable } from '@nestjs/common';

interface WowNamesQuery {
  count?: number | undefined;
  batches?: number | undefined;
}

interface WowNamesPayload {
  names: string[];
  count: number;
  batches: number;
  random: string;
  source: string;
}

const NAME_POOL = [
  'Aldor',
  'Brannor',
  'Cindral',
  'Durok',
  'Elaria',
  'Fenric',
  'Galdor',
  'Halwen',
  'Ithran',
  'Jorim',
  'Kaelor',
  'Lunara',
  'Mordain',
  'Nerith',
  'Ordan',
  'Pyrella',
  'Quorin',
  'Ravok',
  'Sylwen',
  'Tharion',
  'Ulrik',
  'Veyra',
  'Wyrn',
  'Xandor',
  'Ysel',
  'Zorath',
];

@Injectable()
export class WowNamesService {
  private normalizeCount(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(Math.floor(parsed), 50);
  }

  private normalizeBatches(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return Math.min(Math.floor(parsed), 5);
  }

  private sampleBatch(seed: number): string[] {
    const rotated = [...NAME_POOL.slice(seed), ...NAME_POOL.slice(0, seed)];
    return rotated.slice(0, 10);
  }

  getWowNames(query: WowNamesQuery): WowNamesPayload {
    const count = this.normalizeCount(query.count);
    const batches = this.normalizeBatches(query.batches);
    const allNames = new Set<string>();

    for (let index = 0; index < batches; index += 1) {
      const seed = Math.floor((Date.now() + index * 17) % NAME_POOL.length);
      for (const name of this.sampleBatch(seed)) {
        allNames.add(name);
      }
    }

    const names = [...allNames];
    const selected = count > 0 ? names.slice(0, count) : names;
    const random = selected[Math.floor(Math.random() * selected.length)] || selected[0] || '';

    return {
      names: selected,
      count,
      batches,
      random,
      source: 'generator-click',
    };
  }
}
