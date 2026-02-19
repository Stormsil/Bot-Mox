export type { BrandMeta, PlatformGroup, RamEntry, SmbiosResult } from './generators';
export { generateMac, generateSmbios, generateSsdSerial } from './generators';
export type { PatchChange, PatchResult } from './patcher';
export { extractVmNumber, patchConfig } from './patcher';
