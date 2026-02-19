// Bot-Mox "doctor" command.
// Purpose: quickly verify that the stack is reachable and that debugging signals exist
// (health endpoints, trace headers, Jaeger UI) without running full scenario tests.

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requestWithTimeout(url, options = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const isHttps = u.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function toText(value) {
  return String(value == null ? '' : value);
}

function toInt(value, fallback) {
  const n = Number.parseInt(toText(value).trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function _pickFirstOk(results) {
  return results.find((r) => r?.ok) || null;
}

async function probeBaseUrl(baseUrl) {
  try {
    const res = await requestWithTimeout(`${baseUrl}/api/v1/health/live`, {}, 5000);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || 'unreachable' };
  }
}

async function detectMode() {
  const forced = toText(process.env.BOTMOX_BASE_URL).trim();
  if (forced) {
    return { mode: 'forced', baseUrl: forced.replace(/\/+$/, '') };
  }

  const retries = Math.max(1, toInt(process.env.BOTMOX_DOCTOR_RETRIES, 5));
  const retryDelayMs = Math.max(0, toInt(process.env.BOTMOX_DOCTOR_RETRY_DELAY_MS, 2000));

  const prodLike = 'http://localhost';
  const proxyPort = Number.parseInt(toText(process.env.BOTMOX_PROXY_PORT || '3001'), 10) || 3001;
  const devLike = `http://localhost:${proxyPort}`;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const prodProbe = await probeBaseUrl(prodLike);
    if (prodProbe.ok) {
      return { mode: 'prodlike', baseUrl: prodLike };
    }

    const devProbe = await probeBaseUrl(devLike);
    if (devProbe.ok) {
      return { mode: 'dev', baseUrl: devLike };
    }

    if (attempt < retries - 1 && retryDelayMs > 0) {
      await sleep(retryDelayMs);
    }
  }

  return { mode: 'dev', baseUrl: devLike };
}

async function checkUi(baseUrl) {
  // In prodlike, UI is served from baseUrl root.
  // In dev, UI is usually on :5173; we still treat API health as primary.
  const uiUrl = process.env.BOTMOX_UI_URL
    ? toText(process.env.BOTMOX_UI_URL).trim()
    : baseUrl === 'http://localhost'
      ? 'http://localhost'
      : 'http://localhost:5173';

  try {
    const res = await requestWithTimeout(uiUrl, {}, 8000);
    const contentType = res.headers?.['content-type'] || '';
    return {
      ok: res.ok,
      uiUrl,
      status: res.status,
      contentType,
    };
  } catch (e) {
    return { ok: false, uiUrl, error: e?.message || 'unreachable' };
  }
}

async function checkHealth(baseUrl) {
  const url = `${baseUrl}/api/v1/health`;
  try {
    const res = await requestWithTimeout(url, { headers: { accept: 'application/json' } }, 8000);
    const headers = {
      x_trace_id: res.headers?.['x-trace-id'],
      x_span_id: res.headers?.['x-span-id'],
      x_correlation_id: res.headers?.['x-correlation-id'],
    };

    const json = (() => {
      try {
        return JSON.parse(res.body || 'null');
      } catch {
        return null;
      }
    })();
    return {
      ok: res.ok && Boolean(json && json.success === true),
      url,
      status: res.status,
      headers,
      body: json,
    };
  } catch (e) {
    return { ok: false, url, error: e?.message || 'unreachable' };
  }
}

async function checkDiagTrace(baseUrl) {
  const url = `${baseUrl}/api/v1/diag/trace`;
  try {
    const res = await requestWithTimeout(
      url,
      {
        headers: {
          accept: 'application/json',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        },
      },
      8000,
    );
    const json = (() => {
      try {
        return JSON.parse(res.body || 'null');
      } catch {
        return null;
      }
    })();
    // If diagnostics are disabled, we expect 404; treat as "skipped", not failure.
    if (res.status === 404) {
      return { ok: true, skipped: true, url, status: 404, note: 'disabled' };
    }

    // If the running backend build does not include this route yet, the request often
    // hits auth middleware and returns 401. Treat as skipped with a rebuild hint.
    if (res.status === 401) {
      return { ok: true, skipped: true, url, status: 401, note: 'route-missing-or-protected' };
    }

    return {
      ok: res.ok && Boolean(json && json.success === true),
      url,
      status: res.status,
      body: json,
    };
  } catch (e) {
    return { ok: false, url, error: e?.message || 'unreachable' };
  }
}

async function checkJaeger() {
  const url = 'http://localhost:16686';
  try {
    const res = await requestWithTimeout(url, {}, 4000);
    return { ok: res.ok, url, status: res.status };
  } catch (e) {
    // Optional: Jaeger may not be running; report as skipped not failure.
    return { ok: true, skipped: true, url, error: e?.message || 'unreachable' };
  }
}

function summarize(report) {
  const lines = [];
  lines.push(`mode=${report.mode} api=${report.baseUrl}`);
  lines.push(`ui=${report.ui.ok ? 'OK' : 'FAIL'} (${report.ui.uiUrl})`);
  lines.push(`health=${report.health.ok ? 'OK' : 'FAIL'} (${report.health.url})`);

  const h = report.health?.headers || {};
  lines.push(
    `headers: x-correlation-id=${h.x_correlation_id || '-'} x-trace-id=${h.x_trace_id || '-'} x-span-id=${h.x_span_id || '-'}`,
  );

  if (report.health?.body?.success && report.health.body?.data) {
    const data = report.health.body.data;
    if (data.supabase_ready === false) lines.push('deps: supabase_ready=FALSE');
    if (data.s3_ready === false) lines.push('deps: s3_ready=FALSE');
  }

  if (report.diag?.skipped) {
    if (report.diag.note === 'route-missing-or-protected') {
      lines.push(
        'diag: skipped (backend build likely stale; rebuild prod-like stack to get /diag)',
      );
    } else {
      lines.push('diag: skipped (enable BOTMOX_DIAGNOSTICS_ENABLED=1)');
    }
  } else if (report.diag) {
    lines.push(`diag=${report.diag.ok ? 'OK' : 'FAIL'} (${report.diag.url})`);
  }

  if (report.jaeger?.skipped) {
    lines.push('jaeger: skipped (start with pnpm run obs:up)');
  } else if (report.jaeger) {
    lines.push(`jaeger=${report.jaeger.ok ? 'OK' : 'FAIL'} (${report.jaeger.url})`);
  }

  return lines.join('\n');
}

async function main() {
  const detected = await detectMode();
  const baseUrl = detected.baseUrl;

  // small delay helps when running right after stack start
  if (process.env.BOTMOX_DOCTOR_DELAY_MS) {
    await sleep(Number.parseInt(process.env.BOTMOX_DOCTOR_DELAY_MS, 10) || 0);
  }

  const report = {
    timestamp: nowIso(),
    mode: detected.mode,
    baseUrl,
    ui: await checkUi(baseUrl),
    health: await checkHealth(baseUrl),
    diag: await checkDiagTrace(baseUrl),
    jaeger: await checkJaeger(),
  };

  const outDir = path.join(process.cwd(), 'logs');
  ensureDir(outDir);
  const outPath = path.join(outDir, 'doctor-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(summarize(report));
  console.log(`report=${outPath}`);

  const healthData = report.health?.body?.data || null;
  const depsOk = healthData
    ? Boolean(healthData.supabase_ready !== false && healthData.s3_ready !== false)
    : true;
  const ok = report.ui.ok && report.health.ok && report.diag.ok && depsOk;
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('doctor_failed', err);
  process.exit(1);
});
