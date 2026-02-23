#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');
const auditsDir = path.join(repoRoot, 'docs', 'audits');

function readTextIfExists(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function parseKeyValueLines(text) {
  const result = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[') || !trimmed.includes('=')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

function findLatestMarkdownTableRow(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith('|') || !line.endsWith('|')) {
      continue;
    }
    if (line.includes('---')) {
      continue;
    }
    return line;
  }
  return null;
}

function findMarkdownTableRows(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        Boolean(line) &&
        line.startsWith('|') &&
        line.endsWith('|') &&
        !line.includes('---') &&
        !line.toLowerCase().includes('timestamp (utc)'),
    );
}

function parseMarkdownTableRow(row) {
  if (!row) {
    return [];
  }
  return row
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parseSemicolonKeyValuePairs(value) {
  const result = {};
  for (const part of String(value || '').split(';')) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes('=')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key) {
      result[key] = val;
    }
  }
  return result;
}

function latestMatchingFile(pattern) {
  if (!fs.existsSync(auditsDir)) {
    return null;
  }
  const matches = fs
    .readdirSync(auditsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(auditsDir, entry.name));
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => {
    const statA = fs.statSync(a).mtimeMs;
    const statB = fs.statSync(b).mtimeMs;
    return statB - statA;
  });
  return matches[0];
}

function listMatchingFiles(pattern) {
  if (!fs.existsSync(auditsDir)) {
    return [];
  }
  return fs
    .readdirSync(auditsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(auditsDir, entry.name))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function relativeOrEmpty(absolutePath) {
  return absolutePath ? path.relative(repoRoot, absolutePath) : '';
}

function parseBoolish(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return null;
}

function parseNonNegativeInt(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function readEnvNonNegativeInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function buildRuntimeHotspotSummary(runtimeRow) {
  const http5xx = parseNonNegativeInt(runtimeRow[3]);
  const sseGap = parseNonNegativeInt(runtimeRow[6]);
  const wsGap = parseNonNegativeInt(runtimeRow[9]);
  const wsRejected = parseNonNegativeInt(runtimeRow[10]);

  const failThresholds = {
    http5xx: readEnvNonNegativeInt('POST_START_RUNTIME_HOTSPOT_FAIL_HTTP_5XX', 10),
    sseGap: readEnvNonNegativeInt('POST_START_RUNTIME_HOTSPOT_FAIL_SSE_GAP', 50),
    wsGap: readEnvNonNegativeInt('POST_START_RUNTIME_HOTSPOT_FAIL_WS_GAP', 50),
    wsRejected: readEnvNonNegativeInt('POST_START_RUNTIME_HOTSPOT_FAIL_WS_REJECTED', 20),
  };
  const warnThresholds = {
    http5xx: readEnvNonNegativeInt('POST_START_RUNTIME_HOTSPOT_WARN_HTTP_5XX', 1),
    sseGap: readEnvNonNegativeInt('POST_START_RUNTIME_HOTSPOT_WARN_SSE_GAP', 1),
    wsGap: readEnvNonNegativeInt('POST_START_RUNTIME_HOTSPOT_WARN_WS_GAP', 1),
    wsRejected: readEnvNonNegativeInt('POST_START_RUNTIME_HOTSPOT_WARN_WS_REJECTED', 1),
  };

  const hotspotFlags = [];
  const failFlags = [];

  function classifyMetric(metricName, value, warnThreshold, failThreshold) {
    if (value >= failThreshold && failThreshold > 0) {
      const token = `${metricName}=fail:${value}>=${failThreshold}`;
      hotspotFlags.push(token);
      failFlags.push(token);
      return;
    }
    if (value >= warnThreshold && warnThreshold > 0) {
      hotspotFlags.push(`${metricName}=warn:${value}>=${warnThreshold}`);
      return;
    }
    if (value > 0) {
      hotspotFlags.push(`${metricName}=info:${value}`);
    }
  }

  classifyMetric('http_5xx', http5xx, warnThresholds.http5xx, failThresholds.http5xx);
  classifyMetric('sse_gap', sseGap, warnThresholds.sseGap, failThresholds.sseGap);
  classifyMetric('ws_gap', wsGap, warnThresholds.wsGap, failThresholds.wsGap);
  classifyMetric('ws_rejected', wsRejected, warnThresholds.wsRejected, failThresholds.wsRejected);

  return {
    runtimeMetricsRowPresent: runtimeRow.length > 0,
    runtimeHotspotGate:
      runtimeRow.length > 0
        ? failFlags.length > 0
          ? 'fail'
          : hotspotFlags.length > 0
            ? 'warn'
            : 'pass'
        : 'unknown',
    runtimeHotspotFlags: hotspotFlags,
    runtimeHotspotFailFlags: failFlags,
    runtimeHotspotCounts: {
      http5xx,
      sseGap,
      wsGap,
      wsRejected,
    },
    runtimeHotspotThresholds: {
      warn: warnThresholds,
      fail: failThresholds,
    },
  };
}

function classifyRuntimeRowHotspot(row, thresholds) {
  const http5xx = parseNonNegativeInt(row[3]);
  const sseGap = parseNonNegativeInt(row[6]);
  const wsGap = parseNonNegativeInt(row[9]);
  const wsRejected = parseNonNegativeInt(row[10]);

  const fail = [];
  const warn = [];

  function checkMetric(metricName, value, warnThreshold, failThreshold) {
    if (failThreshold > 0 && value >= failThreshold) {
      fail.push(metricName);
      return;
    }
    if (warnThreshold > 0 && value >= warnThreshold) {
      warn.push(metricName);
    }
  }

  checkMetric('http_5xx', http5xx, thresholds.warn.http5xx, thresholds.fail.http5xx);
  checkMetric('sse_gap', sseGap, thresholds.warn.sseGap, thresholds.fail.sseGap);
  checkMetric('ws_gap', wsGap, thresholds.warn.wsGap, thresholds.fail.wsGap);
  checkMetric('ws_rejected', wsRejected, thresholds.warn.wsRejected, thresholds.fail.wsRejected);

  return { fail, warn, http5xx, sseGap, wsGap, wsRejected };
}

function buildRuntimeTrendSummary(runtimeRows, hotspotThresholds) {
  const windowSize = readEnvNonNegativeInt('POST_START_RUNTIME_TREND_WINDOW_SIZE', 10);
  const failRowsThreshold = readEnvNonNegativeInt('POST_START_RUNTIME_TREND_FAIL_ROWS', 2);
  const warnRowsThreshold = readEnvNonNegativeInt('POST_START_RUNTIME_TREND_WARN_ROWS', 1);
  const effectiveWindowSize = Math.max(1, windowSize || 10);

  const parsedRows = (runtimeRows || [])
    .map(parseMarkdownTableRow)
    .filter((row) => row.length >= 13);
  const recentRows = parsedRows.slice(-effectiveWindowSize);
  if (recentRows.length === 0) {
    return {
      gate: 'unknown',
      rowsInWindow: 0,
      windowSize: effectiveWindowSize,
      reasonCodes: ['runtime_trend_missing'],
      summaryLine: 'runtime_trend=unknown | rows=0',
      max: { http5xx: 0, sseGap: 0, wsGap: 0, wsRejected: 0 },
      failedSnapshotRows: 0,
      hotspotFailRows: 0,
      hotspotWarnRows: 0,
    };
  }

  let failedSnapshotRows = 0;
  let hotspotFailRows = 0;
  let hotspotWarnRows = 0;
  let maxHttp5xx = 0;
  let maxSseGap = 0;
  let maxWsGap = 0;
  let maxWsRejected = 0;

  for (const row of recentRows) {
    const rowStatus = String(row[11] || '')
      .trim()
      .toLowerCase();
    if (rowStatus === 'fail') {
      failedSnapshotRows += 1;
    }
    const hotspot = classifyRuntimeRowHotspot(row, hotspotThresholds);
    if (hotspot.fail.length > 0) {
      hotspotFailRows += 1;
    } else if (hotspot.warn.length > 0) {
      hotspotWarnRows += 1;
    }
    maxHttp5xx = Math.max(maxHttp5xx, hotspot.http5xx);
    maxSseGap = Math.max(maxSseGap, hotspot.sseGap);
    maxWsGap = Math.max(maxWsGap, hotspot.wsGap);
    maxWsRejected = Math.max(maxWsRejected, hotspot.wsRejected);
  }

  const reasonCodes = [];
  let gate = 'pass';

  if (failedSnapshotRows >= failRowsThreshold && failRowsThreshold > 0) {
    gate = 'fail';
    reasonCodes.push('runtime_trend_failed_rows_threshold');
  } else if (failedSnapshotRows >= warnRowsThreshold && warnRowsThreshold > 0) {
    gate = 'warn';
    reasonCodes.push('runtime_trend_failed_rows_present');
  }

  if (hotspotFailRows >= 1) {
    gate = gate === 'fail' ? 'fail' : 'warn';
    reasonCodes.push('runtime_trend_hotspot_fail_rows_present');
  }
  if (hotspotWarnRows >= 1) {
    if (gate === 'pass') {
      gate = 'warn';
    }
    reasonCodes.push('runtime_trend_hotspot_warn_rows_present');
  }

  if (reasonCodes.length === 0) {
    reasonCodes.push('runtime_trend_ok');
  }

  return {
    gate,
    rowsInWindow: recentRows.length,
    windowSize: effectiveWindowSize,
    reasonCodes: Array.from(new Set(reasonCodes)),
    summaryLine: [
      `runtime_trend=${gate}`,
      `rows=${recentRows.length}/${effectiveWindowSize}`,
      `fail_rows=${failedSnapshotRows}`,
      `hotspot_fail_rows=${hotspotFailRows}`,
      `hotspot_warn_rows=${hotspotWarnRows}`,
      `max_5xx=${maxHttp5xx}`,
      `max_sse_gap=${maxSseGap}`,
      `max_ws_gap=${maxWsGap}`,
      `max_ws_rejected=${maxWsRejected}`,
    ].join(' | '),
    max: {
      http5xx: maxHttp5xx,
      sseGap: maxSseGap,
      wsGap: maxWsGap,
      wsRejected: maxWsRejected,
    },
    failedSnapshotRows,
    hotspotFailRows,
    hotspotWarnRows,
  };
}

function buildAgentFlowSummary(runtimeRow) {
  if (!runtimeRow || runtimeRow.length === 0) {
    return {
      gate: 'unknown',
      reasonCodes: ['agent_flow_missing_runtime_row'],
      summaryLine: 'agent_flow=unknown | no_runtime_row',
      counts: {},
    };
  }
  const detailsMap = parseSemicolonKeyValuePairs(runtimeRow[12] || '');
  const wsOpened = parseNonNegativeInt(runtimeRow[7]);
  const wsClosed = parseNonNegativeInt(runtimeRow[8]);
  const wsRejected = parseNonNegativeInt(runtimeRow[10]);
  const assigned = parseNonNegativeInt(detailsMap.agent_ws_assigned);
  const empty = parseNonNegativeInt(detailsMap.agent_ws_empty);
  const ack = parseNonNegativeInt(detailsMap.agent_ws_ack);
  const result = parseNonNegativeInt(detailsMap.agent_ws_result);
  const hasAgentSignals = [
    'agent_ws_assigned',
    'agent_ws_empty',
    'agent_ws_ack',
    'agent_ws_result',
  ].some((key) => Object.hasOwn(detailsMap, key));
  if (!hasAgentSignals) {
    return {
      gate: 'unknown',
      reasonCodes: ['agent_flow_metrics_absent'],
      summaryLine: 'agent_flow=unknown | metrics_absent',
      counts: { assigned, empty, ack, result },
    };
  }

  const reasonCodes = [];
  let gate = 'pass';
  const hasWsPresence = wsOpened > 0 || wsClosed > 0 || wsRejected > 0;
  const hasAgentActivity = assigned > 0 || empty > 0 || ack > 0 || result > 0;
  if (hasWsPresence && assigned === 0 && empty > 0) {
    gate = 'warn';
    reasonCodes.push('agent_flow_only_empty_next_command');
  }
  if (hasWsPresence && assigned > 0 && ack === 0) {
    gate = 'warn';
    reasonCodes.push('agent_flow_assigned_without_ack');
  }
  if (hasWsPresence && ack > 0 && result === 0) {
    gate = 'warn';
    reasonCodes.push('agent_flow_ack_without_result');
  }
  if (!hasWsPresence && !hasAgentActivity) {
    gate = 'unknown';
    reasonCodes.push('agent_flow_idle_window');
  } else if (!hasAgentActivity) {
    gate = 'warn';
    reasonCodes.push('agent_flow_ws_presence_without_flow_metrics');
  }
  if (reasonCodes.length === 0) {
    reasonCodes.push('agent_flow_ok');
  }

  return {
    gate,
    reasonCodes,
    summaryLine: [
      `agent_flow=${gate}`,
      `assigned=${assigned}`,
      `empty=${empty}`,
      `ack=${ack}`,
      `result=${result}`,
      `ws_opened=${wsOpened}`,
      `ws_closed=${wsClosed}`,
      `ws_rejected=${wsRejected}`,
    ].join(' | '),
    counts: { assigned, empty, ack, result, wsOpened, wsClosed, wsRejected },
  };
}

function buildVmOpsSseFlowSummary(runtimeRow) {
  if (!runtimeRow || runtimeRow.length === 0) {
    return {
      gate: 'unknown',
      reasonCodes: ['vmops_sse_flow_missing_runtime_row'],
      summaryLine: 'vmops_sse_flow=unknown | no_runtime_row',
      counts: {},
    };
  }
  const detailsMap = parseSemicolonKeyValuePairs(runtimeRow[12] || '');
  const sseOpened = parseNonNegativeInt(runtimeRow[4]);
  const sseClosed = parseNonNegativeInt(runtimeRow[5]);
  const replay = parseNonNegativeInt(detailsMap.vmops_sse_replay);
  const live = parseNonNegativeInt(detailsMap.vmops_sse_live);
  const filtered = parseNonNegativeInt(detailsMap.vmops_sse_filtered);
  const hasSignals = ['vmops_sse_replay', 'vmops_sse_live', 'vmops_sse_filtered'].some((key) =>
    Object.hasOwn(detailsMap, key),
  );
  if (!hasSignals) {
    return {
      gate: 'unknown',
      reasonCodes: ['vmops_sse_flow_metrics_absent'],
      summaryLine: 'vmops_sse_flow=unknown | metrics_absent',
      counts: { replay, live, filtered },
    };
  }

  const reasonCodes = [];
  let gate = 'pass';
  const hasSsePresence = sseOpened > 0 || sseClosed > 0;
  const hasVmOpsSseActivity = live > 0 || replay > 0 || filtered > 0;
  if (hasSsePresence && filtered > 0 && live === 0 && replay === 0) {
    gate = 'warn';
    reasonCodes.push('vmops_sse_flow_filtered_without_delivery');
  }
  if (!hasSsePresence && !hasVmOpsSseActivity) {
    gate = 'unknown';
    reasonCodes.push('vmops_sse_flow_idle_window');
  } else if (hasSsePresence && !hasVmOpsSseActivity) {
    gate = 'warn';
    reasonCodes.push('vmops_sse_flow_presence_without_metrics');
  }
  if (reasonCodes.length === 0) {
    reasonCodes.push('vmops_sse_flow_ok');
  }

  return {
    gate,
    reasonCodes,
    summaryLine: [
      `vmops_sse_flow=${gate}`,
      `live=${live}`,
      `replay=${replay}`,
      `filtered=${filtered}`,
      `sse_opened=${sseOpened}`,
      `sse_closed=${sseClosed}`,
    ].join(' | '),
    counts: { replay, live, filtered, sseOpened, sseClosed },
  };
}

function buildFlowTrendSummary(options) {
  const { runtimeRows, flowName, buildRowSummary, envWindowSize, envFailRows, envWarnRows } =
    options;

  const windowSize = readEnvNonNegativeInt(envWindowSize, 10);
  const failRowsThreshold = readEnvNonNegativeInt(envFailRows, 2);
  const warnRowsThreshold = readEnvNonNegativeInt(envWarnRows, 1);
  const effectiveWindowSize = Math.max(1, windowSize || 10);

  const parsedRows = (runtimeRows || [])
    .map(parseMarkdownTableRow)
    .filter((row) => row.length >= 13);
  const recentRows = parsedRows.slice(-effectiveWindowSize);
  if (recentRows.length === 0) {
    return {
      gate: 'unknown',
      reasonCodes: [`${flowName}_trend_missing`],
      rowsInWindow: 0,
      windowSize: effectiveWindowSize,
      warnRows: 0,
      unknownRows: 0,
      passRows: 0,
      summaryLine: `${flowName}_trend=unknown | rows=0`,
    };
  }

  let warnRows = 0;
  let unknownRows = 0;
  let passRows = 0;
  for (const row of recentRows) {
    const rowSummary = buildRowSummary(row);
    const gate = String(rowSummary.gate || '').toLowerCase();
    if (gate === 'warn') warnRows += 1;
    else if (gate === 'unknown') unknownRows += 1;
    else if (gate === 'pass') passRows += 1;
  }

  let gate = 'pass';
  const reasonCodes = [];
  if (failRowsThreshold > 0 && warnRows >= failRowsThreshold) {
    gate = 'fail';
    reasonCodes.push(`${flowName}_trend_warn_rows_threshold`);
  } else if (warnRowsThreshold > 0 && warnRows >= warnRowsThreshold) {
    gate = 'warn';
    reasonCodes.push(`${flowName}_trend_warn_rows_present`);
  }
  if (passRows === 0 && warnRows === 0 && unknownRows > 0) {
    gate = 'unknown';
    reasonCodes.push(`${flowName}_trend_only_unknown_rows`);
  }
  if (reasonCodes.length === 0) {
    reasonCodes.push(`${flowName}_trend_ok`);
  }

  return {
    gate,
    reasonCodes,
    rowsInWindow: recentRows.length,
    windowSize: effectiveWindowSize,
    warnRows,
    unknownRows,
    passRows,
    summaryLine: [
      `${flowName}_trend=${gate}`,
      `rows=${recentRows.length}/${effectiveWindowSize}`,
      `warn_rows=${warnRows}`,
      `pass_rows=${passRows}`,
      `unknown_rows=${unknownRows}`,
    ].join(' | '),
  };
}

function buildSmokeTrendSummary(smokeRows) {
  const windowSize = readEnvNonNegativeInt('POST_START_SMOKE_TREND_WINDOW_SIZE', 10);
  const failRowsThreshold = readEnvNonNegativeInt('POST_START_SMOKE_TREND_FAIL_ROWS', 2);
  const warnRowsThreshold = readEnvNonNegativeInt('POST_START_SMOKE_TREND_WARN_ROWS', 1);
  const effectiveWindowSize = Math.max(1, windowSize || 10);

  const parsedRows = (smokeRows || []).map(parseMarkdownTableRow).filter((row) => row.length >= 6);
  const recentRows = parsedRows.slice(-effectiveWindowSize);
  if (recentRows.length === 0) {
    return {
      gate: 'unknown',
      reasonCodes: ['smoke_trend_missing'],
      rowsInWindow: 0,
      windowSize: effectiveWindowSize,
      failRows: 0,
      summaryLine: 'smoke_trend=unknown | rows=0',
    };
  }

  let failRows = 0;
  let passRows = 0;
  let notRunRows = 0;
  for (const row of recentRows) {
    const checks = String(row[4] || '')
      .trim()
      .toLowerCase();
    if (checks === 'fail') failRows += 1;
    else if (checks === 'pass') passRows += 1;
    else if (checks === 'not-run') notRunRows += 1;
  }

  let gate = 'pass';
  const reasonCodes = [];
  const infoCodes = [];
  if (failRowsThreshold > 0 && failRows >= failRowsThreshold) {
    gate = 'fail';
    reasonCodes.push('smoke_trend_fail_rows_threshold');
  } else if (warnRowsThreshold > 0 && failRows >= warnRowsThreshold) {
    gate = 'warn';
    reasonCodes.push('smoke_trend_fail_rows_present');
  }
  if (notRunRows > 0) {
    infoCodes.push('smoke_trend_not_run_rows_present');
  }
  if (passRows === 0 && failRows === 0 && notRunRows > 0) {
    gate = 'unknown';
    reasonCodes.push('smoke_trend_only_not_run_rows');
  }
  if (reasonCodes.length === 0) {
    reasonCodes.push('smoke_trend_ok');
  }

  return {
    gate,
    reasonCodes,
    infoCodes,
    rowsInWindow: recentRows.length,
    windowSize: effectiveWindowSize,
    failRows,
    passRows,
    notRunRows,
    summaryLine: [
      `smoke_trend=${gate}`,
      `rows=${recentRows.length}/${effectiveWindowSize}`,
      `fail_rows=${failRows}`,
      `pass_rows=${passRows}`,
      `not_run_rows=${notRunRows}`,
      `info_codes=${infoCodes.join(',') || 'none'}`,
    ].join(' | '),
  };
}

function buildStackTrendSummary(stackReportFiles) {
  const windowSize = readEnvNonNegativeInt('POST_START_STACK_TREND_WINDOW_SIZE', 10);
  const failRowsThreshold = readEnvNonNegativeInt('POST_START_STACK_TREND_FAIL_ROWS', 2);
  const warnRowsThreshold = readEnvNonNegativeInt('POST_START_STACK_TREND_WARN_ROWS', 1);
  const effectiveWindowSize = Math.max(1, windowSize || 10);

  const parsed = (stackReportFiles || [])
    .map((filePath) => {
      try {
        return parseKeyValueLines(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const recent = parsed.slice(-effectiveWindowSize);
  if (recent.length === 0) {
    return {
      gate: 'unknown',
      reasonCodes: ['stack_trend_missing'],
      rowsInWindow: 0,
      windowSize: effectiveWindowSize,
      notReadyRows: 0,
      healthFailRows: 0,
      summaryLine: 'stack_trend=unknown | rows=0',
    };
  }

  let notReadyRows = 0;
  let healthFailRows = 0;
  for (const kv of recent) {
    const stackStatus = String(kv.stack_status || '')
      .trim()
      .toUpperCase();
    const uiHealth = parseBoolish(kv.ui_health);
    const apiHealth = parseBoolish(kv.api_health);
    const adminHealth = parseBoolish(kv.admin_health);
    if (stackStatus && stackStatus !== 'READY') {
      notReadyRows += 1;
    }
    if (uiHealth === false || apiHealth === false || adminHealth === false) {
      healthFailRows += 1;
    }
  }

  let gate = 'pass';
  const reasonCodes = [];
  const problemRows = Math.max(notReadyRows, healthFailRows);
  if (failRowsThreshold > 0 && problemRows >= failRowsThreshold) {
    gate = 'fail';
    reasonCodes.push('stack_trend_problem_rows_threshold');
  } else if (warnRowsThreshold > 0 && problemRows >= warnRowsThreshold) {
    gate = 'warn';
    reasonCodes.push('stack_trend_problem_rows_present');
  }
  if (reasonCodes.length === 0) {
    reasonCodes.push('stack_trend_ok');
  }

  return {
    gate,
    reasonCodes,
    rowsInWindow: recent.length,
    windowSize: effectiveWindowSize,
    notReadyRows,
    healthFailRows,
    summaryLine: [
      `stack_trend=${gate}`,
      `rows=${recent.length}/${effectiveWindowSize}`,
      `not_ready_rows=${notReadyRows}`,
      `health_fail_rows=${healthFailRows}`,
    ].join(' | '),
  };
}

function buildDirectSmokeAuditTrendSummary(options) {
  const prefix = String(options?.prefix || 'direct_smoke_audit');
  const files = Array.isArray(options?.auditFiles) ? options.auditFiles : [];
  const windowSize = readEnvNonNegativeInt(String(options?.envWindowSize || ''), 10);
  const failRowsThreshold = readEnvNonNegativeInt(String(options?.envFailRows || ''), 2);
  const warnRowsThreshold = readEnvNonNegativeInt(String(options?.envWarnRows || ''), 1);
  const effectiveWindowSize = Math.max(1, windowSize || 10);

  const parsed = files
    .map((filePath) => {
      try {
        return parseKeyValueLines(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const recent = parsed.slice(-effectiveWindowSize);
  if (recent.length === 0) {
    return {
      gate: 'unknown',
      reasonCodes: [`${prefix}_trend_missing`],
      infoCodes: [],
      rowsInWindow: 0,
      windowSize: effectiveWindowSize,
      failRows: 0,
      passRows: 0,
      skippedRows: 0,
      summaryLine: `${prefix}_trend=unknown | rows=0`,
    };
  }

  let failRows = 0;
  let passRows = 0;
  let skippedRows = 0;
  let unknownRows = 0;
  for (const kv of recent) {
    const status = String(kv.status || '')
      .trim()
      .toLowerCase();
    if (status === 'fail') failRows += 1;
    else if (status === 'pass') passRows += 1;
    else if (status === 'skipped') skippedRows += 1;
    else unknownRows += 1;
  }

  let gate = 'pass';
  const reasonCodes = [];
  const infoCodes = [];
  if (failRowsThreshold > 0 && failRows >= failRowsThreshold) {
    gate = 'fail';
    reasonCodes.push(`${prefix}_trend_fail_rows_threshold`);
  } else if (warnRowsThreshold > 0 && failRows >= warnRowsThreshold) {
    gate = 'warn';
    reasonCodes.push(`${prefix}_trend_fail_rows_present`);
  }
  if (skippedRows > 0) {
    infoCodes.push(`${prefix}_trend_skipped_rows_present`);
  }
  if (passRows === 0 && failRows === 0 && (skippedRows > 0 || unknownRows > 0)) {
    gate = 'unknown';
    reasonCodes.push(`${prefix}_trend_only_nonpass_rows`);
  }
  if (reasonCodes.length === 0) {
    reasonCodes.push(`${prefix}_trend_ok`);
  }

  return {
    gate,
    reasonCodes,
    infoCodes,
    rowsInWindow: recent.length,
    windowSize: effectiveWindowSize,
    failRows,
    passRows,
    skippedRows,
    unknownRows,
    summaryLine: [
      `${prefix}_trend=${gate}`,
      `rows=${recent.length}/${effectiveWindowSize}`,
      `fail_rows=${failRows}`,
      `pass_rows=${passRows}`,
      `skipped_rows=${skippedRows}`,
      `unknown_rows=${unknownRows}`,
      `info_codes=${infoCodes.join(',') || 'none'}`,
    ].join(' | '),
  };
}

function buildSingleDirectSmokeAuditSignal(prefix, kv) {
  const status = String(kv?.status || '')
    .trim()
    .toLowerCase();
  if (!status) {
    return {
      gate: 'unknown',
      reasonCodes: [`${prefix}_direct_audit_missing`],
      summaryLine: `${prefix}=unknown | source=direct_audit_missing`,
    };
  }
  if (status === 'pass') {
    return {
      gate: 'pass',
      reasonCodes: [`${prefix}_direct_audit_pass`],
      summaryLine: `${prefix}=pass | source=direct_audit`,
    };
  }
  if (status === 'fail') {
    return {
      gate: 'fail',
      reasonCodes: [`${prefix}_direct_audit_fail`],
      summaryLine: `${prefix}=fail | source=direct_audit`,
    };
  }
  if (status === 'skipped') {
    return {
      gate: 'unknown',
      reasonCodes: [`${prefix}_direct_audit_skipped`],
      summaryLine: `${prefix}=unknown | source=direct_audit_skipped`,
    };
  }
  return {
    gate: 'unknown',
    reasonCodes: [`${prefix}_direct_audit_unknown_status`],
    summaryLine: `${prefix}=unknown | source=direct_audit_unknown_status`,
  };
}

function buildTenantIsolationSmokeSignals(smokeRow) {
  if (!smokeRow || smokeRow.length === 0) {
    return {
      tenantGate: 'unknown',
      tenantReasonCodes: ['tenant_isolation_smoke_missing'],
      agentsGate: 'unknown',
      agentsReasonCodes: ['agents_tenant_isolation_smoke_missing'],
      summaryLine:
        'tenant_isolation_smoke=unknown | agents_tenant_isolation_smoke=unknown | no_smoke_row',
    };
  }

  const checksStatus = String(smokeRow[4] || '')
    .trim()
    .toLowerCase();
  const details = String(smokeRow[5] || '').toLowerCase();

  let tenantGate = 'unknown';
  let agentsGate = 'unknown';
  const tenantReasonCodes = [];
  const agentsReasonCodes = [];

  if (checksStatus === 'pass') {
    tenantGate = 'pass';
    agentsGate = 'pass';
    tenantReasonCodes.push('tenant_isolation_smoke_included_in_smoke_window_pass');
    agentsReasonCodes.push('agents_tenant_isolation_smoke_included_in_smoke_window_pass');
  } else if (checksStatus === 'not-run') {
    tenantGate = 'unknown';
    agentsGate = 'unknown';
    tenantReasonCodes.push('tenant_isolation_smoke_window_not_run');
    agentsReasonCodes.push('agents_tenant_isolation_smoke_window_not_run');
  } else if (checksStatus === 'fail') {
    const failedTenant = details.includes('smoke:tenant-isolation:e2e');
    const failedAgents = details.includes('smoke:agents-tenant-isolation:e2e');
    if (failedTenant) {
      tenantGate = 'fail';
      tenantReasonCodes.push('tenant_isolation_smoke_failed_in_smoke_window');
    } else {
      tenantGate = 'unknown';
      tenantReasonCodes.push('tenant_isolation_smoke_failure_not_identified');
    }
    if (failedAgents) {
      agentsGate = 'fail';
      agentsReasonCodes.push('agents_tenant_isolation_smoke_failed_in_smoke_window');
    } else {
      agentsGate = 'unknown';
      agentsReasonCodes.push('agents_tenant_isolation_smoke_failure_not_identified');
    }
  } else {
    tenantReasonCodes.push('tenant_isolation_smoke_unknown_checks_status');
    agentsReasonCodes.push('agents_tenant_isolation_smoke_unknown_checks_status');
  }

  return {
    tenantGate,
    tenantReasonCodes,
    agentsGate,
    agentsReasonCodes,
    summaryLine: [
      `tenant_isolation_smoke=${tenantGate}`,
      `agents_tenant_isolation_smoke=${agentsGate}`,
      `checks_status=${checksStatus || 'unknown'}`,
    ].join(' | '),
  };
}

function buildTenantIsolationSmokeSignalsFromDirectAudits(tenantKv, agentsKv) {
  const tenantStatus = String(tenantKv?.status || '')
    .trim()
    .toLowerCase();
  const agentsStatus = String(agentsKv?.status || '')
    .trim()
    .toLowerCase();
  const hasTenant = Boolean(tenantStatus);
  const hasAgents = Boolean(agentsStatus);
  if (!hasTenant && !hasAgents) {
    return null;
  }

  function mapStatus(prefix, status) {
    if (status === 'pass') {
      return {
        gate: 'pass',
        reasonCodes: [`${prefix}_direct_audit_pass`],
      };
    }
    if (status === 'fail') {
      return {
        gate: 'fail',
        reasonCodes: [`${prefix}_direct_audit_fail`],
      };
    }
    if (status === 'skipped') {
      return {
        gate: 'unknown',
        reasonCodes: [`${prefix}_direct_audit_skipped`],
      };
    }
    return {
      gate: 'unknown',
      reasonCodes: [`${prefix}_direct_audit_unknown_status`],
    };
  }

  const tenantMapped = hasTenant
    ? mapStatus('tenant_isolation_smoke', tenantStatus)
    : { gate: 'unknown', reasonCodes: ['tenant_isolation_smoke_direct_audit_missing'] };
  const agentsMapped = hasAgents
    ? mapStatus('agents_tenant_isolation_smoke', agentsStatus)
    : { gate: 'unknown', reasonCodes: ['agents_tenant_isolation_smoke_direct_audit_missing'] };

  return {
    tenantGate: tenantMapped.gate,
    tenantReasonCodes: tenantMapped.reasonCodes,
    agentsGate: agentsMapped.gate,
    agentsReasonCodes: agentsMapped.reasonCodes,
    summaryLine: [
      `tenant_isolation_smoke=${tenantMapped.gate}`,
      `agents_tenant_isolation_smoke=${agentsMapped.gate}`,
      'source=direct_smoke_audits',
    ].join(' | '),
  };
}

function classifyReasonCodeLevel(reasonCode) {
  switch (reasonCode) {
    case 'stack_status_not_ready':
    case 'ui_health_false':
    case 'api_health_false':
    case 'admin_health_false':
    case 'missing_sources':
      return 'startup';
    case 'runtime_metrics_status_fail':
      return 'runtime';
    case 'smoke_checks_status_not_pass':
    case 'crypto_rotation_status_not_ok':
      return 'audit';
    case 'ready':
      return 'none';
    default:
      return 'unknown';
  }
}

function computePostStartSeverity(input) {
  if (String(input.readinessGate || '').toLowerCase() === 'fail') {
    return 'critical';
  }
  if (String(input.runtimeGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.runtimeHotspotGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.runtimeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.runtimeHotspotGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.runtimeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.agentFlowGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.vmOpsSseFlowGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.agentFlowTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.vmOpsSseFlowTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.agentFlowTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.vmOpsSseFlowTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.tenantIsolationSmokeGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.agentsTenantIsolationSmokeGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.authAccessSmokeGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.settingsSurfaceSmokeGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.adminRbacSmokeGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.adminOriginSmokeGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.billingAdminSmokeGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.dataEncryptionSmokeGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.tenantIsolationSmokeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.agentsTenantIsolationSmokeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.authAccessSmokeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.settingsSurfaceSmokeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.adminRbacSmokeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.adminOriginSmokeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.billingAdminSmokeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.dataEncryptionSmokeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.stackTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.smokeTrendGate || '').toLowerCase() === 'fail') {
    return 'high';
  }
  if (String(input.stackTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.smokeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.tenantIsolationSmokeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.agentsTenantIsolationSmokeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.authAccessSmokeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.settingsSurfaceSmokeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.adminRbacSmokeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.adminOriginSmokeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.billingAdminSmokeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.dataEncryptionSmokeTrendGate || '').toLowerCase() === 'warn') {
    return 'medium';
  }
  if (String(input.diagnosticsVerdict || '').toLowerCase() === 'degraded') {
    return 'medium';
  }
  return 'ok';
}

function buildVerdict(input) {
  const reasons = [];
  const reasonCodes = [];
  const stackStatus = String(input.stackStatus || '')
    .trim()
    .toUpperCase();
  const missing = [];

  if (!input.stackReportPresent) missing.push('stack_up');
  if (!input.runtimeRowPresent) missing.push('runtime_metrics');

  if (stackStatus && stackStatus !== 'READY') {
    reasonCodes.push('stack_status_not_ready');
    reasons.push(`stack_status=${input.stackStatus}`);
  }
  if (input.uiHealth === false) {
    reasonCodes.push('ui_health_false');
    reasons.push('ui_health=false');
  }
  if (input.apiHealth === false) {
    reasonCodes.push('api_health_false');
    reasons.push('api_health=false');
  }
  if (input.adminHealth === false) {
    reasonCodes.push('admin_health_false');
    reasons.push('admin_health=false');
  }

  const runtimeRowPresent = input.runtimeRowPresent === true;
  if (
    runtimeRowPresent &&
    String(input.runtimeStatus || '')
      .trim()
      .toLowerCase() === 'fail'
  ) {
    reasonCodes.push('runtime_metrics_status_fail');
    reasons.push(`runtime_metrics_status=${input.runtimeStatus}`);
  }

  const smokeRowPresent = input.smokeRowPresent === true;
  const smokeStatus = String(input.smokeChecksStatus || '')
    .trim()
    .toLowerCase();
  if (smokeRowPresent && smokeStatus && smokeStatus !== 'pass') {
    reasonCodes.push('smoke_checks_status_not_pass');
    reasons.push(`smoke_checks_status=${input.smokeChecksStatus}`);
  }

  const cryptoStatus = String(input.cryptoStatus || '')
    .trim()
    .toLowerCase();
  if (
    input.cryptoSourcePresent &&
    cryptoStatus &&
    !['ok', 'pass', 'success'].includes(cryptoStatus)
  ) {
    reasonCodes.push('crypto_rotation_status_not_ok');
    reasons.push(`crypto_rotation_status=${input.cryptoStatus}`);
  }

  if (missing.length > 0) {
    reasonCodes.push('missing_sources');
    reasons.push(`missing_sources=${missing.join(',')}`);
  }

  if (reasons.length > 0) {
    const readinessReasonCodes = [];
    if (reasonCodes.includes('stack_status_not_ready'))
      readinessReasonCodes.push('stack_status_not_ready');
    if (reasonCodes.includes('ui_health_false')) readinessReasonCodes.push('ui_health_false');
    if (reasonCodes.includes('api_health_false')) readinessReasonCodes.push('api_health_false');
    if (reasonCodes.includes('admin_health_false')) readinessReasonCodes.push('admin_health_false');
    if (reasonCodes.includes('missing_sources')) readinessReasonCodes.push('missing_sources');
    const runtimeReasonCodes = [];
    if (reasonCodes.includes('runtime_metrics_status_fail')) {
      runtimeReasonCodes.push('runtime_metrics_status_fail');
    }
    const dedupReasonCodes = Array.from(new Set(reasonCodes));
    const reasonLevelPairs = dedupReasonCodes.map((code) => ({
      code,
      level: classifyReasonCodeLevel(code),
    }));
    return {
      verdict: 'DEGRADED',
      reason: reasons.join('; '),
      reasonCodes: dedupReasonCodes,
      reasonLevels: Array.from(new Set(reasonLevelPairs.map((item) => item.level))),
      reasonLevelMap: reasonLevelPairs.map((item) => `${item.code}:${item.level}`),
      readinessGate: readinessReasonCodes.length > 0 ? 'fail' : 'pass',
      readinessReasonCodes: Array.from(new Set(readinessReasonCodes)),
      runtimeGate: runtimeReasonCodes.length > 0 ? 'fail' : 'pass',
      runtimeReasonCodes: Array.from(new Set(runtimeReasonCodes)),
      hasMissingSources: missing.length > 0,
    };
  }
  return {
    verdict: 'READY',
    reason: 'all available post-start diagnostics are healthy',
    reasonCodes: ['ready'],
    reasonLevels: ['none'],
    reasonLevelMap: ['ready:none'],
    readinessGate: 'pass',
    readinessReasonCodes: ['ready'],
    runtimeGate: 'pass',
    runtimeReasonCodes: ['ready'],
    hasMissingSources: false,
  };
}

function computeStartupRuntimeCorrelation(input) {
  const startupFailCodes = [];
  const startupWarnCodes = [];
  const runtimeFailCodes = [];
  const runtimeWarnCodes = [];

  function collectGate(scope, name, gate) {
    const normalized = String(gate || '')
      .trim()
      .toLowerCase();
    if (!normalized || normalized === 'unknown' || normalized === 'pass' || normalized === 'ok') {
      return;
    }
    if (normalized === 'fail') {
      if (scope === 'startup') startupFailCodes.push(name);
      else runtimeFailCodes.push(name);
      return;
    }
    if (normalized === 'warn') {
      if (scope === 'startup') startupWarnCodes.push(name);
      else runtimeWarnCodes.push(name);
    }
  }

  collectGate('startup', 'readiness', input.readinessGate);
  collectGate('startup', 'stack_trend', input.stackTrendGate);
  collectGate('startup', 'smoke_trend', input.smokeTrendGate);
  collectGate('startup', 'tenant_isolation_smoke', input.tenantIsolationSmokeGate);
  collectGate('startup', 'agents_tenant_isolation_smoke', input.agentsTenantIsolationSmokeGate);
  collectGate('startup', 'tenant_isolation_smoke_trend', input.tenantIsolationSmokeTrendGate);
  collectGate(
    'startup',
    'agents_tenant_isolation_smoke_trend',
    input.agentsTenantIsolationSmokeTrendGate,
  );
  collectGate('startup', 'auth_access_smoke', input.authAccessSmokeGate);
  collectGate('startup', 'auth_access_smoke_trend', input.authAccessSmokeTrendGate);
  collectGate('startup', 'settings_surface_smoke', input.settingsSurfaceSmokeGate);
  collectGate('startup', 'settings_surface_smoke_trend', input.settingsSurfaceSmokeTrendGate);
  collectGate('startup', 'admin_rbac_smoke', input.adminRbacSmokeGate);
  collectGate('startup', 'admin_rbac_smoke_trend', input.adminRbacSmokeTrendGate);
  collectGate('startup', 'admin_origin_smoke', input.adminOriginSmokeGate);
  collectGate('startup', 'admin_origin_smoke_trend', input.adminOriginSmokeTrendGate);
  collectGate('startup', 'billing_admin_smoke', input.billingAdminSmokeGate);
  collectGate('startup', 'billing_admin_smoke_trend', input.billingAdminSmokeTrendGate);
  collectGate('startup', 'data_encryption_smoke', input.dataEncryptionSmokeGate);
  collectGate('startup', 'data_encryption_smoke_trend', input.dataEncryptionSmokeTrendGate);

  collectGate('runtime', 'runtime', input.runtimeGate);
  collectGate('runtime', 'runtime_hotspot', input.runtimeHotspotGate);
  collectGate('runtime', 'runtime_trend', input.runtimeTrendGate);
  collectGate('runtime', 'agent_flow', input.agentFlowGate);
  collectGate('runtime', 'agent_flow_trend', input.agentFlowTrendGate);
  collectGate('runtime', 'vmops_sse_flow', input.vmOpsSseFlowGate);
  collectGate('runtime', 'vmops_sse_flow_trend', input.vmOpsSseFlowTrendGate);

  const startupGate =
    startupFailCodes.length > 0 ? 'fail' : startupWarnCodes.length > 0 ? 'warn' : 'pass';
  const runtimeGate =
    runtimeFailCodes.length > 0 ? 'fail' : runtimeWarnCodes.length > 0 ? 'warn' : 'pass';

  let mode = 'healthy';
  if (startupGate === 'fail' && runtimeGate === 'fail') mode = 'mixed_fail';
  else if (startupGate === 'fail') mode = 'startup_issue';
  else if (runtimeGate === 'fail') mode = 'runtime_degradation';
  else if (startupGate === 'warn' && runtimeGate === 'warn') mode = 'mixed_warn';
  else if (startupGate === 'warn') mode = 'startup_warning';
  else if (runtimeGate === 'warn') mode = 'runtime_warning';

  const reasonCodes = [];
  if (startupFailCodes.length > 0) reasonCodes.push('startup_fail_signals_present');
  else if (startupWarnCodes.length > 0) reasonCodes.push('startup_warn_signals_present');
  else reasonCodes.push('startup_signals_ok');
  if (runtimeFailCodes.length > 0) reasonCodes.push('runtime_fail_signals_present');
  else if (runtimeWarnCodes.length > 0) reasonCodes.push('runtime_warn_signals_present');
  else reasonCodes.push('runtime_signals_ok');

  return {
    mode,
    startupGate,
    runtimeGate,
    startupFailCodes,
    startupWarnCodes,
    runtimeFailCodes,
    runtimeWarnCodes,
    reasonCodes,
    summaryLine: [
      `startup_runtime_correlation=${mode}`,
      `startup_gate=${startupGate}`,
      `runtime_gate=${runtimeGate}`,
      `startup_fail=${startupFailCodes.join(',') || 'none'}`,
      `startup_warn=${startupWarnCodes.join(',') || 'none'}`,
      `runtime_fail=${runtimeFailCodes.join(',') || 'none'}`,
      `runtime_warn=${runtimeWarnCodes.join(',') || 'none'}`,
    ].join(' | '),
  };
}

function main() {
  fs.mkdirSync(auditsDir, { recursive: true });

  const stackReportRel = path.join('docs', 'audits', 'stack-up-latest.txt');
  const stackReport = readTextIfExists(stackReportRel);
  const stackKv = parseKeyValueLines(stackReport);

  const runtimeLatestRel = path.join(
    'docs',
    'audits',
    'production-hardening-runtime-metrics-latest.md',
  );
  const runtimeLatest = readTextIfExists(runtimeLatestRel);
  const runtimeRow = parseMarkdownTableRow(findLatestMarkdownTableRow(runtimeLatest));
  const runtimeRows = findMarkdownTableRows(runtimeLatest);

  const smokeLatestFile = latestMatchingFile(/^production-hardening-smoke-window-\d{4}-\d{2}\.md$/);
  const smokeLatest = smokeLatestFile ? fs.readFileSync(smokeLatestFile, 'utf8') : null;
  const smokeRow = parseMarkdownTableRow(findLatestMarkdownTableRow(smokeLatest));
  const smokeRows = findMarkdownTableRows(smokeLatest);

  const stackReportFiles = listMatchingFiles(/^stack-up-(?!latest).*\.txt$/i);
  const tenantIsolationSmokeAuditFiles = listMatchingFiles(
    /^tenant-isolation-smoke-(?!latest).*\.txt$/i,
  );
  const agentsTenantIsolationSmokeAuditFiles = listMatchingFiles(
    /^agents-tenant-isolation-smoke-(?!latest).*\.txt$/i,
  );
  const authAccessSmokeAuditFiles = listMatchingFiles(/^auth-access-smoke-(?!latest).*\.txt$/i);
  const settingsSurfaceSmokeAuditFiles = listMatchingFiles(
    /^settings-surface-smoke-(?!latest).*\.txt$/i,
  );
  const adminRbacSmokeAuditFiles = listMatchingFiles(/^admin-rbac-smoke-(?!latest).*\.txt$/i);
  const adminOriginSmokeAuditFiles = listMatchingFiles(/^admin-origin-smoke-(?!latest).*\.txt$/i);
  const billingAdminSmokeAuditFiles = listMatchingFiles(/^billing-admin-smoke-(?!latest).*\.txt$/i);
  const dataEncryptionSmokeAuditFiles = listMatchingFiles(
    /^data-encryption-smoke-(?!latest).*\.txt$/i,
  );

  const cryptoLatestTxtRel = path.join('docs', 'audits', 'crypto-rotation-latest.txt');
  const cryptoLatestTxt = readTextIfExists(cryptoLatestTxtRel);
  const cryptoKv = parseKeyValueLines(cryptoLatestTxt);
  const tenantIsolationSmokeAuditRel = path.join(
    'docs',
    'audits',
    'tenant-isolation-smoke-latest.txt',
  );
  const tenantIsolationSmokeAuditTxt = readTextIfExists(tenantIsolationSmokeAuditRel);
  const tenantIsolationSmokeAuditKv = parseKeyValueLines(tenantIsolationSmokeAuditTxt);
  const agentsTenantIsolationSmokeAuditRel = path.join(
    'docs',
    'audits',
    'agents-tenant-isolation-smoke-latest.txt',
  );
  const agentsTenantIsolationSmokeAuditTxt = readTextIfExists(agentsTenantIsolationSmokeAuditRel);
  const agentsTenantIsolationSmokeAuditKv = parseKeyValueLines(agentsTenantIsolationSmokeAuditTxt);
  const authAccessSmokeAuditRel = path.join('docs', 'audits', 'auth-access-smoke-latest.txt');
  const authAccessSmokeAuditTxt = readTextIfExists(authAccessSmokeAuditRel);
  const authAccessSmokeAuditKv = parseKeyValueLines(authAccessSmokeAuditTxt);
  const settingsSurfaceSmokeAuditRel = path.join(
    'docs',
    'audits',
    'settings-surface-smoke-latest.txt',
  );
  const settingsSurfaceSmokeAuditTxt = readTextIfExists(settingsSurfaceSmokeAuditRel);
  const settingsSurfaceSmokeAuditKv = parseKeyValueLines(settingsSurfaceSmokeAuditTxt);
  const adminRbacSmokeAuditRel = path.join('docs', 'audits', 'admin-rbac-smoke-latest.txt');
  const adminRbacSmokeAuditTxt = readTextIfExists(adminRbacSmokeAuditRel);
  const adminRbacSmokeAuditKv = parseKeyValueLines(adminRbacSmokeAuditTxt);
  const adminOriginSmokeAuditRel = path.join('docs', 'audits', 'admin-origin-smoke-latest.txt');
  const adminOriginSmokeAuditTxt = readTextIfExists(adminOriginSmokeAuditRel);
  const adminOriginSmokeAuditKv = parseKeyValueLines(adminOriginSmokeAuditTxt);
  const billingAdminSmokeAuditRel = path.join('docs', 'audits', 'billing-admin-smoke-latest.txt');
  const billingAdminSmokeAuditTxt = readTextIfExists(billingAdminSmokeAuditRel);
  const billingAdminSmokeAuditKv = parseKeyValueLines(billingAdminSmokeAuditTxt);
  const dataEncryptionSmokeAuditRel = path.join(
    'docs',
    'audits',
    'data-encryption-smoke-latest.txt',
  );
  const dataEncryptionSmokeAuditTxt = readTextIfExists(dataEncryptionSmokeAuditRel);
  const dataEncryptionSmokeAuditKv = parseKeyValueLines(dataEncryptionSmokeAuditTxt);

  const verdict = buildVerdict({
    stackReportPresent: Boolean(stackReport),
    stackStatus: stackKv.stack_status || '',
    uiHealth: parseBoolish(stackKv.ui_health),
    apiHealth: parseBoolish(stackKv.api_health),
    adminHealth: parseBoolish(stackKv.admin_health),
    runtimeRowPresent: runtimeRow.length > 0,
    runtimeStatus: runtimeRow[11] || '',
    smokeRowPresent: smokeRow.length > 0,
    smokeChecksStatus: smokeRow[4] || '',
    cryptoSourcePresent: Boolean(cryptoLatestTxt),
    cryptoStatus: cryptoKv.status || '',
  });
  const runtimeHotspot = buildRuntimeHotspotSummary(runtimeRow);
  const agentFlow = buildAgentFlowSummary(runtimeRow);
  const vmOpsSseFlow = buildVmOpsSseFlowSummary(runtimeRow);
  const agentFlowTrend = buildFlowTrendSummary({
    runtimeRows,
    flowName: 'agent_flow',
    buildRowSummary: buildAgentFlowSummary,
    envWindowSize: 'POST_START_AGENT_FLOW_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_AGENT_FLOW_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_AGENT_FLOW_TREND_WARN_ROWS',
  });
  const vmOpsSseFlowTrend = buildFlowTrendSummary({
    runtimeRows,
    flowName: 'vmops_sse_flow',
    buildRowSummary: buildVmOpsSseFlowSummary,
    envWindowSize: 'POST_START_VMOPS_SSE_FLOW_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_VMOPS_SSE_FLOW_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_VMOPS_SSE_FLOW_TREND_WARN_ROWS',
  });
  const runtimeTrend = buildRuntimeTrendSummary(
    runtimeRows,
    runtimeHotspot.runtimeHotspotThresholds,
  );
  const smokeTrend = buildSmokeTrendSummary(smokeRows);
  const stackTrend = buildStackTrendSummary(stackReportFiles);
  const tenantIsolationSmokeTrend = buildDirectSmokeAuditTrendSummary({
    prefix: 'tenant_isolation_smoke',
    auditFiles: tenantIsolationSmokeAuditFiles,
    envWindowSize: 'POST_START_TENANT_ISOLATION_SMOKE_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_TENANT_ISOLATION_SMOKE_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_TENANT_ISOLATION_SMOKE_TREND_WARN_ROWS',
  });
  const agentsTenantIsolationSmokeTrend = buildDirectSmokeAuditTrendSummary({
    prefix: 'agents_tenant_isolation_smoke',
    auditFiles: agentsTenantIsolationSmokeAuditFiles,
    envWindowSize: 'POST_START_AGENTS_TENANT_ISOLATION_SMOKE_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_AGENTS_TENANT_ISOLATION_SMOKE_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_AGENTS_TENANT_ISOLATION_SMOKE_TREND_WARN_ROWS',
  });
  const tenantIsolationSmoke =
    buildTenantIsolationSmokeSignalsFromDirectAudits(
      tenantIsolationSmokeAuditKv,
      agentsTenantIsolationSmokeAuditKv,
    ) || buildTenantIsolationSmokeSignals(smokeRow);
  const authAccessSmoke = buildSingleDirectSmokeAuditSignal(
    'auth_access_smoke',
    authAccessSmokeAuditKv,
  );
  const settingsSurfaceSmoke = buildSingleDirectSmokeAuditSignal(
    'settings_surface_smoke',
    settingsSurfaceSmokeAuditKv,
  );
  const authAccessSmokeTrend = buildDirectSmokeAuditTrendSummary({
    prefix: 'auth_access_smoke',
    auditFiles: authAccessSmokeAuditFiles,
    envWindowSize: 'POST_START_AUTH_ACCESS_SMOKE_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_AUTH_ACCESS_SMOKE_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_AUTH_ACCESS_SMOKE_TREND_WARN_ROWS',
  });
  const settingsSurfaceSmokeTrend = buildDirectSmokeAuditTrendSummary({
    prefix: 'settings_surface_smoke',
    auditFiles: settingsSurfaceSmokeAuditFiles,
    envWindowSize: 'POST_START_SETTINGS_SURFACE_SMOKE_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_SETTINGS_SURFACE_SMOKE_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_SETTINGS_SURFACE_SMOKE_TREND_WARN_ROWS',
  });
  const adminRbacSmoke = buildSingleDirectSmokeAuditSignal(
    'admin_rbac_smoke',
    adminRbacSmokeAuditKv,
  );
  const adminOriginSmoke = buildSingleDirectSmokeAuditSignal(
    'admin_origin_smoke',
    adminOriginSmokeAuditKv,
  );
  const adminRbacSmokeTrend = buildDirectSmokeAuditTrendSummary({
    prefix: 'admin_rbac_smoke',
    auditFiles: adminRbacSmokeAuditFiles,
    envWindowSize: 'POST_START_ADMIN_RBAC_SMOKE_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_ADMIN_RBAC_SMOKE_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_ADMIN_RBAC_SMOKE_TREND_WARN_ROWS',
  });
  const adminOriginSmokeTrend = buildDirectSmokeAuditTrendSummary({
    prefix: 'admin_origin_smoke',
    auditFiles: adminOriginSmokeAuditFiles,
    envWindowSize: 'POST_START_ADMIN_ORIGIN_SMOKE_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_ADMIN_ORIGIN_SMOKE_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_ADMIN_ORIGIN_SMOKE_TREND_WARN_ROWS',
  });
  const billingAdminSmoke = buildSingleDirectSmokeAuditSignal(
    'billing_admin_smoke',
    billingAdminSmokeAuditKv,
  );
  const dataEncryptionSmoke = buildSingleDirectSmokeAuditSignal(
    'data_encryption_smoke',
    dataEncryptionSmokeAuditKv,
  );
  const billingAdminSmokeTrend = buildDirectSmokeAuditTrendSummary({
    prefix: 'billing_admin_smoke',
    auditFiles: billingAdminSmokeAuditFiles,
    envWindowSize: 'POST_START_BILLING_ADMIN_SMOKE_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_BILLING_ADMIN_SMOKE_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_BILLING_ADMIN_SMOKE_TREND_WARN_ROWS',
  });
  const dataEncryptionSmokeTrend = buildDirectSmokeAuditTrendSummary({
    prefix: 'data_encryption_smoke',
    auditFiles: dataEncryptionSmokeAuditFiles,
    envWindowSize: 'POST_START_DATA_ENCRYPTION_SMOKE_TREND_WINDOW_SIZE',
    envFailRows: 'POST_START_DATA_ENCRYPTION_SMOKE_TREND_FAIL_ROWS',
    envWarnRows: 'POST_START_DATA_ENCRYPTION_SMOKE_TREND_WARN_ROWS',
  });
  const postStartSeverity = computePostStartSeverity({
    diagnosticsVerdict: verdict.verdict,
    readinessGate: verdict.readinessGate,
    runtimeGate: verdict.runtimeGate,
    runtimeHotspotGate: runtimeHotspot.runtimeHotspotGate,
    runtimeTrendGate: runtimeTrend.gate,
    agentFlowGate: agentFlow.gate,
    vmOpsSseFlowGate: vmOpsSseFlow.gate,
    agentFlowTrendGate: agentFlowTrend.gate,
    vmOpsSseFlowTrendGate: vmOpsSseFlowTrend.gate,
    tenantIsolationSmokeGate: tenantIsolationSmoke.tenantGate,
    agentsTenantIsolationSmokeGate: tenantIsolationSmoke.agentsGate,
    tenantIsolationSmokeTrendGate: tenantIsolationSmokeTrend.gate,
    agentsTenantIsolationSmokeTrendGate: agentsTenantIsolationSmokeTrend.gate,
    authAccessSmokeGate: authAccessSmoke.gate,
    settingsSurfaceSmokeGate: settingsSurfaceSmoke.gate,
    adminRbacSmokeGate: adminRbacSmoke.gate,
    adminOriginSmokeGate: adminOriginSmoke.gate,
    billingAdminSmokeGate: billingAdminSmoke.gate,
    dataEncryptionSmokeGate: dataEncryptionSmoke.gate,
    authAccessSmokeTrendGate: authAccessSmokeTrend.gate,
    settingsSurfaceSmokeTrendGate: settingsSurfaceSmokeTrend.gate,
    adminRbacSmokeTrendGate: adminRbacSmokeTrend.gate,
    adminOriginSmokeTrendGate: adminOriginSmokeTrend.gate,
    billingAdminSmokeTrendGate: billingAdminSmokeTrend.gate,
    dataEncryptionSmokeTrendGate: dataEncryptionSmokeTrend.gate,
    stackTrendGate: stackTrend.gate,
    smokeTrendGate: smokeTrend.gate,
  });
  const startupRuntimeCorrelation = computeStartupRuntimeCorrelation({
    readinessGate: verdict.readinessGate,
    stackTrendGate: stackTrend.gate,
    smokeTrendGate: smokeTrend.gate,
    tenantIsolationSmokeGate: tenantIsolationSmoke.tenantGate,
    agentsTenantIsolationSmokeGate: tenantIsolationSmoke.agentsGate,
    tenantIsolationSmokeTrendGate: tenantIsolationSmokeTrend.gate,
    agentsTenantIsolationSmokeTrendGate: agentsTenantIsolationSmokeTrend.gate,
    authAccessSmokeGate: authAccessSmoke.gate,
    authAccessSmokeTrendGate: authAccessSmokeTrend.gate,
    settingsSurfaceSmokeGate: settingsSurfaceSmoke.gate,
    settingsSurfaceSmokeTrendGate: settingsSurfaceSmokeTrend.gate,
    adminRbacSmokeGate: adminRbacSmoke.gate,
    adminRbacSmokeTrendGate: adminRbacSmokeTrend.gate,
    adminOriginSmokeGate: adminOriginSmoke.gate,
    adminOriginSmokeTrendGate: adminOriginSmokeTrend.gate,
    billingAdminSmokeGate: billingAdminSmoke.gate,
    billingAdminSmokeTrendGate: billingAdminSmokeTrend.gate,
    dataEncryptionSmokeGate: dataEncryptionSmoke.gate,
    dataEncryptionSmokeTrendGate: dataEncryptionSmokeTrend.gate,
    runtimeGate: verdict.runtimeGate,
    runtimeHotspotGate: runtimeHotspot.runtimeHotspotGate,
    runtimeTrendGate: runtimeTrend.gate,
    agentFlowGate: agentFlow.gate,
    agentFlowTrendGate: agentFlowTrend.gate,
    vmOpsSseFlowGate: vmOpsSseFlow.gate,
    vmOpsSseFlowTrendGate: vmOpsSseFlowTrend.gate,
  });
  const postStartSummaryLine = [
    `severity=${postStartSeverity}`,
    `readiness=${verdict.readinessGate}`,
    `runtime=${verdict.runtimeGate}`,
    `runtime_hotspot=${runtimeHotspot.runtimeHotspotGate}`,
    `runtime_trend=${runtimeTrend.gate}`,
    `agent_flow=${agentFlow.gate}`,
    `agent_flow_trend=${agentFlowTrend.gate}`,
    `vmops_sse_flow=${vmOpsSseFlow.gate}`,
    `vmops_sse_flow_trend=${vmOpsSseFlowTrend.gate}`,
    `stack_trend=${stackTrend.gate}`,
    `smoke_trend=${smokeTrend.gate}`,
    `tenant_isolation_smoke=${tenantIsolationSmoke.tenantGate}`,
    `agents_tenant_isolation_smoke=${tenantIsolationSmoke.agentsGate}`,
    `tenant_isolation_smoke_trend=${tenantIsolationSmokeTrend.gate}`,
    `agents_tenant_isolation_smoke_trend=${agentsTenantIsolationSmokeTrend.gate}`,
    `auth_access_smoke=${authAccessSmoke.gate}`,
    `auth_access_smoke_trend=${authAccessSmokeTrend.gate}`,
    `settings_surface_smoke=${settingsSurfaceSmoke.gate}`,
    `settings_surface_smoke_trend=${settingsSurfaceSmokeTrend.gate}`,
    `admin_rbac_smoke=${adminRbacSmoke.gate}`,
    `admin_rbac_smoke_trend=${adminRbacSmokeTrend.gate}`,
    `admin_origin_smoke=${adminOriginSmoke.gate}`,
    `admin_origin_smoke_trend=${adminOriginSmokeTrend.gate}`,
    `billing_admin_smoke=${billingAdminSmoke.gate}`,
    `billing_admin_smoke_trend=${billingAdminSmokeTrend.gate}`,
    `data_encryption_smoke=${dataEncryptionSmoke.gate}`,
    `data_encryption_smoke_trend=${dataEncryptionSmokeTrend.gate}`,
    `startup_runtime_correlation=${startupRuntimeCorrelation.mode}`,
    `diagnostics=${String(verdict.verdict || '').toLowerCase()}`,
    `reason_codes=${verdict.reasonCodes.join(',') || 'none'}`,
    `hotspot_fail_flags=${runtimeHotspot.runtimeHotspotFailFlags.join(',') || 'none'}`,
  ].join(' | ');

  const lines = [
    `timestamp=${now.toISOString()}`,
    `post_start_severity=${postStartSeverity}`,
    `post_start_summary_line=${postStartSummaryLine}`,
    `startup_runtime_correlation_mode=${startupRuntimeCorrelation.mode}`,
    `startup_runtime_correlation_startup_gate=${startupRuntimeCorrelation.startupGate}`,
    `startup_runtime_correlation_runtime_gate=${startupRuntimeCorrelation.runtimeGate}`,
    `startup_runtime_correlation_reason_codes=${startupRuntimeCorrelation.reasonCodes.join(',')}`,
    `startup_runtime_correlation_startup_fail_codes=${startupRuntimeCorrelation.startupFailCodes.join(',')}`,
    `startup_runtime_correlation_startup_warn_codes=${startupRuntimeCorrelation.startupWarnCodes.join(',')}`,
    `startup_runtime_correlation_runtime_fail_codes=${startupRuntimeCorrelation.runtimeFailCodes.join(',')}`,
    `startup_runtime_correlation_runtime_warn_codes=${startupRuntimeCorrelation.runtimeWarnCodes.join(',')}`,
    `startup_runtime_correlation_summary_line=${startupRuntimeCorrelation.summaryLine}`,
    `diagnostics_verdict=${verdict.verdict}`,
    `diagnostics_reason=${verdict.reason}`,
    `diagnostics_reason_codes=${verdict.reasonCodes.join(',')}`,
    `diagnostics_reason_levels=${verdict.reasonLevels.join(',')}`,
    `diagnostics_reason_level_map=${verdict.reasonLevelMap.join(',')}`,
    `readiness_gate=${verdict.readinessGate}`,
    `readiness_reason_codes=${verdict.readinessReasonCodes.join(',')}`,
    `runtime_gate=${verdict.runtimeGate}`,
    `runtime_reason_codes=${verdict.runtimeReasonCodes.join(',')}`,
    `runtime_hotspot_gate=${runtimeHotspot.runtimeHotspotGate}`,
    `runtime_hotspot_flags=${runtimeHotspot.runtimeHotspotFlags.join(',')}`,
    `runtime_hotspot_fail_flags=${runtimeHotspot.runtimeHotspotFailFlags.join(',')}`,
    `runtime_trend_gate=${runtimeTrend.gate}`,
    `runtime_trend_reason_codes=${runtimeTrend.reasonCodes.join(',')}`,
    `runtime_trend_window_size=${runtimeTrend.windowSize}`,
    `runtime_trend_rows_in_window=${runtimeTrend.rowsInWindow}`,
    `runtime_trend_failed_snapshot_rows=${runtimeTrend.failedSnapshotRows}`,
    `runtime_trend_hotspot_fail_rows=${runtimeTrend.hotspotFailRows}`,
    `runtime_trend_hotspot_warn_rows=${runtimeTrend.hotspotWarnRows}`,
    `runtime_trend_max_http_5xx=${runtimeTrend.max.http5xx}`,
    `runtime_trend_max_sse_gap=${runtimeTrend.max.sseGap}`,
    `runtime_trend_max_ws_gap=${runtimeTrend.max.wsGap}`,
    `runtime_trend_max_ws_rejected=${runtimeTrend.max.wsRejected}`,
    `runtime_trend_summary_line=${runtimeTrend.summaryLine}`,
    `agent_flow_gate=${agentFlow.gate}`,
    `agent_flow_reason_codes=${agentFlow.reasonCodes.join(',')}`,
    `agent_flow_summary_line=${agentFlow.summaryLine}`,
    `agent_flow_trend_gate=${agentFlowTrend.gate}`,
    `agent_flow_trend_reason_codes=${agentFlowTrend.reasonCodes.join(',')}`,
    `agent_flow_trend_summary_line=${agentFlowTrend.summaryLine}`,
    `vmops_sse_flow_gate=${vmOpsSseFlow.gate}`,
    `vmops_sse_flow_reason_codes=${vmOpsSseFlow.reasonCodes.join(',')}`,
    `vmops_sse_flow_summary_line=${vmOpsSseFlow.summaryLine}`,
    `vmops_sse_flow_trend_gate=${vmOpsSseFlowTrend.gate}`,
    `vmops_sse_flow_trend_reason_codes=${vmOpsSseFlowTrend.reasonCodes.join(',')}`,
    `vmops_sse_flow_trend_summary_line=${vmOpsSseFlowTrend.summaryLine}`,
    `stack_trend_gate=${stackTrend.gate}`,
    `stack_trend_reason_codes=${stackTrend.reasonCodes.join(',')}`,
    `stack_trend_summary_line=${stackTrend.summaryLine}`,
    `smoke_trend_gate=${smokeTrend.gate}`,
    `smoke_trend_reason_codes=${smokeTrend.reasonCodes.join(',')}`,
    `smoke_trend_info_codes=${(smokeTrend.infoCodes || []).join(',')}`,
    `smoke_trend_summary_line=${smokeTrend.summaryLine}`,
    `tenant_isolation_smoke_gate=${tenantIsolationSmoke.tenantGate}`,
    `tenant_isolation_smoke_reason_codes=${tenantIsolationSmoke.tenantReasonCodes.join(',')}`,
    `agents_tenant_isolation_smoke_gate=${tenantIsolationSmoke.agentsGate}`,
    `agents_tenant_isolation_smoke_reason_codes=${tenantIsolationSmoke.agentsReasonCodes.join(',')}`,
    `tenant_isolation_smoke_summary_line=${tenantIsolationSmoke.summaryLine}`,
    `tenant_isolation_smoke_trend_gate=${tenantIsolationSmokeTrend.gate}`,
    `tenant_isolation_smoke_trend_reason_codes=${tenantIsolationSmokeTrend.reasonCodes.join(',')}`,
    `tenant_isolation_smoke_trend_info_codes=${(tenantIsolationSmokeTrend.infoCodes || []).join(',')}`,
    `tenant_isolation_smoke_trend_summary_line=${tenantIsolationSmokeTrend.summaryLine}`,
    `agents_tenant_isolation_smoke_trend_gate=${agentsTenantIsolationSmokeTrend.gate}`,
    `agents_tenant_isolation_smoke_trend_reason_codes=${agentsTenantIsolationSmokeTrend.reasonCodes.join(',')}`,
    `agents_tenant_isolation_smoke_trend_info_codes=${(agentsTenantIsolationSmokeTrend.infoCodes || []).join(',')}`,
    `agents_tenant_isolation_smoke_trend_summary_line=${agentsTenantIsolationSmokeTrend.summaryLine}`,
    `auth_access_smoke_gate=${authAccessSmoke.gate}`,
    `auth_access_smoke_reason_codes=${authAccessSmoke.reasonCodes.join(',')}`,
    `auth_access_smoke_summary_line=${authAccessSmoke.summaryLine}`,
    `auth_access_smoke_trend_gate=${authAccessSmokeTrend.gate}`,
    `auth_access_smoke_trend_reason_codes=${authAccessSmokeTrend.reasonCodes.join(',')}`,
    `auth_access_smoke_trend_info_codes=${(authAccessSmokeTrend.infoCodes || []).join(',')}`,
    `auth_access_smoke_trend_summary_line=${authAccessSmokeTrend.summaryLine}`,
    `settings_surface_smoke_gate=${settingsSurfaceSmoke.gate}`,
    `settings_surface_smoke_reason_codes=${settingsSurfaceSmoke.reasonCodes.join(',')}`,
    `settings_surface_smoke_summary_line=${settingsSurfaceSmoke.summaryLine}`,
    `settings_surface_smoke_trend_gate=${settingsSurfaceSmokeTrend.gate}`,
    `settings_surface_smoke_trend_reason_codes=${settingsSurfaceSmokeTrend.reasonCodes.join(',')}`,
    `settings_surface_smoke_trend_info_codes=${(settingsSurfaceSmokeTrend.infoCodes || []).join(',')}`,
    `settings_surface_smoke_trend_summary_line=${settingsSurfaceSmokeTrend.summaryLine}`,
    `admin_rbac_smoke_gate=${adminRbacSmoke.gate}`,
    `admin_rbac_smoke_reason_codes=${adminRbacSmoke.reasonCodes.join(',')}`,
    `admin_rbac_smoke_summary_line=${adminRbacSmoke.summaryLine}`,
    `admin_rbac_smoke_trend_gate=${adminRbacSmokeTrend.gate}`,
    `admin_rbac_smoke_trend_reason_codes=${adminRbacSmokeTrend.reasonCodes.join(',')}`,
    `admin_rbac_smoke_trend_info_codes=${(adminRbacSmokeTrend.infoCodes || []).join(',')}`,
    `admin_rbac_smoke_trend_summary_line=${adminRbacSmokeTrend.summaryLine}`,
    `admin_origin_smoke_gate=${adminOriginSmoke.gate}`,
    `admin_origin_smoke_reason_codes=${adminOriginSmoke.reasonCodes.join(',')}`,
    `admin_origin_smoke_summary_line=${adminOriginSmoke.summaryLine}`,
    `admin_origin_smoke_trend_gate=${adminOriginSmokeTrend.gate}`,
    `admin_origin_smoke_trend_reason_codes=${adminOriginSmokeTrend.reasonCodes.join(',')}`,
    `admin_origin_smoke_trend_info_codes=${(adminOriginSmokeTrend.infoCodes || []).join(',')}`,
    `admin_origin_smoke_trend_summary_line=${adminOriginSmokeTrend.summaryLine}`,
    `billing_admin_smoke_gate=${billingAdminSmoke.gate}`,
    `billing_admin_smoke_reason_codes=${billingAdminSmoke.reasonCodes.join(',')}`,
    `billing_admin_smoke_summary_line=${billingAdminSmoke.summaryLine}`,
    `billing_admin_smoke_trend_gate=${billingAdminSmokeTrend.gate}`,
    `billing_admin_smoke_trend_reason_codes=${billingAdminSmokeTrend.reasonCodes.join(',')}`,
    `billing_admin_smoke_trend_info_codes=${(billingAdminSmokeTrend.infoCodes || []).join(',')}`,
    `billing_admin_smoke_trend_summary_line=${billingAdminSmokeTrend.summaryLine}`,
    `data_encryption_smoke_gate=${dataEncryptionSmoke.gate}`,
    `data_encryption_smoke_reason_codes=${dataEncryptionSmoke.reasonCodes.join(',')}`,
    `data_encryption_smoke_summary_line=${dataEncryptionSmoke.summaryLine}`,
    `data_encryption_smoke_trend_gate=${dataEncryptionSmokeTrend.gate}`,
    `data_encryption_smoke_trend_reason_codes=${dataEncryptionSmokeTrend.reasonCodes.join(',')}`,
    `data_encryption_smoke_trend_info_codes=${(dataEncryptionSmokeTrend.infoCodes || []).join(',')}`,
    `data_encryption_smoke_trend_summary_line=${dataEncryptionSmokeTrend.summaryLine}`,
    `diagnostics_missing_sources=${verdict.hasMissingSources}`,
    `source.stack_up=${stackReport ? stackReportRel : ''}`,
    `source.runtime_metrics=${runtimeLatest ? runtimeLatestRel : ''}`,
    `source.smoke_window=${relativeOrEmpty(smokeLatestFile)}`,
    `source.crypto_rotation=${cryptoLatestTxt ? cryptoLatestTxtRel : ''}`,
    `source.tenant_isolation_smoke=${
      tenantIsolationSmokeAuditTxt ? tenantIsolationSmokeAuditRel : ''
    }`,
    `source.agents_tenant_isolation_smoke=${
      agentsTenantIsolationSmokeAuditTxt ? agentsTenantIsolationSmokeAuditRel : ''
    }`,
    `source.auth_access_smoke=${authAccessSmokeAuditTxt ? authAccessSmokeAuditRel : ''}`,
    `source.settings_surface_smoke=${
      settingsSurfaceSmokeAuditTxt ? settingsSurfaceSmokeAuditRel : ''
    }`,
    `source.admin_rbac_smoke=${adminRbacSmokeAuditTxt ? adminRbacSmokeAuditRel : ''}`,
    `source.admin_origin_smoke=${adminOriginSmokeAuditTxt ? adminOriginSmokeAuditRel : ''}`,
    `source.billing_admin_smoke=${billingAdminSmokeAuditTxt ? billingAdminSmokeAuditRel : ''}`,
    `source.data_encryption_smoke=${
      dataEncryptionSmokeAuditTxt ? dataEncryptionSmokeAuditRel : ''
    }`,
    '',
    '[stack_up]',
    `stack_status=${stackKv.stack_status || ''}`,
    `ui_health=${stackKv.ui_health || ''}`,
    `api_health=${stackKv.api_health || ''}`,
    `admin_health=${stackKv.admin_health || ''}`,
    '',
    '[startup_runtime_correlation]',
    `mode=${startupRuntimeCorrelation.mode}`,
    `startup_gate=${startupRuntimeCorrelation.startupGate}`,
    `runtime_gate=${startupRuntimeCorrelation.runtimeGate}`,
    `reason_codes=${startupRuntimeCorrelation.reasonCodes.join(',')}`,
    `startup_fail_codes=${startupRuntimeCorrelation.startupFailCodes.join(',')}`,
    `startup_warn_codes=${startupRuntimeCorrelation.startupWarnCodes.join(',')}`,
    `runtime_fail_codes=${startupRuntimeCorrelation.runtimeFailCodes.join(',')}`,
    `runtime_warn_codes=${startupRuntimeCorrelation.runtimeWarnCodes.join(',')}`,
    `summary_line=${startupRuntimeCorrelation.summaryLine}`,
    '',
    '[runtime_metrics_latest_row]',
    `row_present=${runtimeRow.length > 0}`,
    `status=${runtimeRow[11] || ''}`,
    `details=${runtimeRow[12] || ''}`,
    `http_401=${runtimeRow[1] || ''}`,
    `http_403=${runtimeRow[2] || ''}`,
    `http_5xx=${runtimeRow[3] || ''}`,
    `sse_gap=${runtimeRow[6] || ''}`,
    `ws_gap=${runtimeRow[9] || ''}`,
    `ws_rejected=${runtimeRow[10] || ''}`,
    `hotspot_http_5xx=${runtimeHotspot.runtimeHotspotCounts.http5xx}`,
    `hotspot_sse_gap=${runtimeHotspot.runtimeHotspotCounts.sseGap}`,
    `hotspot_ws_gap=${runtimeHotspot.runtimeHotspotCounts.wsGap}`,
    `hotspot_ws_rejected=${runtimeHotspot.runtimeHotspotCounts.wsRejected}`,
    `hotspot_warn_threshold_http_5xx=${runtimeHotspot.runtimeHotspotThresholds.warn.http5xx}`,
    `hotspot_warn_threshold_sse_gap=${runtimeHotspot.runtimeHotspotThresholds.warn.sseGap}`,
    `hotspot_warn_threshold_ws_gap=${runtimeHotspot.runtimeHotspotThresholds.warn.wsGap}`,
    `hotspot_warn_threshold_ws_rejected=${runtimeHotspot.runtimeHotspotThresholds.warn.wsRejected}`,
    `hotspot_fail_threshold_http_5xx=${runtimeHotspot.runtimeHotspotThresholds.fail.http5xx}`,
    `hotspot_fail_threshold_sse_gap=${runtimeHotspot.runtimeHotspotThresholds.fail.sseGap}`,
    `hotspot_fail_threshold_ws_gap=${runtimeHotspot.runtimeHotspotThresholds.fail.wsGap}`,
    `hotspot_fail_threshold_ws_rejected=${runtimeHotspot.runtimeHotspotThresholds.fail.wsRejected}`,
    '',
    '[agent_flow]',
    `gate=${agentFlow.gate}`,
    `reason_codes=${agentFlow.reasonCodes.join(',')}`,
    `assigned=${agentFlow.counts.assigned ?? ''}`,
    `empty=${agentFlow.counts.empty ?? ''}`,
    `ack=${agentFlow.counts.ack ?? ''}`,
    `result=${agentFlow.counts.result ?? ''}`,
    `ws_opened=${agentFlow.counts.wsOpened ?? ''}`,
    `ws_closed=${agentFlow.counts.wsClosed ?? ''}`,
    `ws_rejected=${agentFlow.counts.wsRejected ?? ''}`,
    `summary_line=${agentFlow.summaryLine}`,
    '',
    '[vmops_sse_flow]',
    `gate=${vmOpsSseFlow.gate}`,
    `reason_codes=${vmOpsSseFlow.reasonCodes.join(',')}`,
    `live=${vmOpsSseFlow.counts.live ?? ''}`,
    `replay=${vmOpsSseFlow.counts.replay ?? ''}`,
    `filtered=${vmOpsSseFlow.counts.filtered ?? ''}`,
    `sse_opened=${vmOpsSseFlow.counts.sseOpened ?? ''}`,
    `sse_closed=${vmOpsSseFlow.counts.sseClosed ?? ''}`,
    `summary_line=${vmOpsSseFlow.summaryLine}`,
    '',
    '[agent_flow_trend]',
    `gate=${agentFlowTrend.gate}`,
    `reason_codes=${agentFlowTrend.reasonCodes.join(',')}`,
    `window_size=${agentFlowTrend.windowSize}`,
    `rows_in_window=${agentFlowTrend.rowsInWindow}`,
    `warn_rows=${agentFlowTrend.warnRows}`,
    `pass_rows=${agentFlowTrend.passRows}`,
    `unknown_rows=${agentFlowTrend.unknownRows}`,
    `summary_line=${agentFlowTrend.summaryLine}`,
    '',
    '[vmops_sse_flow_trend]',
    `gate=${vmOpsSseFlowTrend.gate}`,
    `reason_codes=${vmOpsSseFlowTrend.reasonCodes.join(',')}`,
    `window_size=${vmOpsSseFlowTrend.windowSize}`,
    `rows_in_window=${vmOpsSseFlowTrend.rowsInWindow}`,
    `warn_rows=${vmOpsSseFlowTrend.warnRows}`,
    `pass_rows=${vmOpsSseFlowTrend.passRows}`,
    `unknown_rows=${vmOpsSseFlowTrend.unknownRows}`,
    `summary_line=${vmOpsSseFlowTrend.summaryLine}`,
    '',
    '[runtime_metrics_trend]',
    `gate=${runtimeTrend.gate}`,
    `reason_codes=${runtimeTrend.reasonCodes.join(',')}`,
    `window_size=${runtimeTrend.windowSize}`,
    `rows_in_window=${runtimeTrend.rowsInWindow}`,
    `failed_snapshot_rows=${runtimeTrend.failedSnapshotRows}`,
    `hotspot_fail_rows=${runtimeTrend.hotspotFailRows}`,
    `hotspot_warn_rows=${runtimeTrend.hotspotWarnRows}`,
    `max_http_5xx=${runtimeTrend.max.http5xx}`,
    `max_sse_gap=${runtimeTrend.max.sseGap}`,
    `max_ws_gap=${runtimeTrend.max.wsGap}`,
    `max_ws_rejected=${runtimeTrend.max.wsRejected}`,
    `summary_line=${runtimeTrend.summaryLine}`,
    '',
    '[smoke_window_latest_row]',
    `row_present=${smokeRow.length > 0}`,
    `checks_status=${smokeRow[4] || ''}`,
    `checks_details=${smokeRow[5] || ''}`,
    '',
    '[smoke_trend]',
    `gate=${smokeTrend.gate}`,
    `reason_codes=${smokeTrend.reasonCodes.join(',')}`,
    `info_codes=${(smokeTrend.infoCodes || []).join(',')}`,
    `window_size=${smokeTrend.windowSize}`,
    `rows_in_window=${smokeTrend.rowsInWindow}`,
    `fail_rows=${smokeTrend.failRows}`,
    `pass_rows=${smokeTrend.passRows}`,
    `not_run_rows=${smokeTrend.notRunRows}`,
    `summary_line=${smokeTrend.summaryLine}`,
    '',
    '[tenant_isolation_smoke]',
    `tenant_gate=${tenantIsolationSmoke.tenantGate}`,
    `tenant_reason_codes=${tenantIsolationSmoke.tenantReasonCodes.join(',')}`,
    `agents_gate=${tenantIsolationSmoke.agentsGate}`,
    `agents_reason_codes=${tenantIsolationSmoke.agentsReasonCodes.join(',')}`,
    `summary_line=${tenantIsolationSmoke.summaryLine}`,
    '',
    '[tenant_isolation_smoke_trend]',
    `gate=${tenantIsolationSmokeTrend.gate}`,
    `reason_codes=${tenantIsolationSmokeTrend.reasonCodes.join(',')}`,
    `info_codes=${(tenantIsolationSmokeTrend.infoCodes || []).join(',')}`,
    `window_size=${tenantIsolationSmokeTrend.windowSize}`,
    `rows_in_window=${tenantIsolationSmokeTrend.rowsInWindow}`,
    `fail_rows=${tenantIsolationSmokeTrend.failRows}`,
    `pass_rows=${tenantIsolationSmokeTrend.passRows}`,
    `skipped_rows=${tenantIsolationSmokeTrend.skippedRows}`,
    `unknown_rows=${tenantIsolationSmokeTrend.unknownRows}`,
    `summary_line=${tenantIsolationSmokeTrend.summaryLine}`,
    '',
    '[agents_tenant_isolation_smoke_trend]',
    `gate=${agentsTenantIsolationSmokeTrend.gate}`,
    `reason_codes=${agentsTenantIsolationSmokeTrend.reasonCodes.join(',')}`,
    `info_codes=${(agentsTenantIsolationSmokeTrend.infoCodes || []).join(',')}`,
    `window_size=${agentsTenantIsolationSmokeTrend.windowSize}`,
    `rows_in_window=${agentsTenantIsolationSmokeTrend.rowsInWindow}`,
    `fail_rows=${agentsTenantIsolationSmokeTrend.failRows}`,
    `pass_rows=${agentsTenantIsolationSmokeTrend.passRows}`,
    `skipped_rows=${agentsTenantIsolationSmokeTrend.skippedRows}`,
    `unknown_rows=${agentsTenantIsolationSmokeTrend.unknownRows}`,
    `summary_line=${agentsTenantIsolationSmokeTrend.summaryLine}`,
    '',
    '[auth_access_smoke]',
    `gate=${authAccessSmoke.gate}`,
    `reason_codes=${authAccessSmoke.reasonCodes.join(',')}`,
    `summary_line=${authAccessSmoke.summaryLine}`,
    '',
    '[auth_access_smoke_trend]',
    `gate=${authAccessSmokeTrend.gate}`,
    `reason_codes=${authAccessSmokeTrend.reasonCodes.join(',')}`,
    `info_codes=${(authAccessSmokeTrend.infoCodes || []).join(',')}`,
    `window_size=${authAccessSmokeTrend.windowSize}`,
    `rows_in_window=${authAccessSmokeTrend.rowsInWindow}`,
    `fail_rows=${authAccessSmokeTrend.failRows}`,
    `pass_rows=${authAccessSmokeTrend.passRows}`,
    `skipped_rows=${authAccessSmokeTrend.skippedRows}`,
    `unknown_rows=${authAccessSmokeTrend.unknownRows}`,
    `summary_line=${authAccessSmokeTrend.summaryLine}`,
    '',
    '[settings_surface_smoke]',
    `gate=${settingsSurfaceSmoke.gate}`,
    `reason_codes=${settingsSurfaceSmoke.reasonCodes.join(',')}`,
    `summary_line=${settingsSurfaceSmoke.summaryLine}`,
    '',
    '[settings_surface_smoke_trend]',
    `gate=${settingsSurfaceSmokeTrend.gate}`,
    `reason_codes=${settingsSurfaceSmokeTrend.reasonCodes.join(',')}`,
    `info_codes=${(settingsSurfaceSmokeTrend.infoCodes || []).join(',')}`,
    `window_size=${settingsSurfaceSmokeTrend.windowSize}`,
    `rows_in_window=${settingsSurfaceSmokeTrend.rowsInWindow}`,
    `fail_rows=${settingsSurfaceSmokeTrend.failRows}`,
    `pass_rows=${settingsSurfaceSmokeTrend.passRows}`,
    `skipped_rows=${settingsSurfaceSmokeTrend.skippedRows}`,
    `unknown_rows=${settingsSurfaceSmokeTrend.unknownRows}`,
    `summary_line=${settingsSurfaceSmokeTrend.summaryLine}`,
    '',
    '[admin_rbac_smoke]',
    `gate=${adminRbacSmoke.gate}`,
    `reason_codes=${adminRbacSmoke.reasonCodes.join(',')}`,
    `summary_line=${adminRbacSmoke.summaryLine}`,
    '',
    '[admin_rbac_smoke_trend]',
    `gate=${adminRbacSmokeTrend.gate}`,
    `reason_codes=${adminRbacSmokeTrend.reasonCodes.join(',')}`,
    `info_codes=${(adminRbacSmokeTrend.infoCodes || []).join(',')}`,
    `window_size=${adminRbacSmokeTrend.windowSize}`,
    `rows_in_window=${adminRbacSmokeTrend.rowsInWindow}`,
    `fail_rows=${adminRbacSmokeTrend.failRows}`,
    `pass_rows=${adminRbacSmokeTrend.passRows}`,
    `skipped_rows=${adminRbacSmokeTrend.skippedRows}`,
    `unknown_rows=${adminRbacSmokeTrend.unknownRows}`,
    `summary_line=${adminRbacSmokeTrend.summaryLine}`,
    '',
    '[admin_origin_smoke]',
    `gate=${adminOriginSmoke.gate}`,
    `reason_codes=${adminOriginSmoke.reasonCodes.join(',')}`,
    `summary_line=${adminOriginSmoke.summaryLine}`,
    '',
    '[admin_origin_smoke_trend]',
    `gate=${adminOriginSmokeTrend.gate}`,
    `reason_codes=${adminOriginSmokeTrend.reasonCodes.join(',')}`,
    `info_codes=${(adminOriginSmokeTrend.infoCodes || []).join(',')}`,
    `window_size=${adminOriginSmokeTrend.windowSize}`,
    `rows_in_window=${adminOriginSmokeTrend.rowsInWindow}`,
    `fail_rows=${adminOriginSmokeTrend.failRows}`,
    `pass_rows=${adminOriginSmokeTrend.passRows}`,
    `skipped_rows=${adminOriginSmokeTrend.skippedRows}`,
    `unknown_rows=${adminOriginSmokeTrend.unknownRows}`,
    `summary_line=${adminOriginSmokeTrend.summaryLine}`,
    '',
    '[billing_admin_smoke]',
    `gate=${billingAdminSmoke.gate}`,
    `reason_codes=${billingAdminSmoke.reasonCodes.join(',')}`,
    `summary_line=${billingAdminSmoke.summaryLine}`,
    '',
    '[billing_admin_smoke_trend]',
    `gate=${billingAdminSmokeTrend.gate}`,
    `reason_codes=${billingAdminSmokeTrend.reasonCodes.join(',')}`,
    `info_codes=${(billingAdminSmokeTrend.infoCodes || []).join(',')}`,
    `window_size=${billingAdminSmokeTrend.windowSize}`,
    `rows_in_window=${billingAdminSmokeTrend.rowsInWindow}`,
    `fail_rows=${billingAdminSmokeTrend.failRows}`,
    `pass_rows=${billingAdminSmokeTrend.passRows}`,
    `skipped_rows=${billingAdminSmokeTrend.skippedRows}`,
    `unknown_rows=${billingAdminSmokeTrend.unknownRows}`,
    `summary_line=${billingAdminSmokeTrend.summaryLine}`,
    '',
    '[data_encryption_smoke]',
    `gate=${dataEncryptionSmoke.gate}`,
    `reason_codes=${dataEncryptionSmoke.reasonCodes.join(',')}`,
    `summary_line=${dataEncryptionSmoke.summaryLine}`,
    '',
    '[data_encryption_smoke_trend]',
    `gate=${dataEncryptionSmokeTrend.gate}`,
    `reason_codes=${dataEncryptionSmokeTrend.reasonCodes.join(',')}`,
    `info_codes=${(dataEncryptionSmokeTrend.infoCodes || []).join(',')}`,
    `window_size=${dataEncryptionSmokeTrend.windowSize}`,
    `rows_in_window=${dataEncryptionSmokeTrend.rowsInWindow}`,
    `fail_rows=${dataEncryptionSmokeTrend.failRows}`,
    `pass_rows=${dataEncryptionSmokeTrend.passRows}`,
    `skipped_rows=${dataEncryptionSmokeTrend.skippedRows}`,
    `unknown_rows=${dataEncryptionSmokeTrend.unknownRows}`,
    `summary_line=${dataEncryptionSmokeTrend.summaryLine}`,
    '',
    '[stack_trend]',
    `gate=${stackTrend.gate}`,
    `reason_codes=${stackTrend.reasonCodes.join(',')}`,
    `window_size=${stackTrend.windowSize}`,
    `rows_in_window=${stackTrend.rowsInWindow}`,
    `not_ready_rows=${stackTrend.notReadyRows}`,
    `health_fail_rows=${stackTrend.healthFailRows}`,
    `summary_line=${stackTrend.summaryLine}`,
    '',
    '[crypto_rotation_latest]',
    `status=${cryptoKv.status || ''}`,
    `strict=${cryptoKv.strict || ''}`,
    `dry_run=${cryptoKv.dry_run || ''}`,
    `secrets_key_id=${cryptoKv.secrets_key_id || ''}`,
    `data_key_id=${cryptoKv.data_key_id || ''}`,
  ];

  const latestOut = path.join(auditsDir, 'post-start-diagnostics-latest.txt');
  const tsOut = path.join(auditsDir, `post-start-diagnostics-${timestamp}.txt`);
  const content = `${lines.join('\n')}\n`;
  fs.writeFileSync(latestOut, content, 'utf8');
  fs.writeFileSync(tsOut, content, 'utf8');

  process.stdout.write(`[post-start-diagnostics] verdict=${verdict.verdict}\n`);
  process.stdout.write(`[post-start-diagnostics] post_start_severity=${postStartSeverity}\n`);
  process.stdout.write(`[post-start-diagnostics] summary=${postStartSummaryLine}\n`);
  process.stdout.write(
    `[post-start-diagnostics] startup_runtime_correlation_mode=${startupRuntimeCorrelation.mode}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] startup_runtime_correlation_startup_gate=${startupRuntimeCorrelation.startupGate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] startup_runtime_correlation_runtime_gate=${startupRuntimeCorrelation.runtimeGate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] startup_runtime_correlation_summary=${startupRuntimeCorrelation.summaryLine}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] reason=${verdict.reason}\n`);
  process.stdout.write(`[post-start-diagnostics] reason_codes=${verdict.reasonCodes.join(',')}\n`);
  process.stdout.write(
    `[post-start-diagnostics] reason_levels=${verdict.reasonLevels.join(',')}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] readiness_gate=${verdict.readinessGate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] readiness_reason_codes=${verdict.readinessReasonCodes.join(',')}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] runtime_gate=${verdict.runtimeGate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] runtime_reason_codes=${verdict.runtimeReasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] runtime_hotspot_gate=${runtimeHotspot.runtimeHotspotGate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] runtime_hotspot_flags=${runtimeHotspot.runtimeHotspotFlags.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] runtime_hotspot_fail_flags=${runtimeHotspot.runtimeHotspotFailFlags.join(',')}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] runtime_trend_gate=${runtimeTrend.gate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] runtime_trend_reason_codes=${runtimeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] runtime_trend_summary=${runtimeTrend.summaryLine}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] agent_flow_gate=${agentFlow.gate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] agent_flow_reason_codes=${agentFlow.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] agent_flow_summary=${agentFlow.summaryLine}\n`);
  process.stdout.write(`[post-start-diagnostics] agent_flow_trend_gate=${agentFlowTrend.gate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] agent_flow_trend_reason_codes=${agentFlowTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] agent_flow_trend_summary=${agentFlowTrend.summaryLine}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] vmops_sse_flow_gate=${vmOpsSseFlow.gate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] vmops_sse_flow_reason_codes=${vmOpsSseFlow.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] vmops_sse_flow_summary=${vmOpsSseFlow.summaryLine}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] vmops_sse_flow_trend_gate=${vmOpsSseFlowTrend.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] vmops_sse_flow_trend_reason_codes=${vmOpsSseFlowTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] vmops_sse_flow_trend_summary=${vmOpsSseFlowTrend.summaryLine}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] stack_trend_gate=${stackTrend.gate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] stack_trend_reason_codes=${stackTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] stack_trend_summary=${stackTrend.summaryLine}\n`);
  process.stdout.write(`[post-start-diagnostics] smoke_trend_gate=${smokeTrend.gate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] smoke_trend_reason_codes=${smokeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] smoke_trend_info_codes=${(smokeTrend.infoCodes || []).join(',')}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] smoke_trend_summary=${smokeTrend.summaryLine}\n`);
  process.stdout.write(
    `[post-start-diagnostics] tenant_isolation_smoke_gate=${tenantIsolationSmoke.tenantGate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] tenant_isolation_smoke_reason_codes=${tenantIsolationSmoke.tenantReasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] agents_tenant_isolation_smoke_gate=${tenantIsolationSmoke.agentsGate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] agents_tenant_isolation_smoke_reason_codes=${tenantIsolationSmoke.agentsReasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] tenant_isolation_smoke_summary=${tenantIsolationSmoke.summaryLine}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] tenant_isolation_smoke_trend_gate=${tenantIsolationSmokeTrend.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] tenant_isolation_smoke_trend_reason_codes=${tenantIsolationSmokeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] tenant_isolation_smoke_trend_summary=${tenantIsolationSmokeTrend.summaryLine}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] agents_tenant_isolation_smoke_trend_gate=${agentsTenantIsolationSmokeTrend.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] agents_tenant_isolation_smoke_trend_reason_codes=${agentsTenantIsolationSmokeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] agents_tenant_isolation_smoke_trend_summary=${agentsTenantIsolationSmokeTrend.summaryLine}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] auth_access_smoke_gate=${authAccessSmoke.gate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] auth_access_smoke_reason_codes=${authAccessSmoke.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] auth_access_smoke_trend_gate=${authAccessSmokeTrend.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] auth_access_smoke_trend_reason_codes=${authAccessSmokeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] settings_surface_smoke_gate=${settingsSurfaceSmoke.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] settings_surface_smoke_reason_codes=${settingsSurfaceSmoke.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] settings_surface_smoke_trend_gate=${settingsSurfaceSmokeTrend.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] settings_surface_smoke_trend_reason_codes=${settingsSurfaceSmokeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] admin_rbac_smoke_gate=${adminRbacSmoke.gate}\n`);
  process.stdout.write(
    `[post-start-diagnostics] admin_rbac_smoke_reason_codes=${adminRbacSmoke.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] admin_rbac_smoke_trend_gate=${adminRbacSmokeTrend.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] admin_rbac_smoke_trend_reason_codes=${adminRbacSmokeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] admin_origin_smoke_gate=${adminOriginSmoke.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] admin_origin_smoke_reason_codes=${adminOriginSmoke.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] admin_origin_smoke_trend_gate=${adminOriginSmokeTrend.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] admin_origin_smoke_trend_reason_codes=${adminOriginSmokeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] billing_admin_smoke_gate=${billingAdminSmoke.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] billing_admin_smoke_reason_codes=${billingAdminSmoke.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] billing_admin_smoke_trend_gate=${billingAdminSmokeTrend.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] billing_admin_smoke_trend_reason_codes=${billingAdminSmokeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] data_encryption_smoke_gate=${dataEncryptionSmoke.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] data_encryption_smoke_reason_codes=${dataEncryptionSmoke.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] data_encryption_smoke_trend_gate=${dataEncryptionSmokeTrend.gate}\n`,
  );
  process.stdout.write(
    `[post-start-diagnostics] data_encryption_smoke_trend_reason_codes=${dataEncryptionSmokeTrend.reasonCodes.join(',')}\n`,
  );
  process.stdout.write(`[post-start-diagnostics] latest=${path.relative(repoRoot, latestOut)}\n`);
  process.stdout.write(`[post-start-diagnostics] timestamped=${path.relative(repoRoot, tsOut)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `[post-start-diagnostics] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
