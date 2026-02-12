function rewriteServiceUrl(req, targetUrl, rootFallbackToTarget) {
  const target = new URL(targetUrl);
  const suffix = req.url || '/';
  if (suffix === '/' || suffix === '') {
    req.url = rootFallbackToTarget
      ? `${target.pathname}${target.search || ''}`
      : (target.pathname || '/');
  } else {
    req.url = suffix;
  }
  return `${target.protocol}//${target.host}`;
}

const PROXMOX_UI_PATHS = [
  '/proxmox-ui',
  '/pve2',
  '/api2',
  '/novnc',
  '/xtermjs',
  '/pwt',
  '/widgettoolkit',
  '/proxmox-widget-toolkit',
  '/qrcode.min.js',
  '/proxmoxlib.js',
  '/PVE',
];

function mountUiProxyRoutes({
  app,
  authorizeRequest,
  proxmoxLogin,
  normalizeProxmoxCapShape,
  proxmoxSession,
  upsertCookieHeader,
  proxmoxUIProxy,
  getProxmoxTarget,
  getVMServiceSettings,
  normalizeBaseUrl,
  ensureTinyFMLogin,
  appendCookieHeader,
  tinyFMSession,
  tinyFMUIProxy,
  setTinyFmTarget,
  resolveSyncThingUrl,
  ensureSyncThingLogin,
  syncThingSession,
  syncThingUIProxy,
  setSyncThingTarget,
}) {
  async function ensureAuthorized(req, res) {
    if (typeof authorizeRequest !== 'function') return true;
    const authResult = await authorizeRequest(req);
    if (authResult?.ok) return true;

    const status = Number(authResult?.status || 401);
    const payload = authResult?.payload || {
      success: false,
      error: {
        code: status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
        message: 'Access denied',
      },
    };
    res.status(status).json(payload);
    return false;
  }

  PROXMOX_UI_PATHS.forEach((prefix) => {
    app.use(prefix, async (req, res) => {
      const authorized = await ensureAuthorized(req, res);
      if (!authorized) return;

      const reqPath = String(req.originalUrl || req.url || '');
      const isAccessTicketRequest = prefix === '/api2'
        && req.method === 'POST'
        && /^\/api2\/(?:json|extjs)\/access\/ticket(?:\?|$)/.test(reqPath);

      if (isAccessTicketRequest) {
        try {
          const session = await proxmoxLogin(true);
          res.setHeader('Set-Cookie', `PVEAuthCookie=${session.ticket}; Path=/; SameSite=Lax`);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          const payloadData = session.loginData && typeof session.loginData === 'object'
            ? session.loginData
            : {
              username: session.username || '',
              ticket: session.ticket,
              CSRFPreventionToken: session.csrfToken || '',
            };
          payloadData.cap = normalizeProxmoxCapShape(payloadData.cap);
          return res.status(200).send(JSON.stringify({
            success: 1,
            data: payloadData,
          }));
        } catch (error) {
          return res.status(401).json({
            success: 0,
            errors: 'authentication failure',
            message: error?.message || 'authentication failure',
          });
        }
      }

      const isCriticalClusterPoll = prefix === '/api2' && (
        reqPath.startsWith('/api2/json/cluster/resources')
        || reqPath.startsWith('/api2/json/cluster/tasks')
      );

      try {
        const forceRefresh = prefix === '/proxmox-ui' || isCriticalClusterPoll;
        await proxmoxLogin(forceRefresh);
      } catch (error) {
        // Continue unauthenticated; Proxmox UI can show login page.
      }

      if (proxmoxSession.ticket) {
        upsertCookieHeader(req, 'PVEAuthCookie', proxmoxSession.ticket);
        req.headers.csrfpreventiontoken = proxmoxSession.csrfToken || '';
      }

      req.url = req.originalUrl || (prefix + req.url);
      if (prefix === '/proxmox-ui') {
        req.url = req.url.replace('/proxmox-ui', '') || '/';
      }
      if (prefix === '/proxmox-ui' && req.url.startsWith('/PVE/')) {
        req.url = `/pve2/js${req.url}`;
      }
      proxmoxUIProxy.web(req, res, { target: getProxmoxTarget() });
    });
  });

  app.use('/tinyfm-ui', async (req, res) => {
    const authorized = await ensureAuthorized(req, res);
    if (!authorized) return;

    const settings = await getVMServiceSettings();
    const targetUrl = normalizeBaseUrl(
      settings.tinyFmUrl,
      String(process.env.TINYFM_URL || 'http://127.0.0.1:8080/index.php?p=')
    );
    setTinyFmTarget(new URL(targetUrl).origin);
    await ensureTinyFMLogin(settings);
    appendCookieHeader(req, tinyFMSession.cookieHeader);
    const target = rewriteServiceUrl(req, targetUrl, true);
    tinyFMUIProxy.web(req, res, { target });
  });

  app.use('/syncthing-ui', async (req, res) => {
    const authorized = await ensureAuthorized(req, res);
    if (!authorized) return;

    const settings = await getVMServiceSettings();
    const targetUrl = await resolveSyncThingUrl(settings.syncThingUrl);
    settings.syncThingUrl = targetUrl;
    setSyncThingTarget(new URL(targetUrl).origin);
    await ensureSyncThingLogin(settings);
    appendCookieHeader(req, syncThingSession.cookieHeader);
    const target = rewriteServiceUrl(req, targetUrl, true);
    syncThingUIProxy.web(req, res, { target });
  });
}

module.exports = {
  mountUiProxyRoutes,
};
