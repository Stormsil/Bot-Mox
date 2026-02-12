export { generateSmbios, generateMac, generateSsdSerial } from './generators';
export type { SmbiosResult, PlatformGroup, BrandMeta, RamEntry } from './generators';
export { patchConfig, extractVmNumber } from './patcher';
export type { PatchResult, PatchChange } from './patcher';
