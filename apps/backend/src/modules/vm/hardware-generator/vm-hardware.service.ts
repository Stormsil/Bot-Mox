import { Injectable } from '@nestjs/common';
import { generateMac } from './generate-mac';
import { generateSmbios } from './generate-smbios';
import { generateSsdSerial } from './generate-ssd-serial';

export interface VmHardwareMeta {
  brand: string;
  product: string;
  cpu: string;
}

export interface VmHardwareFingerprint {
  mac: string;
  ssdSerial: string;
  smbiosArgs: string;
  meta: VmHardwareMeta;
}

@Injectable()
export class VmHardwareService {
  generateFingerprint(): VmHardwareFingerprint {
    const smbios = generateSmbios();

    return {
      mac: generateMac(),
      ssdSerial: generateSsdSerial(),
      smbiosArgs: smbios.args,
      meta: {
        brand: smbios.brand,
        product: smbios.product,
        cpu: smbios.cpu,
      },
    };
  }
}
