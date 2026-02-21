import type { IPQSResponse, Proxy as ProxyResource } from '../../types';

export function updateProxyWithIPQSData(
  proxy: Partial<ProxyResource>,
  ipqsData: IPQSResponse,
): Partial<ProxyResource> {
  const updates: Partial<ProxyResource> = {
    ...proxy,
    fraud_score: ipqsData.fraud_score,
    country: ipqsData.country_code || proxy.country || 'Unknown',
    country_code: ipqsData.country_code || '',
    city: ipqsData.city || '',
    region: ipqsData.region || '',
    zip_code: ipqsData.zip_code || '',
    isp: ipqsData.isp || '',
    organization: ipqsData.organization || '',
    timezone: ipqsData.timezone || '',
    latitude: ipqsData.latitude ?? 0,
    longitude: ipqsData.longitude ?? 0,
    vpn: ipqsData.vpn || false,
    proxy: ipqsData.proxy || false,
    tor: ipqsData.tor || false,
    bot_status: ipqsData.bot_status || false,
    last_checked: Date.now(),
    updated_at: Date.now(),
  };

  Object.keys(updates).forEach((key) => {
    if (updates[key as keyof ProxyResource] === undefined) {
      delete updates[key as keyof ProxyResource];
    }
  });

  return updates;
}
