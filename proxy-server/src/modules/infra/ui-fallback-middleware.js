function createUiServiceFallbackMiddleware({
  authorizeRequest,
  inferUiService,
  getVMServiceSettings,
  normalizeBaseUrl,
  resolveSyncThingUrl,
  ensureTinyFMLogin,
  ensureSyncThingLogin,
  appendCookieHeader,
  tinyFMSession,
  syncThingSession,
  tinyFMUIProxy,
  syncThingUIProxy,
  getTinyFmTarget,
  setTinyFmTarget,
  getSyncThingTarget,
  setSyncThingTarget,
}) {
  return async function uiServiceFallbackMiddleware(req, res, next) {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    if (typeof authorizeRequest === 'function') {
      const authResult = await authorizeRequest(req);
      if (!authResult?.ok) {
        const status = Number(authResult?.status || 401);
        const payload = authResult?.payload || {
          success: false,
          error: {
            code: status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
            message: 'Access denied',
          },
        };
        return res.status(status).json(payload);
      }
    }

    const serviceHint = inferUiService(req);

    if (serviceHint === 'tinyfm') {
      try {
        const settings = await getVMServiceSettings();
        const targetUrl = normalizeBaseUrl(
          settings.tinyFmUrl,
          String(process.env.TINYFM_URL || 'http://127.0.0.1:8080/index.php?p=')
        );
        setTinyFmTarget(new URL(targetUrl).origin);
        await ensureTinyFMLogin(settings);
        appendCookieHeader(req, tinyFMSession.cookieHeader);
        tinyFMUIProxy.web(req, res, { target: getTinyFmTarget() });
        return;
      } catch (error) {
        console.warn('TinyFM fallback proxy failed:', error.message);
      }
    }

    if (serviceHint === 'syncthing') {
      try {
        const settings = await getVMServiceSettings();
        const targetUrl = await resolveSyncThingUrl(settings.syncThingUrl);
        settings.syncThingUrl = targetUrl;
        setSyncThingTarget(new URL(targetUrl).origin);
        await ensureSyncThingLogin(settings);
        appendCookieHeader(req, syncThingSession.cookieHeader);
        syncThingUIProxy.web(req, res, { target: getSyncThingTarget() });
        return;
      } catch (error) {
        console.warn('SyncThing fallback proxy failed:', error.message);
      }
    }

    next();
  };
}

function createProxmoxUiCatchAllMiddleware({
  authorizeRequest,
  proxmoxUIProxy,
  getProxmoxTarget,
}) {
  return async function proxmoxUiCatchAllMiddleware(req, res, next) {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    if (typeof authorizeRequest === 'function') {
      const authResult = await authorizeRequest(req);
      if (!authResult?.ok) {
        const status = Number(authResult?.status || 401);
        const payload = authResult?.payload || {
          success: false,
          error: {
            code: status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
            message: 'Access denied',
          },
        };
        return res.status(status).json(payload);
      }
    }

    proxmoxUIProxy.web(req, res, { target: getProxmoxTarget() });
  };
}

module.exports = {
  createUiServiceFallbackMiddleware,
  createProxmoxUiCatchAllMiddleware,
};
