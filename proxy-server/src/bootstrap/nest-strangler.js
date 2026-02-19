const axios = require('axios');

function normalizeModuleList(modules) {
  if (!Array.isArray(modules)) return new Set();
  return new Set(
    modules
      .map((item) =>
        String(item || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
}

function resolveModuleNameFromPath(pathname) {
  const cleanPath = String(pathname || '')
    .replace(/^\/+/, '')
    .trim();
  if (!cleanPath) return '';
  const [head] = cleanPath.split('/');
  const normalizedHead = String(head || '')
    .trim()
    .toLowerCase();
  if (normalizedHead === 'unattend-profiles') {
    return 'provisioning';
  }
  return normalizedHead;
}

function shouldProxyPath(moduleSet, moduleName) {
  if (!moduleSet.size || !moduleName) return false;
  if (moduleSet.has('*')) return true;
  return moduleSet.has(moduleName);
}

function copyResponseHeaders(targetResponse, sourceHeaders) {
  for (const [headerName, headerValue] of Object.entries(sourceHeaders || {})) {
    if (headerValue === undefined) continue;
    if (headerName.toLowerCase() === 'transfer-encoding') continue;
    targetResponse.setHeader(headerName, headerValue);
  }
}

function createNestStranglerMiddleware({ env, logger }) {
  const nestBaseUrl = String(env?.stranglerNestUrl || '')
    .trim()
    .replace(/\/+$/, '');
  const moduleSet = normalizeModuleList(env?.stranglerModules);
  const fallbackToLegacy = env?.stranglerFallbackToLegacy !== false;
  const requestTimeoutMs = Number(env?.stranglerTimeoutMs || 20_000);
  const enabled = Boolean(nestBaseUrl) && moduleSet.size > 0;

  if (enabled && logger?.info) {
    logger.info(
      {
        scope: 'strangler',
        nest_url: nestBaseUrl,
        modules: [...moduleSet],
        fallback_to_legacy: fallbackToLegacy,
      },
      'nest_strangler_enabled',
    );
  }

  return async (req, res, next) => {
    if (!enabled) {
      next();
      return;
    }

    const moduleName = resolveModuleNameFromPath(req.path);
    if (!shouldProxyPath(moduleSet, moduleName)) {
      next();
      return;
    }

    const targetUrl = `${nestBaseUrl}${req.originalUrl}`;
    const requestHeaders = { ...req.headers };
    delete requestHeaders.host;
    delete requestHeaders['content-length'];
    requestHeaders['x-strangler-source'] = 'api-legacy';

    try {
      const response = await axios.request({
        method: req.method,
        url: targetUrl,
        headers: requestHeaders,
        data: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
        params: req.query,
        responseType: 'stream',
        timeout: requestTimeoutMs,
        validateStatus: () => true,
      });

      copyResponseHeaders(res, response.headers);
      res.status(response.status);
      response.data.pipe(res);
      return;
    } catch (error) {
      if (!fallbackToLegacy) {
        if (logger?.error) {
          logger.error(
            {
              scope: 'strangler',
              target_url: targetUrl,
              module: moduleName,
              err: error,
            },
            'nest_strangler_proxy_failed',
          );
        }
        res.status(502).json({
          success: false,
          error: {
            code: 'NEST_STRANGLER_PROXY_FAILED',
            message: 'Failed to proxy request to Nest API',
          },
        });
        return;
      }

      if (logger?.warn) {
        logger.warn(
          {
            scope: 'strangler',
            target_url: targetUrl,
            module: moduleName,
            err: error,
          },
          'nest_strangler_fallback_to_legacy',
        );
      }
      next();
    }
  };
}

module.exports = {
  createNestStranglerMiddleware,
};
