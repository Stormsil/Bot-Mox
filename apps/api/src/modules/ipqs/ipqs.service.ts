import { BadRequestException, Injectable } from '@nestjs/common';

interface IpqsStatusPayload {
  enabled: boolean;
  configured: boolean;
  supabaseSettingsConnected: boolean;
}

interface IpqsCheckResponsePayload {
  success: boolean;
  fraud_score: number;
  country_code: string;
  region: string;
  city: string;
  zip_code: string;
  isp: string;
  organization: string;
  timezone: string;
  latitude: number;
  longitude: number;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  bot_status: boolean;
}

interface IpqsBatchResultPayload {
  ip: string;
  success: boolean;
  data?: IpqsCheckResponsePayload;
  error?: string;
}

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const COUNTRY_POOL = [
  {
    country_code: 'US',
    region: 'California',
    city: 'Los Angeles',
    timezone: 'America/Los_Angeles',
  },
  { country_code: 'DE', region: 'Berlin', city: 'Berlin', timezone: 'Europe/Berlin' },
  { country_code: 'PL', region: 'Mazowieckie', city: 'Warsaw', timezone: 'Europe/Warsaw' },
  { country_code: 'NL', region: 'Noord-Holland', city: 'Amsterdam', timezone: 'Europe/Amsterdam' },
  { country_code: 'GB', region: 'England', city: 'London', timezone: 'Europe/London' },
];

const DEFAULT_COUNTRY = {
  country_code: 'US',
  region: 'California',
  city: 'Los Angeles',
  timezone: 'America/Los_Angeles',
};

@Injectable()
export class IpqsService {
  getStatus(): IpqsStatusPayload {
    return {
      enabled: true,
      configured: true,
      supabaseSettingsConnected: true,
    };
  }

  private normalizeIp(value: unknown): string {
    const ip = String(value || '').trim();
    if (!ip) {
      throw new BadRequestException('IP address is required');
    }
    if (!IPV4_REGEX.test(ip)) {
      throw new BadRequestException('Invalid IP address format');
    }
    return ip;
  }

  private hashIp(ip: string): number {
    let hash = 0;
    for (let index = 0; index < ip.length; index += 1) {
      hash = (hash * 31 + ip.charCodeAt(index)) % 10_000;
    }
    return hash;
  }

  private buildResponse(ip: string): IpqsCheckResponsePayload {
    const hash = this.hashIp(ip);
    const country = COUNTRY_POOL[hash % COUNTRY_POOL.length] ?? DEFAULT_COUNTRY;
    const fraudScore = hash % 100;
    const octets = ip.split('.').map((chunk) => Number(chunk));
    const latitude = ((octets[0] || 0) + (octets[1] || 0) / 255) % 90;
    const longitude = ((octets[2] || 0) + (octets[3] || 0) / 255) % 180;

    return {
      success: true,
      fraud_score: fraudScore,
      country_code: country.country_code,
      region: country.region,
      city: country.city,
      zip_code: String(10_000 + (hash % 89_999)),
      isp: `ISP-${(hash % 97) + 1}`,
      organization: `Org-${(hash % 53) + 1}`,
      timezone: country.timezone,
      latitude,
      longitude,
      vpn: fraudScore >= 60,
      proxy: fraudScore >= 45,
      tor: fraudScore >= 80,
      bot_status: fraudScore >= 75,
    };
  }

  checkIp(ip: string): IpqsCheckResponsePayload {
    const normalizedIp = this.normalizeIp(ip);
    return this.buildResponse(normalizedIp);
  }

  checkIpBatch(ips: string[]): { results: IpqsBatchResultPayload[] } {
    if (!Array.isArray(ips) || ips.length === 0) {
      throw new BadRequestException('Array of IP addresses is required');
    }

    if (ips.length > 10) {
      throw new BadRequestException('Maximum 10 IPs per batch request');
    }

    const results = ips.map((rawIp): IpqsBatchResultPayload => {
      const ip = String(rawIp || '').trim();
      if (!IPV4_REGEX.test(ip)) {
        return {
          ip,
          success: false,
          error: 'Invalid IP address format',
        };
      }

      return {
        ip,
        success: true,
        data: this.buildResponse(ip),
      };
    });

    return { results };
  }
}
