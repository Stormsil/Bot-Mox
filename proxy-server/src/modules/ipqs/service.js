const axios = require('axios');

const IPQS_API_BASE = 'https://www.ipqualityscore.com/api/json/ip';
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

function createServiceError(status, code, message, details) {
  const error = new Error(String(message || 'Service error'));
  error.status = Number(status || 500);
  error.code = String(code || 'SERVICE_ERROR');
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function isValidIp(ip) {
  return IPV4_REGEX.test(String(ip || '').trim());
}

function normalizeAxiosError(error, fallbackMessage = 'Internal server error') {
  if (error && typeof error === 'object') {
    if (error.code === 'ECONNABORTED') {
      return createServiceError(504, 'REQUEST_TIMEOUT', 'Request timeout');
    }

    if (error.response && typeof error.response === 'object') {
      return createServiceError(
        Number(error.response.status || 502),
        'IPQS_API_ERROR',
        `IPQS API error: ${error.response.status || 'unknown'}`,
        error.response.data
      );
    }
  }

  return createServiceError(500, 'INTERNAL_ERROR', fallbackMessage);
}

function createIpqsService({ settingsReader }) {
  async function getApiKeyFromSettings() {
    const apiKey = await settingsReader?.readPath('settings/api_keys/ipqs/api_key', { fallback: null });
    if (typeof apiKey === 'string' && apiKey.trim()) {
      return apiKey.trim();
    }
    return null;
  }

  async function getApiKey() {
    const settingsKey = await getApiKeyFromSettings();
    if (settingsKey) return settingsKey;

    const envKey = String(process.env.IPQS_API_KEY || '').trim();
    return envKey || null;
  }

  async function isEnabled() {
    try {
      const enabledInDb = await settingsReader?.readPath('settings/api_keys/ipqs/enabled', { fallback: null });
      if (enabledInDb === null || enabledInDb === undefined) {
        const key = await getApiKey();
        return Boolean(key);
      }
      return enabledInDb === true;
    } catch (_error) {
      return Boolean(String(process.env.IPQS_API_KEY || '').trim());
    }
  }

  async function getStatus() {
    const [enabled, apiKey] = await Promise.all([isEnabled(), getApiKey()]);
    return {
      enabled,
      configured: Boolean(apiKey),
      supabaseSettingsConnected: Boolean(settingsReader),
    };
  }

  async function requestIpQuality(ip, apiKey) {
    const normalizedIp = String(ip || '').trim();
    const url = `${IPQS_API_BASE}/${encodeURIComponent(apiKey)}/${encodeURIComponent(normalizedIp)}?strictness=1&allow_public_access_points=true&fast=true`;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        Accept: 'application/json',
      },
    });

    const data = response.data;
    if (!data || typeof data !== 'object') {
      throw createServiceError(502, 'IPQS_API_ERROR', 'Invalid IPQS response');
    }

    if (!data.success) {
      throw createServiceError(400, 'IPQS_API_ERROR', data.message || 'IPQS API error');
    }

    return data;
  }

  async function checkIp(ip) {
    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) {
      throw createServiceError(400, 'BAD_REQUEST', 'IP address is required');
    }

    if (!isValidIp(normalizedIp)) {
      throw createServiceError(400, 'BAD_REQUEST', 'Invalid IP address format');
    }

    const [enabled, apiKey] = await Promise.all([isEnabled(), getApiKey()]);

    if (!enabled) {
      throw createServiceError(503, 'IPQS_DISABLED', 'IPQS check is disabled');
    }

    if (!apiKey) {
      throw createServiceError(
        503,
        'IPQS_KEY_MISSING',
        'IPQS API key not configured. Please add API key to settings/api_keys/ipqs/api_key or set IPQS_API_KEY in .env'
      );
    }

    try {
      return await requestIpQuality(normalizedIp, apiKey);
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && 'code' in error) {
        throw error;
      }
      throw normalizeAxiosError(error, 'Internal server error');
    }
  }

  async function checkIpBatch(ips) {
    if (!Array.isArray(ips) || ips.length === 0) {
      throw createServiceError(400, 'BAD_REQUEST', 'Array of IP addresses is required');
    }

    if (ips.length > 10) {
      throw createServiceError(400, 'BAD_REQUEST', 'Maximum 10 IPs per batch request');
    }

    const [enabled, apiKey] = await Promise.all([isEnabled(), getApiKey()]);
    if (!enabled || !apiKey) {
      throw createServiceError(503, 'IPQS_DISABLED', 'IPQS check is disabled or not configured');
    }

    const results = await Promise.all(
      ips.map(async (ip) => {
        const normalizedIp = String(ip || '').trim();
        if (!isValidIp(normalizedIp)) {
          return {
            ip: normalizedIp,
            success: false,
            error: 'Invalid IP address format',
          };
        }

        try {
          const data = await requestIpQuality(normalizedIp, apiKey);
          return {
            ip: normalizedIp,
            success: true,
            data,
          };
        } catch (error) {
          const normalized = normalizeAxiosError(error, 'Internal server error');
          return {
            ip: normalizedIp,
            success: false,
            error: normalized.message,
            details: normalized.details,
          };
        }
      })
    );

    return { results };
  }

  return {
    getStatus,
    checkIp,
    checkIpBatch,
  };
}

module.exports = {
  createIpqsService,
};
