import { randomUUID } from 'node:crypto';
import { PLATFORM_GROUPS } from './smbios-platform-groups';
import { RAM_DB } from './smbios-ram-db';

export interface BrandMeta {
  family: string;
  biosVendor: string;
  type1Manufacturer: string;
  biosVersions: string[];
}

const ALLOWED_RAM_SPEEDS = [2133, 2666] as const;

function pick<T>(arr: T[]): T {
  if (arr.length === 0) {
    throw new Error('cannot pick from empty array');
  }
  return arr[Math.floor(Math.random() * arr.length)] as T;
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

function fallbackUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateUuidV4(): string {
  try {
    return randomUUID();
  } catch {
    return fallbackUuidV4();
  }
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

function generateSerial(brand: string): string {
  if (['HUANANZHI', 'Machinist', 'Kllisre'].includes(brand)) {
    if (Math.random() < 0.3) {
      return 'Default string';
    }
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
    if (Math.random() < 0.5) {
      return 'Default string';
    }
    return `SN${randInt(1000000000, 9999999999)}`;
  }
  if (brand === 'ASRock') {
    if (Math.random() < 0.7) {
      return 'To be filled by O.E.M.';
    }
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
    if (Math.random() < 0.4) {
      return 'Default string';
    }
    return `SN0803${randInt(100000, 999999)}`;
  }
  if (brand === 'ASRock') {
    return 'To be filled by O.E.M.';
  }
  return 'Default string';
}

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

export interface SmbiosResult {
  args: string;
  brand: string;
  product: string;
  cpu: string;
}

function formatBiosDate(daysAgo: number): string {
  const now = new Date();
  const shifted = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const mm = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  const yyyy = shifted.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function getRamParts(speed: number): [string, string][] {
  const parts = RAM_DB[speed] ?? RAM_DB[2133];
  if (!parts || parts.length === 0) {
    throw new Error('ram dataset is not configured');
  }
  return parts;
}

export function generateSmbios(): SmbiosResult {
  const hvVendorId = 'GenuineIntel';
  const group = pick(PLATFORM_GROUPS);
  const [brand, product] = pick(group.boards);
  const cpu = pick(group.cpus);
  const ramSpeed = pickRamSpeed(group.ramSpeeds);
  const ramCount = 2;

  const meta =
    BRAND_META[brand] ??
    ({
      family: 'Default string',
      biosVendor: 'American Megatrends Inc.',
      type1Manufacturer: 'INTEL',
      biosVersions: ['5.11'],
    } satisfies BrandMeta);
  const vendor = meta.biosVendor;
  const type1Manufacturer = meta.type1Manufacturer;
  const family = meta.family;
  const biosVersion = pick(meta.biosVersions);

  const biosReleases = ['5.11', '5.12', '5.13', '5.17', '5.19', '5.22', '6.00', '6.41', '6.52'];
  const release = pick(biosReleases);
  const biosDate = formatBiosDate(randInt(100, 1800));

  const ramParts = getRamParts(ramSpeed);
  const [ramMfg, ramPart] = pick(ramParts);

  const generatedUuid = generateUuidV4();
  const serialSys = generateSerial(brand);
  const serialMb = generateMbSerial(brand, biosDate);
  const serialChassis = generateSerial(brand);

  const chassisVersion = pick(['1.0', 'Default string', 'Not Specified', '2021']);
  const chassisSku = pick(['Default string', 'SKU', 'To be filled by O.E.M.']);
  const type1Version = pick(['1.0', 'Default string', 'Not Specified']);
  const vncString = '0.0.0.0:00';

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
