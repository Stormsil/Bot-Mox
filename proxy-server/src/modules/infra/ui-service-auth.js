const axios = require('axios');
const cheerio = require('cheerio');
const { logger } = require('../../observability/logger');

function createUiServiceAuth({ settingsReader, httpsAgent }) {
  const tinyFMSession = {
    baseUrl: '',
    cookieHeader: '',
    expiresAt: 0,
  };

  const syncThingSession = {
    baseUrl: '',
    cookieHeader: '',
    expiresAt: 0,
  };

  const syncThingResolvedUrlCache = {
    sourceUrl: '',
    resolvedUrl: '',
    expiresAt: 0,
  };

  function normalizeBaseUrl(input, fallback) {
    const raw = (input || fallback || '').trim();
    try {
      const parsed = new URL(raw);
      return parsed.toString();
    } catch {
      return fallback;
    }
  }

  function pickString(...values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  function extractHostFromUrl(input) {
    try {
      const parsed = new URL(input);
      return parsed.hostname || '';
    } catch {
      return '';
    }
  }

  function isLoopbackHost(host) {
    const normalized = String(host || '').toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
  }

  function updateCookieHeader(existingHeader, setCookieHeaders) {
    const jar = new Map();
    if (existingHeader) {
      existingHeader.split(';').forEach((chunk) => {
        const pair = chunk.trim();
        if (!pair || !pair.includes('=')) return;
        const [name, ...rest] = pair.split('=');
        jar.set(name.trim(), rest.join('=').trim());
      });
    }

    const list = Array.isArray(setCookieHeaders)
      ? setCookieHeaders
      : setCookieHeaders
        ? [setCookieHeaders]
        : [];
    for (const item of list) {
      if (!item || typeof item !== 'string') continue;
      const pair = item.split(';')[0];
      if (!pair || !pair.includes('=')) continue;
      const [name, ...rest] = pair.split('=');
      jar.set(name.trim(), rest.join('=').trim());
    }

    return Array.from(jar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  async function getVMServiceSettings() {
    const fallback = {
      proxmoxUrl: String(process.env.PROXMOX_URL || 'https://127.0.0.1:8006/').trim(),
      tinyFmUrl: String(process.env.TINYFM_URL || 'http://127.0.0.1:8080/index.php?p=').trim(),
      syncThingUrl: String(process.env.SYNCTHING_URL || 'https://127.0.0.1:8384/').trim(),
      proxmoxAutoLogin:
        String(process.env.PROXMOX_AUTO_LOGIN || 'true')
          .trim()
          .toLowerCase() !== 'false',
      tinyFmAutoLogin:
        String(process.env.TINYFM_AUTO_LOGIN || 'true')
          .trim()
          .toLowerCase() !== 'false',
      tinyFmUsername: String(process.env.TINYFM_USERNAME || '').trim(),
      tinyFmPassword: String(process.env.TINYFM_PASSWORD || ''),
      syncThingAutoLogin:
        String(process.env.SYNCTHING_AUTO_LOGIN || 'true')
          .trim()
          .toLowerCase() !== 'false',
      syncThingUsername: String(process.env.SYNCTHING_USERNAME || '').trim(),
      syncThingPassword: String(process.env.SYNCTHING_PASSWORD || ''),
    };

    try {
      const rootData =
        (await settingsReader?.readPath('settings/vmgenerator', { fallback: {} })) || {};
      const servicesData = rootData.services || {};
      const legacyTiny = rootData.tinyFM || {};
      const legacySyncThing = rootData.syncThing || {};
      const proxmoxUrlFromSettings = pickString(
        servicesData.proxmoxUrl,
        rootData?.proxmox?.url,
        fallback.proxmoxUrl,
      );
      const proxmoxHost = extractHostFromUrl(proxmoxUrlFromSettings);
      const hostDerivedTiny =
        !isLoopbackHost(proxmoxHost) && proxmoxHost
          ? `http://${proxmoxHost}:8080/index.php?p=`
          : fallback.tinyFmUrl;
      const hostDerivedSyncThing =
        !isLoopbackHost(proxmoxHost) && proxmoxHost ? `https://${proxmoxHost}:8384/` : '';

      let tinyFmUrl = pickString(
        servicesData.tinyFmUrl,
        legacyTiny.url,
        hostDerivedTiny,
        fallback.tinyFmUrl,
      );
      try {
        const tinyUrlObj = new URL(normalizeBaseUrl(tinyFmUrl, fallback.tinyFmUrl));
        tinyUrlObj.searchParams.set('p', '');
        tinyFmUrl = tinyUrlObj.toString();
      } catch {
        tinyFmUrl = fallback.tinyFmUrl;
      }

      const syncThingUrl = pickString(
        servicesData.syncThingUrl,
        legacySyncThing.url,
        fallback.syncThingUrl,
        hostDerivedSyncThing,
      );

      return {
        ...fallback,
        proxmoxUrl: proxmoxUrlFromSettings || fallback.proxmoxUrl,
        tinyFmUrl,
        syncThingUrl,
        proxmoxAutoLogin:
          typeof servicesData.proxmoxAutoLogin === 'boolean'
            ? servicesData.proxmoxAutoLogin
            : fallback.proxmoxAutoLogin,
        tinyFmAutoLogin:
          typeof servicesData.tinyFmAutoLogin === 'boolean'
            ? servicesData.tinyFmAutoLogin
            : fallback.tinyFmAutoLogin,
        tinyFmUsername: pickString(
          servicesData.tinyFmUsername,
          legacyTiny.username,
          fallback.tinyFmUsername,
        ),
        tinyFmPassword: pickString(
          servicesData.tinyFmPassword,
          legacyTiny.password,
          fallback.tinyFmPassword,
        ),
        syncThingAutoLogin:
          typeof servicesData.syncThingAutoLogin === 'boolean'
            ? servicesData.syncThingAutoLogin
            : fallback.syncThingAutoLogin,
        syncThingUsername: pickString(
          servicesData.syncThingUsername,
          legacySyncThing.username,
          fallback.syncThingUsername,
        ),
        syncThingPassword: pickString(
          servicesData.syncThingPassword,
          legacySyncThing.password,
          fallback.syncThingPassword,
        ),
      };
    } catch (error) {
      logger.error({ err: error }, 'Error reading VM service settings from Supabase settings');
      return fallback;
    }
  }

  async function ensureTinyFMLogin(settings) {
    const baseUrl = normalizeBaseUrl(
      settings.tinyFmUrl,
      String(process.env.TINYFM_URL || 'http://127.0.0.1:8080/index.php?p='),
    );
    const now = Date.now();
    if (
      tinyFMSession.cookieHeader &&
      tinyFMSession.baseUrl === baseUrl &&
      now < tinyFMSession.expiresAt
    ) {
      return;
    }

    const username = (settings.tinyFmUsername || '').trim();
    const password = settings.tinyFmPassword || '';
    if (!settings.tinyFmAutoLogin || !username || !password) {
      return;
    }

    try {
      const getResp = await axios.get(baseUrl, {
        httpsAgent,
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      let cookieHeader = updateCookieHeader('', getResp.headers['set-cookie']);

      const html = typeof getResp.data === 'string' ? getResp.data : '';
      const $ = cheerio.load(html);
      const form = $('form').first();
      const action = form.attr('action') || '';
      const loginUrl = new URL(action || '', baseUrl).toString();
      const payload = new URLSearchParams();

      form.find('input[type="hidden"]').each((_idx, el) => {
        const name = $(el).attr('name');
        if (!name) return;
        payload.append(name, $(el).attr('value') || '');
      });
      payload.set('fm_usr', username);
      payload.set('fm_pwd', password);

      const postResp = await axios.post(loginUrl, payload.toString(), {
        httpsAgent,
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: baseUrl,
          Cookie: cookieHeader,
        },
      });

      cookieHeader = updateCookieHeader(cookieHeader, postResp.headers['set-cookie']);

      const verifyResp = await axios.get(new URL('?p=qemu', baseUrl).toString(), {
        httpsAgent,
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
          Cookie: cookieHeader,
        },
      });
      const verifyHtml = typeof verifyResp.data === 'string' ? verifyResp.data : '';
      const isAuthenticated = verifyResp.status < 400 && !verifyHtml.includes('id="fm_usr"');
      if (!isAuthenticated) {
        tinyFMSession.baseUrl = '';
        tinyFMSession.cookieHeader = '';
        tinyFMSession.expiresAt = 0;
        throw new Error(`TinyFM auth verification failed with status ${verifyResp.status}`);
      }

      tinyFMSession.baseUrl = baseUrl;
      tinyFMSession.cookieHeader = cookieHeader;
      tinyFMSession.expiresAt = Date.now() + 30 * 60 * 1000;
      logger.info('TinyFM session prepared');
    } catch (error) {
      logger.warn({ err: error }, 'TinyFM auto login failed');
    }
  }

  async function ensureSyncThingLogin(settings) {
    const baseUrl = normalizeBaseUrl(
      settings.syncThingUrl,
      String(process.env.SYNCTHING_URL || 'https://127.0.0.1:8384/'),
    );
    const now = Date.now();
    if (
      syncThingSession.cookieHeader &&
      syncThingSession.baseUrl === baseUrl &&
      now < syncThingSession.expiresAt
    ) {
      return;
    }

    const username = (settings.syncThingUsername || '').trim();
    const password = settings.syncThingPassword || '';
    if (!settings.syncThingAutoLogin || !username || !password) {
      return;
    }

    try {
      const rootResp = await axios.get(baseUrl, {
        httpsAgent,
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      let cookieHeader = updateCookieHeader('', rootResp.headers['set-cookie']);

      const authBase = `${baseUrl.replace(/\/+$/, '')}/rest/noauth/auth`;
      const authPasswordUrl = `${authBase}/password`;
      let authResp = await axios.post(
        authPasswordUrl,
        {
          username,
          password,
          stayLoggedIn: true,
        },
        {
          httpsAgent,
          timeout: 10000,
          maxRedirects: 0,
          validateStatus: () => true,
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
          },
        },
      );

      if (authResp.status >= 400 || authResp.status === 404) {
        const payload = new URLSearchParams();
        payload.set('username', username);
        payload.set('password', password);
        payload.set('stayLoggedIn', 'true');
        authResp = await axios.post(authPasswordUrl, payload.toString(), {
          httpsAgent,
          timeout: 10000,
          maxRedirects: 0,
          validateStatus: () => true,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookieHeader,
          },
        });
      }

      if (authResp.status >= 400 || authResp.status === 404) {
        const payload = new URLSearchParams();
        payload.set('username', username);
        payload.set('password', password);
        authResp = await axios.post(authBase, payload.toString(), {
          httpsAgent,
          timeout: 10000,
          maxRedirects: 0,
          validateStatus: () => true,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookieHeader,
          },
        });
      }

      cookieHeader = updateCookieHeader(cookieHeader, authResp.headers['set-cookie']);

      const verifyResp = await axios.get(`${baseUrl.replace(/\/+$/, '')}/meta.js`, {
        httpsAgent,
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true,
        headers: {
          Cookie: cookieHeader,
        },
      });

      if (verifyResp.status >= 400) {
        syncThingSession.baseUrl = '';
        syncThingSession.cookieHeader = '';
        syncThingSession.expiresAt = 0;
        throw new Error(`SyncThing auth verification failed with status ${verifyResp.status}`);
      }

      syncThingSession.baseUrl = baseUrl;
      syncThingSession.cookieHeader = cookieHeader;
      syncThingSession.expiresAt = Date.now() + 30 * 60 * 1000;
      logger.info('SyncThing session prepared');
    } catch (error) {
      logger.warn({ err: error }, 'SyncThing auto login failed');
    }
  }

  async function resolveSyncThingUrl(preferredUrl) {
    const fallbackLocalUrl = 'https://127.0.0.1:8384/';
    const normalizedPreferred = normalizeBaseUrl(preferredUrl, fallbackLocalUrl);
    const now = Date.now();
    if (
      syncThingResolvedUrlCache.sourceUrl === normalizedPreferred &&
      syncThingResolvedUrlCache.resolvedUrl &&
      now < syncThingResolvedUrlCache.expiresAt
    ) {
      return syncThingResolvedUrlCache.resolvedUrl;
    }

    const preferredHost = extractHostFromUrl(normalizedPreferred);
    if (isLoopbackHost(preferredHost)) {
      syncThingResolvedUrlCache.sourceUrl = normalizedPreferred;
      syncThingResolvedUrlCache.resolvedUrl = normalizedPreferred;
      syncThingResolvedUrlCache.expiresAt = now + 2 * 60 * 1000;
      return normalizedPreferred;
    }

    try {
      await axios.get(normalizedPreferred, {
        httpsAgent,
        timeout: 2500,
        maxRedirects: 0,
        validateStatus: () => true,
      });
      syncThingResolvedUrlCache.sourceUrl = normalizedPreferred;
      syncThingResolvedUrlCache.resolvedUrl = normalizedPreferred;
      syncThingResolvedUrlCache.expiresAt = now + 2 * 60 * 1000;
      return normalizedPreferred;
    } catch (error) {
      try {
        await axios.get(fallbackLocalUrl, {
          httpsAgent,
          timeout: 2500,
          maxRedirects: 0,
          validateStatus: () => true,
        });
        logger.warn(
          { err: error },
          `SyncThing preferred URL unreachable (${normalizedPreferred}), fallback to ${fallbackLocalUrl}`,
        );
        syncThingResolvedUrlCache.sourceUrl = normalizedPreferred;
        syncThingResolvedUrlCache.resolvedUrl = fallbackLocalUrl;
        syncThingResolvedUrlCache.expiresAt = now + 2 * 60 * 1000;
        return fallbackLocalUrl;
      } catch {
        syncThingResolvedUrlCache.sourceUrl = normalizedPreferred;
        syncThingResolvedUrlCache.resolvedUrl = normalizedPreferred;
        syncThingResolvedUrlCache.expiresAt = now + 30 * 1000;
        return normalizedPreferred;
      }
    }
  }

  return {
    tinyFMSession,
    syncThingSession,
    normalizeBaseUrl,
    updateCookieHeader,
    getVMServiceSettings,
    ensureTinyFMLogin,
    ensureSyncThingLogin,
    resolveSyncThingUrl,
  };
}

module.exports = {
  createUiServiceAuth,
};
