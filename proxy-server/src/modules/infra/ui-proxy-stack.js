const httpProxy = require('http-proxy');
const { logger } = require('../../observability/logger');

function createUnavailableHtml(title, errorMessage, hint) {
  return (
    '<html><body style="font-family:sans-serif;color:#666;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5">' +
    '<div style="text-align:center"><h2>' + title + '</h2>' +
    '<p>' + errorMessage + '</p>' +
    '<p style="color:#999">' + hint + '</p></div></body></html>'
  );
}

function rewriteProxyLocationHeader(proxyRes, prefix, targetBaseUrl) {
  const originalLocation = proxyRes?.headers?.location;
  if (!originalLocation || typeof originalLocation !== 'string') {
    return;
  }

  const safePrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;

  try {
    const targetBase = new URL(targetBaseUrl);
    const resolved = new URL(originalLocation, `${targetBase.protocol}//${targetBase.host}`);
    if (resolved.origin === targetBase.origin) {
      proxyRes.headers.location = `${safePrefix}${resolved.pathname}${resolved.search}${resolved.hash}`;
      return;
    }
  } catch {
    // fallback rewrite below
  }

  if (originalLocation.startsWith('/')) {
    proxyRes.headers.location = `${safePrefix}${originalLocation}`;
  }
}

function stripFrameHeaders(proxyRes) {
  delete proxyRes.headers['x-frame-options'];
  delete proxyRes.headers['content-security-policy'];
  delete proxyRes.headers['content-security-policy-report-only'];
}

function createUiProxyStack({
  proxmoxSession,
  updateCookieHeader,
  getProxmoxTarget,
  getTinyFmTarget,
  getSyncThingTarget,
}) {
  const proxmoxUIProxy = httpProxy.createProxyServer({
    secure: false,
    changeOrigin: true,
    ws: true,
  });

  const tinyFMUIProxy = httpProxy.createProxyServer({
    secure: false,
    changeOrigin: true,
    ws: true,
  });

  const syncThingUIProxy = httpProxy.createProxyServer({
    secure: false,
    changeOrigin: true,
    ws: true,
  });

  proxmoxUIProxy.on('error', (err, _req, res) => {
    logger.error({ err }, 'Proxmox UI proxy error');
    if (res && res.writeHead) {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end(
        createUnavailableHtml(
          'Proxmox Unavailable',
          err.message,
          'Check that the Proxmox server is running and reachable.'
        )
      );
    }
  });

  tinyFMUIProxy.on('error', (err, _req, res) => {
    logger.error({ err }, 'TinyFM UI proxy error');
    if (res && res.writeHead) {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end(
        createUnavailableHtml(
          'TinyFM Unavailable',
          err.message,
          'Check TinyFM URL and credentials in VM settings.'
        )
      );
    }
  });

  syncThingUIProxy.on('error', (err, _req, res) => {
    logger.error({ err }, 'SyncThing UI proxy error');
    if (res && res.writeHead) {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end(
        createUnavailableHtml(
          'SyncThing Unavailable',
          err.message,
          'Check SyncThing URL and credentials in VM settings.'
        )
      );
    }
  });

  proxmoxUIProxy.on('proxyRes', (proxyRes, req) => {
    stripFrameHeaders(proxyRes);
    rewriteProxyLocationHeader(proxyRes, '/proxmox-ui', getProxmoxTarget());

    const statusCode = Number(proxyRes?.statusCode || 0);
    const reqPath = String(req?.url || '');
    if (statusCode === 401 && reqPath.startsWith('/api2/')) {
      proxmoxSession.ticket = null;
      proxmoxSession.csrfToken = null;
      proxmoxSession.expiresAt = 0;
      proxmoxSession.loginData = null;
    }
  });

  tinyFMUIProxy.on('proxyRes', (proxyRes) => {
    stripFrameHeaders(proxyRes);
    rewriteProxyLocationHeader(proxyRes, '/tinyfm-ui', getTinyFmTarget());
  });

  syncThingUIProxy.on('proxyRes', (proxyRes) => {
    stripFrameHeaders(proxyRes);
    rewriteProxyLocationHeader(proxyRes, '/syncthing-ui', getSyncThingTarget());
  });

  function appendCookieHeader(req, cookieHeader) {
    if (!cookieHeader) return;
    const currentCookie = req.headers.cookie || '';
    if (!currentCookie) {
      req.headers.cookie = cookieHeader;
      return;
    }
    req.headers.cookie = `${currentCookie}; ${cookieHeader}`;
  }

  function upsertCookieHeader(req, cookieName, cookieValue) {
    const currentCookie = req.headers.cookie || '';
    req.headers.cookie = updateCookieHeader(currentCookie, `${cookieName}=${cookieValue}; Path=/`);
  }

  function normalizeProxmoxCapShape(cap) {
    const base = (cap && typeof cap === 'object') ? cap : {};
    return {
      vms: (base.vms && typeof base.vms === 'object') ? base.vms : {},
      storage: (base.storage && typeof base.storage === 'object') ? base.storage : {},
      access: (base.access && typeof base.access === 'object') ? base.access : {},
      nodes: (base.nodes && typeof base.nodes === 'object') ? base.nodes : {},
      dc: (base.dc && typeof base.dc === 'object') ? base.dc : {},
      sdn: (base.sdn && typeof base.sdn === 'object') ? base.sdn : {},
      mapping: (base.mapping && typeof base.mapping === 'object') ? base.mapping : {},
    };
  }

  function inferUiService(req) {
    const reqUrl = String(req.url || '');
    if (reqUrl.startsWith('/tinyfm-ui')) return 'tinyfm';
    if (reqUrl.startsWith('/syncthing-ui')) return 'syncthing';
    if (reqUrl.startsWith('/proxmox-ui')) return 'proxmox';

    const referer = String(req.headers?.referer || req.headers?.referrer || '');
    const origin = String(req.headers?.origin || '');
    const hintText = `${referer} ${origin}`;
    if (hintText.includes('/tinyfm-ui')) return 'tinyfm';
    if (hintText.includes('/syncthing-ui')) return 'syncthing';
    if (hintText.includes('/proxmox-ui')) return 'proxmox';
    return null;
  }

  return {
    proxmoxUIProxy,
    tinyFMUIProxy,
    syncThingUIProxy,
    appendCookieHeader,
    upsertCookieHeader,
    normalizeProxmoxCapShape,
    inferUiService,
  };
}

module.exports = {
  createUiProxyStack,
};
