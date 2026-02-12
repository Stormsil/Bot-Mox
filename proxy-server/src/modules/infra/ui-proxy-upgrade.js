function attachUiProxyUpgradeHandler({
  server,
  authorizeUpgradeRequest,
  proxmoxUIProxy,
  tinyFMUIProxy,
  syncThingUIProxy,
  proxmoxSession,
  tinyFMSession,
  syncThingSession,
  upsertCookieHeader,
  appendCookieHeader,
  inferUiService,
  getProxmoxTarget,
  getTinyFmTarget,
  getSyncThingTarget,
}) {
  function rejectUpgrade(socket, result) {
    const status = Number(result?.status || 401);
    const message = status === 403 ? 'Forbidden' : 'Unauthorized';
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  }

  server.on('upgrade', async (req, socket, head) => {
    if (typeof authorizeUpgradeRequest === 'function') {
      try {
        const authResult = await authorizeUpgradeRequest(req);
        if (!authResult?.ok) {
          rejectUpgrade(socket, authResult);
          return;
        }
      } catch {
        rejectUpgrade(socket, { status: 401 });
        return;
      }
    }

    if (req.url && req.url.startsWith('/proxmox-ui')) {
      if (proxmoxSession.ticket) {
        upsertCookieHeader(req, 'PVEAuthCookie', proxmoxSession.ticket);
        req.headers.csrfpreventiontoken = proxmoxSession.csrfToken || '';
      }
      proxmoxUIProxy.ws(req, socket, head, { target: getProxmoxTarget() });
      return;
    }

    if (req.url && req.url.startsWith('/tinyfm-ui')) {
      appendCookieHeader(req, tinyFMSession.cookieHeader);
      tinyFMUIProxy.ws(req, socket, head, { target: getTinyFmTarget() });
      return;
    }

    if (req.url && req.url.startsWith('/syncthing-ui')) {
      appendCookieHeader(req, syncThingSession.cookieHeader);
      syncThingUIProxy.ws(req, socket, head, { target: getSyncThingTarget() });
      return;
    }

    const serviceHint = inferUiService(req);
    if (serviceHint === 'tinyfm') {
      appendCookieHeader(req, tinyFMSession.cookieHeader);
      tinyFMUIProxy.ws(req, socket, head, { target: getTinyFmTarget() });
      return;
    }

    if (serviceHint === 'syncthing') {
      appendCookieHeader(req, syncThingSession.cookieHeader);
      syncThingUIProxy.ws(req, socket, head, { target: getSyncThingTarget() });
      return;
    }

    // Other WS paths are handled by dedicated ws servers.
  });
}

module.exports = {
  attachUiProxyUpgradeHandler,
};
