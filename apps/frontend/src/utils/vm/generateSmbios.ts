// SMBIOS Config Generator — port of generator_v3.py to JavaScript/TypeScript
// Full platform-grouped SMBIOS args generator for QEMU/KVM VMs

export interface PlatformGroup {
  boards: [string, string][];
  cpus: { string: string; part: string }[];
  ramSpeeds: number[];
  dimmCounts: number[];
}

export interface BrandMeta {
  family: string;
  biosVendor: string;
  type1Manufacturer: string;
  biosVersions: string[];
}

export interface RamEntry {
  manufacturer: string;
  partNumber: string;
}

const ALLOWED_RAM_SPEEDS = [2133, 2666] as const;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRamSpeed(groupSpeeds: number[]): number {
  const allowed = groupSpeeds.filter((speed): speed is (typeof ALLOWED_RAM_SPEEDS)[number] =>
    ALLOWED_RAM_SPEEDS.includes(speed as (typeof ALLOWED_RAM_SPEEDS)[number]),
  );
  if (allowed.length > 0) {
    return pick(allowed);
  }
  return pick([...ALLOWED_RAM_SPEEDS]);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function uuid4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randHex8(): string {
  return randInt(0x10000000, 0xffffffff).toString(16).toUpperCase().padStart(8, '0');
}

function randAlphaNum(length: number): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// --- SERIAL NUMBER GENERATORS ---

function generateSerial(brand: string): string {
  if (['HUANANZHI', 'Machinist', 'Kllisre'].includes(brand)) {
    if (Math.random() < 0.3) return 'Default string';
    const year = randInt(2018, 2024);
    const month = String(randInt(1, 12)).padStart(2, '0');
    const day = String(randInt(1, 28)).padStart(2, '0');
    const suffix = randInt(1000, 9999);
    return `MB-${year}${month}${day}${suffix}`;
  }
  if (brand === 'ASUS' || brand === 'EVGA') {
    return randAlphaNum(pick([12, 13, 14, 15]));
  }
  if (brand === 'MSI') {
    return `MS-${randInt(1000, 9999)}${randInt(10000000, 99999999)}`;
  }
  if (brand === 'Gigabyte') {
    if (Math.random() < 0.5) return 'Default string';
    return `SN${randInt(1000000000, 9999999999)}`;
  }
  if (brand === 'ASRock') {
    if (Math.random() < 0.7) return 'To be filled by O.E.M.';
    return randAlphaNum(pick([10, 12]));
  }
  return 'Default string';
}

function generateMbSerial(brand: string, biosDateStr: string): string {
  if (['HUANANZHI', 'Machinist', 'Kllisre'].includes(brand)) {
    const dateClean = biosDateStr.replace(/\//g, '');
    return `MB-${dateClean}${randInt(1000, 9999)}`;
  }
  if (brand === 'ASUS' || brand === 'EVGA') {
    return randAlphaNum(pick([12, 13, 14, 15]));
  }
  if (brand === 'MSI') {
    return `MS-${randInt(1000, 9999)}${randInt(10000000, 99999999)}`;
  }
  if (brand === 'Gigabyte') {
    if (Math.random() < 0.4) return 'Default string';
    return `SN0803${randInt(100000, 999999)}`;
  }
  if (brand === 'ASRock') {
    return 'To be filled by O.E.M.';
  }
  return 'Default string';
}

// --- BRAND METADATA ---

const BRAND_META: Record<string, BrandMeta> = {
  ASUS: {
    family: 'ASUS MB',
    biosVendor: 'American Megatrends Inc.',
    type1Manufacturer: 'ASUS',
    biosVersions: ['0603', '1004', '1202', '1401', '1602', '2004', '2201', '3801'],
  },
  MSI: {
    family: 'MSI MB',
    biosVendor: 'American Megatrends Inc.',
    type1Manufacturer: 'MSI',
    biosVersions: ['1.0', '1.2', '1.4', '1.7', '2.0', '2.3', 'A.10', 'A.20', 'A.60'],
  },
  Gigabyte: {
    family: 'Gigabyte MB',
    biosVendor: 'American Megatrends Inc.',
    type1Manufacturer: 'Gigabyte Technology Co. Ltd.',
    biosVersions: ['F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F10', 'F20', 'F21', 'F22a', 'F23d'],
  },
  ASRock: {
    family: 'ASRock MB',
    biosVendor: 'American Megatrends Inc.',
    type1Manufacturer: 'ASRock',
    biosVersions: ['P1.10', 'P1.20', 'P1.40', 'P1.50', 'P2.10', 'P2.40', 'P3.30', 'L2.52'],
  },
  EVGA: {
    family: 'EVGA MB',
    biosVendor: 'American Megatrends Inc.',
    type1Manufacturer: 'EVGA',
    biosVersions: ['1.02', '1.04', '1.06', '1.08', '2.00', '2.02'],
  },
  HUANANZHI: {
    family: 'Default string',
    biosVendor: 'American Megatrends Inc.',
    type1Manufacturer: 'INTEL',
    biosVersions: ['5.11', '5.12', '5.13', '5.14', '5.02'],
  },
  Machinist: {
    family: 'Default string',
    biosVendor: 'American Megatrends Inc.',
    type1Manufacturer: 'INTEL',
    biosVersions: ['5.11', '5.12', '5.13', '5.14'],
  },
  Kllisre: {
    family: 'Default string',
    biosVendor: 'American Megatrends Inc.',
    type1Manufacturer: 'INTEL',
    biosVersions: ['5.11', '5.12', '5.13', '5.02'],
  },
};

// --- PLATFORM GROUPS ---

const PLATFORM_GROUPS: PlatformGroup[] = [
  // X99 (LGA2011-3)
  {
    boards: [
      ['ASUS', 'X99-DELUXE'],
      ['ASUS', 'X99-DELUXE II'],
      ['ASUS', 'X99-A'],
      ['ASUS', 'X99-A II'],
      ['ASUS', 'SABERTOOTH X99'],
      ['ASUS', 'X99-E WS/USB 3.1'],
      ['ASUS', 'X99-PRO/USB 3.1'],
      ['ASUS', 'ROG STRIX X99 GAMING'],
      ['ASUS', 'ROG RAMPAGE V EXTREME'],
      ['ASUS', 'ROG RAMPAGE V EDITION 10'],
      ['ASUS', 'X99-E WS'],
      ['MSI', 'X99A GAMING PRO CARBON'],
      ['MSI', 'X99A SLI PLUS'],
      ['MSI', 'X99S SLI PLUS'],
      ['MSI', 'X99A GODLIKE GAMING'],
      ['MSI', 'X99A WORKSTATION'],
      ['MSI', 'X99A GAMING 7'],
      ['MSI', 'X99A RAIDER'],
      ['MSI', 'X99S GAMING 7'],
      ['MSI', 'X99A XPOWER AC'],
      ['Gigabyte', 'X99-UD4'],
      ['Gigabyte', 'X99-Gaming 5'],
      ['Gigabyte', 'X99-Gaming G1 WIFI'],
      ['Gigabyte', 'X99-SOC Champion'],
      ['Gigabyte', 'X99-Designare EX'],
      ['Gigabyte', 'X99-UD3'],
      ['Gigabyte', 'X99-Ultra Gaming'],
      ['Gigabyte', 'X99P-SLI'],
      ['ASRock', 'X99 Taichi'],
      ['ASRock', 'X99 Extreme4'],
      ['ASRock', 'X99 Extreme6'],
      ['ASRock', 'X99 Professional'],
      ['ASRock', 'Fatal1ty X99 Professional'],
      ['ASRock', 'Fatal1ty X99X Killer'],
      ['ASRock', 'X99 WS'],
      ['ASRock', 'X99M Extreme4'],
      ['EVGA', 'X99 Classified'],
      ['EVGA', 'X99 FTW K'],
      ['EVGA', 'X99 Micro'],
      ['EVGA', 'X99 Micro2'],
      ['HUANANZHI', 'X99-TF'],
      ['HUANANZHI', 'X99-F8'],
      ['HUANANZHI', 'X99-T8'],
      ['HUANANZHI', 'X99-AD4'],
      ['HUANANZHI', 'X99-BD4'],
      ['HUANANZHI', 'X99-8M'],
      ['HUANANZHI', 'X99-QD4'],
      ['HUANANZHI', 'X99-P4'],
      ['HUANANZHI', 'X99-TF GAMING'],
      ['Machinist', 'X99 MR9A'],
      ['Machinist', 'X99 MR9S'],
      ['Machinist', 'X99 MR9A PRO'],
      ['Machinist', 'X99-RS9'],
      ['Machinist', 'X99-K9'],
      ['Machinist', 'X99 Z V102'],
      ['Kllisre', 'X99 ZX-DU99D4'],
      ['Kllisre', 'X99D4'],
      ['Kllisre', 'X99 D4'],
      ['Kllisre', 'X99A'],
      ['Kllisre', 'X99 ZX-DU99D3'],
      ['Kllisre', 'X99H'],
    ],
    cpus: [
      { string: 'Intel(R) Xeon(R) CPU E5-2698 v3 @ 2.30GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2680 v3 @ 2.50GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2670 v3 @ 2.30GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2660 v3 @ 2.60GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2690 v3 @ 2.60GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2640 v3 @ 2.60GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2620 v3 @ 2.40GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2678 v3 @ 2.50GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2650 v4 @ 2.20GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E5-2630 v4 @ 2.20GHz', part: 'Xeon' },
      { string: 'Intel(R) Core(TM) i7-5960X CPU @ 3.00GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-5930K CPU @ 3.50GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-5820K CPU @ 3.30GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-6800K CPU @ 3.40GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-6850K CPU @ 3.60GHz', part: 'Core i7' },
    ],
    ramSpeeds: [2133, 2400],
    dimmCounts: [2, 4],
  },

  // Z97 / H97 (LGA1150, Haswell Refresh)
  {
    boards: [
      ['ASUS', 'Z97-A'],
      ['ASUS', 'Z97-PRO'],
      ['ASUS', 'Z97-DELUXE'],
      ['ASUS', 'MAXIMUS VII HERO'],
      ['ASUS', 'Z97-K'],
      ['ASUS', 'Z97-AR'],
      ['MSI', 'Z97 GAMING 5'],
      ['MSI', 'Z97-G45 GAMING'],
      ['MSI', 'Z97 MPOWER'],
      ['MSI', 'Z97S SLI Krait Edition'],
      ['Gigabyte', 'GA-Z97X-UD5H'],
      ['Gigabyte', 'GA-Z97X-Gaming 7'],
      ['Gigabyte', 'GA-Z97X-SLI'],
      ['Gigabyte', 'GA-Z97X-SOC Force'],
      ['ASRock', 'Z97 Extreme4'],
      ['ASRock', 'Z97 Extreme6'],
      ['ASRock', 'Fatal1ty Z97 Killer'],
      ['ASRock', 'Z97 Anniversary'],
    ],
    cpus: [
      { string: 'Intel(R) Core(TM) i7-4790K CPU @ 4.00GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-4790 CPU @ 3.60GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i5-4690K CPU @ 3.50GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-4690 CPU @ 3.50GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-4590 CPU @ 3.30GHz', part: 'Core i5' },
      { string: 'Intel(R) Xeon(R) CPU E3-1231 v3 @ 3.40GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E3-1230 v3 @ 3.30GHz', part: 'Xeon' },
    ],
    ramSpeeds: [1600, 1866, 2133],
    dimmCounts: [2, 4],
  },

  // Z170 / B150 (LGA1151, Skylake)
  {
    boards: [
      ['ASUS', 'Z170-A'],
      ['ASUS', 'Z170 PRO GAMING'],
      ['ASUS', 'Z170-DELUXE'],
      ['ASUS', 'MAXIMUS VIII HERO'],
      ['ASUS', 'Z170-K'],
      ['ASUS', 'Z170-AR'],
      ['MSI', 'Z170A GAMING M5'],
      ['MSI', 'Z170A KRAIT GAMING'],
      ['MSI', 'Z170A SLI PLUS'],
      ['MSI', 'Z170A GAMING PRO CARBON'],
      ['Gigabyte', 'GA-Z170X-Gaming 7'],
      ['Gigabyte', 'GA-Z170X-UD5'],
      ['Gigabyte', 'GA-Z170X-Gaming 5'],
      ['Gigabyte', 'GA-Z170-HD3'],
      ['ASRock', 'Z170 Extreme4'],
      ['ASRock', 'Fatal1ty Z170 Gaming K6'],
      ['ASRock', 'Z170 Pro4S'],
      ['ASRock', 'Z170 Extreme6'],
    ],
    cpus: [
      { string: 'Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-6700 CPU @ 3.40GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i5-6600K CPU @ 3.50GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-6600 CPU @ 3.30GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-6500 CPU @ 3.20GHz', part: 'Core i5' },
      { string: 'Intel(R) Xeon(R) CPU E3-1230 v5 @ 3.40GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E3-1240 v5 @ 3.50GHz', part: 'Xeon' },
    ],
    ramSpeeds: [2133, 2400],
    dimmCounts: [2, 4],
  },

  // Z270 / B250 (LGA1151, Kaby Lake)
  {
    boards: [
      ['ASUS', 'PRIME Z270-A'],
      ['ASUS', 'ROG STRIX Z270E GAMING'],
      ['ASUS', 'ROG MAXIMUS IX HERO'],
      ['ASUS', 'PRIME Z270-AR'],
      ['ASUS', 'TUF Z270 MARK 1'],
      ['MSI', 'Z270 GAMING M5'],
      ['MSI', 'Z270 GAMING PRO CARBON'],
      ['MSI', 'Z270 SLI PLUS'],
      ['MSI', 'Z270 KRAIT GAMING'],
      ['Gigabyte', 'GA-Z270X-Gaming 7'],
      ['Gigabyte', 'GA-Z270X-Ultra Gaming'],
      ['Gigabyte', 'GA-Z270X-UD5'],
      ['Gigabyte', 'GA-Z270-HD3'],
      ['ASRock', 'Z270 Extreme4'],
      ['ASRock', 'Fatal1ty Z270 Gaming K6'],
      ['ASRock', 'Z270 Taichi'],
      ['ASRock', 'Z270 Pro4'],
    ],
    cpus: [
      { string: 'Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-7700 CPU @ 3.60GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i5-7600K CPU @ 3.80GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-7600 CPU @ 3.50GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-7500 CPU @ 3.40GHz', part: 'Core i5' },
      { string: 'Intel(R) Xeon(R) CPU E3-1230 v6 @ 3.50GHz', part: 'Xeon' },
      { string: 'Intel(R) Xeon(R) CPU E3-1240 v6 @ 3.70GHz', part: 'Xeon' },
    ],
    ramSpeeds: [2133, 2400, 2666],
    dimmCounts: [2, 4],
  },

  // Z370 / Z390 / B360 / B365 (LGA1151v2, Coffee Lake)
  {
    boards: [
      ['ASUS', 'ROG STRIX Z390-E GAMING'],
      ['ASUS', 'PRIME Z390-A'],
      ['ASUS', 'ROG MAXIMUS XI HERO'],
      ['ASUS', 'TUF Z390-PLUS GAMING'],
      ['ASUS', 'PRIME Z370-A'],
      ['ASUS', 'ROG STRIX Z370-E GAMING'],
      ['ASUS', 'PRIME Z370-A II'],
      ['MSI', 'Z390 GAMING EDGE AC'],
      ['MSI', 'MAG Z390 TOMAHAWK'],
      ['MSI', 'Z390-A PRO'],
      ['MSI', 'MPG Z390 GAMING PRO CARBON'],
      ['MSI', 'Z370 GAMING PLUS'],
      ['MSI', 'Z370-A PRO'],
      ['Gigabyte', 'Z390 AORUS PRO'],
      ['Gigabyte', 'Z390 AORUS MASTER'],
      ['Gigabyte', 'Z390 GAMING X'],
      ['Gigabyte', 'Z390 UD'],
      ['Gigabyte', 'Z370 AORUS Gaming 7'],
      ['Gigabyte', 'Z370 AORUS Gaming 5'],
      ['ASRock', 'Z390 Taichi'],
      ['ASRock', 'Z390 Extreme4'],
      ['ASRock', 'Z390 Phantom Gaming 6'],
      ['ASRock', 'Z370 Extreme4'],
      ['ASRock', 'Fatal1ty Z370 Gaming K6'],
    ],
    cpus: [
      { string: 'Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-8700 CPU @ 3.20GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-9700 CPU @ 3.00GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz', part: 'Core i9' },
      { string: 'Intel(R) Core(TM) i9-9900KF CPU @ 3.60GHz', part: 'Core i9' },
      { string: 'Intel(R) Core(TM) i5-8600K CPU @ 3.60GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-9600K CPU @ 3.70GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-9400F CPU @ 2.90GHz', part: 'Core i5' },
    ],
    ramSpeeds: [2400, 2666, 3200],
    dimmCounts: [2, 4],
  },

  // Z490 / Z590 / B460 / B560 (LGA1200, Comet/Rocket Lake)
  {
    boards: [
      ['ASUS', 'ROG STRIX Z490-E GAMING'],
      ['ASUS', 'PRIME Z490-A'],
      ['ASUS', 'ROG MAXIMUS XII HERO'],
      ['ASUS', 'TUF GAMING Z490-PLUS'],
      ['ASUS', 'ROG STRIX Z590-E GAMING WIFI'],
      ['ASUS', 'PRIME Z590-A'],
      ['ASUS', 'ROG MAXIMUS XIII HERO'],
      ['ASUS', 'TUF GAMING Z590-PLUS WIFI'],
      ['MSI', 'MAG Z490 TOMAHAWK'],
      ['MSI', 'MPG Z490 GAMING EDGE WIFI'],
      ['MSI', 'Z490-A PRO'],
      ['MSI', 'MEG Z490 UNIFY'],
      ['MSI', 'MAG Z590 TOMAHAWK WIFI'],
      ['MSI', 'MPG Z590 GAMING CARBON WIFI'],
      ['MSI', 'Z590-A PRO'],
      ['Gigabyte', 'Z490 AORUS MASTER'],
      ['Gigabyte', 'Z490 AORUS PRO AX'],
      ['Gigabyte', 'Z490 GAMING X'],
      ['Gigabyte', 'Z490 UD'],
      ['Gigabyte', 'Z590 AORUS MASTER'],
      ['Gigabyte', 'Z590 AORUS PRO AX'],
      ['Gigabyte', 'Z590 GAMING X'],
      ['Gigabyte', 'Z590 UD'],
      ['ASRock', 'Z490 Taichi'],
      ['ASRock', 'Z490 Extreme4'],
      ['ASRock', 'Z490 Phantom Gaming 4'],
      ['ASRock', 'Z490 Steel Legend'],
      ['ASRock', 'Z590 Taichi'],
      ['ASRock', 'Z590 Extreme4 WiFi 6E'],
      ['ASRock', 'Z590 Steel Legend WiFi 6E'],
    ],
    cpus: [
      { string: 'Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-10700 CPU @ 2.90GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i9-10900K CPU @ 3.70GHz', part: 'Core i9' },
      { string: 'Intel(R) Core(TM) i9-10900 CPU @ 2.80GHz', part: 'Core i9' },
      { string: 'Intel(R) Core(TM) i5-10600K CPU @ 4.10GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-10400F CPU @ 2.90GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i7-11700K CPU @ 3.60GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i7-11700 CPU @ 2.50GHz', part: 'Core i7' },
      { string: 'Intel(R) Core(TM) i9-11900K CPU @ 3.50GHz', part: 'Core i9' },
      { string: 'Intel(R) Core(TM) i5-11600K CPU @ 3.90GHz', part: 'Core i5' },
      { string: 'Intel(R) Core(TM) i5-11400F CPU @ 2.60GHz', part: 'Core i5' },
    ],
    ramSpeeds: [2666, 3200, 3600],
    dimmCounts: [2, 4],
  },
];

// --- RAM PART NUMBER DATABASE ---

const RAM_DB: Record<number, [string, string][]> = {
  1600: [
    ['Samsung', 'M378B5173DB0-CK0'],
    ['SK Hynix', 'HMT451U6AFR8C-PB'],
    ['Kingston', 'KVR16N11/8'],
    ['Crucial', 'CT102464BF160B'],
    ['Corsair', 'CMV8GX3M1A1600C11'],
    ['G.Skill', 'F3-1600C11D-8GNT'],
  ],
  1866: [
    ['Samsung', 'M378B5273DH0-YK0'],
    ['Kingston', 'KHX1866C10D3/8G'],
    ['Corsair', 'CMZ8GX3M1A1866C10'],
    ['G.Skill', 'F3-1866C9D-8GAB'],
  ],
  2133: [
    ['Samsung', 'M393A2G40DB0-CPB'],
    ['SK Hynix', 'HMA42GR7MFR4N-TF'],
    ['Micron', 'MTA36ASF2G72PZ-2G1'],
    ['Kingston', 'KVR21R15D4/16'],
    ['Crucial', 'CT16G4RFD4213'],
    ['G.Skill', 'F4-2133C15D-16GVR'],
    ['Corsair', 'CMK16GX4M2A2133C13'],
  ],
  2400: [
    ['Samsung', 'M393A2G40EB1-CRC'],
    ['SK Hynix', 'HMA84GR7MFR4N-UH'],
    ['Corsair', 'CMK64GX4M4A2400C14'],
    ['G.Skill', 'F4-2400C15Q-32GRR'],
    ['Kingston', 'KVR24R17D4/32'],
    ['Crucial', 'CT16G4RFD424A'],
    ['Corsair', 'CMK16GX4M2A2400C16'],
  ],
  2666: [
    ['Samsung', 'M378A1K43CB2-CTD'],
    ['SK Hynix', 'HMA81GU6CJR8N-VK'],
    ['Kingston', 'KVR26N19S8/8'],
    ['Crucial', 'CT8G4DFS8266'],
    ['Corsair', 'CMK16GX4M2A2666C16'],
    ['G.Skill', 'F4-2666C19D-16GIS'],
  ],
  3200: [
    ['Samsung', 'M378A1G44AB0-CWE'],
    ['SK Hynix', 'HMA81GU6DJR8N-XN'],
    ['G.Skill', 'F4-3200C16D-32GTZR'],
    ['Corsair', 'CMK32GX4M2B3200C16'],
    ['Crucial', 'BL2K16G32C16U4B'],
    ['Kingston', 'HX432C16FB3K2/32'],
    ['Patriot', 'PVS416G320C6K'],
    ['TeamGroup', 'TF3D416G3200HC16CDC01'],
  ],
  3600: [
    ['G.Skill', 'F4-3600C16D-32GTZNC'],
    ['Corsair', 'CMK32GX4M2D3600C18'],
    ['Kingston', 'HX436C17FB3K2/16'],
    ['Crucial', 'BL2K8G36C16U4B'],
    ['Patriot', 'PVS416G360C8K'],
    ['TeamGroup', 'TF4D416G3600HC18JDC01'],
  ],
};

// --- MAIN GENERATOR ---

export interface SmbiosResult {
  args: string;
  brand: string;
  product: string;
  cpu: string;
}

/**
 * Generate a full SMBIOS args string for QEMU/KVM VM.
 * Returns the generated args line with randomized hardware fingerprints.
 */
export function generateSmbios(): SmbiosResult {
  const hvVendorId = 'GenuineIntel';

  // Select platform group -> board + CPU + RAM
  const group = pick(PLATFORM_GROUPS);
  const [brand, product] = pick(group.boards);
  const cpu = pick(group.cpus);
  const ramSpeed = pickRamSpeed(group.ramSpeeds);
  // Keep dual-channel layout to avoid synthetic extra DIMM slots (Bank 2/3).
  const ramCount = 2;

  // Brand metadata
  const meta = BRAND_META[brand];
  const vendor = meta.biosVendor;
  const type1Manufacturer = meta.type1Manufacturer;
  const family = meta.family;
  const biosVersion = pick(meta.biosVersions);

  // BIOS release
  const biosReleases = ['5.11', '5.12', '5.13', '5.17', '5.19', '5.22', '6.00', '6.41', '6.52'];
  const release = pick(biosReleases);

  // BIOS date - 100 to 1800 days ago
  const now = new Date();
  const daysAgo = randInt(100, 1800);
  const biosDateObj = new Date(now.getTime() - daysAgo * 86400000);
  const mm = String(biosDateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(biosDateObj.getDate()).padStart(2, '0');
  const yyyy = biosDateObj.getFullYear();
  const biosDate = `${mm}/${dd}/${yyyy}`;

  // RAM
  const ramParts = RAM_DB[ramSpeed];
  const [ramMfg, ramPart] = pick(ramParts);

  // Serials
  const generatedUuid = uuid4();
  const serialSys = generateSerial(brand);
  const serialMb = generateMbSerial(brand, biosDate);
  const serialChassis = generateSerial(brand);

  // type=3 varied values
  const chassisVersion = pick(['1.0', 'Default string', 'Not Specified', '2021']);
  const chassisSku = pick(['Default string', 'SKU', 'To be filled by O.E.M.']);

  // type=1 version
  const type1Version = pick(['1.0', 'Default string', 'Not Specified']);

  // VNC port placeholder
  const vncString = '0.0.0.0:00';

  // RAM SMBIOS entries
  const dimmLabels = ['DIMM_A1', 'DIMM_B1', 'DIMM_C1', 'DIMM_D1'];
  const ramEntries: string[] = [];
  for (let i = 0; i < ramCount; i++) {
    const ramSerial = randHex8();
    const label = dimmLabels[i];
    ramEntries.push(
      `-smbios 'type=17,bank=Bank ${i},asset=${label}_AssetTag,` +
        `part=${ramPart},manufacturer=${ramMfg},` +
        `speed=${ramSpeed},serial=${ramSerial},loc_pfx=${label}'`,
    );
  }
  const ramSmbios = ramEntries.join(' ');

  // Build full args string
  const params =
    `args: -cpu 'host,hypervisor=off,kvm=off,rdtscp=off,migratable=off,hv-vendor-id=${hvVendorId}' ` +
    `-smbios 'type=0,version=BIOS Date: ${biosDate} Ver: ${biosVersion},vendor=${vendor},uefi=on,release=${release},date=AMI ${biosDate}' ` +
    `-smbios 'type=1,version=${type1Version},product=${product},manufacturer=${type1Manufacturer},uuid=${generatedUuid},serial=${serialSys},family=${family}' ` +
    `-smbios 'type=2,asset=Not Specified,version=1.0,product=${product},location=Motherboard,manufacturer=${type1Manufacturer},serial=${serialMb}' ` +
    `-smbios 'type=3,asset=Not Specified,version=${chassisVersion},sku=${chassisSku},manufacturer=${type1Manufacturer},serial=${serialChassis}' ` +
    `-smbios 'type=4,asset=Not Specified,version=${cpu.string},part=${cpu.part},manufacturer=Intel,serial=Not Specified,sock_pfx=SOCKET 0' ` +
    `-smbios 'type=11,value=To be filled by O.E.M.' ` +
    `${ramSmbios} ` +
    `-vnc '${vncString}'`;

  return {
    args: params,
    brand,
    product,
    cpu: cpu.string,
  };
}
