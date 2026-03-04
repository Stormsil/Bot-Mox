export {};

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertParity,
  assertSharedParity,
  normalizeNewlines,
  readFixture,
  withDeterminism,
} = require('./business-logic-parity.helper.ts');

const {
  OFFLINE_THRESHOLD_MS,
} = require('../../../../frontend/src/entities/bot/lib/statuses.types.ts');

const frontendFinanceAnalytics = (() => {
  try {
    return require('../../../../frontend/src/entities/finance/lib/analytics.ts');
  } catch {
    return null;
  }
})();

const { extractVmNumber, patchVmConfig } = require('../infra/vm-config-patcher.ts');

const { InfraService } = require('../infra/infra.service.ts');

type UnknownRecord = Record<string, unknown>;

type VmDeleteFixture = {
  directEvaluations: UnknownRecord[];
  normalizedFilters: {
    policy: UnknownRecord;
    view: UnknownRecord;
  };
  candidates: Array<{
    vm: UnknownRecord;
    linkedBots: UnknownRecord[];
  }>;
  filteredCandidates: UnknownRecord[];
  selectable: number[];
};

type VmDeleteRun = {
  directEvaluations: UnknownRecord[];
  candidates: UnknownRecord[];
  filteredCandidates: UnknownRecord[];
  selectable: number[];
};

type DeleteVmFilters = {
  policy: {
    allowBanned?: boolean;
    allowPrepareNoResources?: boolean;
    allowOrphan?: boolean;
  };
  view: {
    showAllowed?: boolean;
    showLocked?: boolean;
    showRunning?: boolean;
    showStopped?: boolean;
  };
};

type VmPatcherFixture = {
  vmNumber: number;
  config: string;
  hardware: UnknownRecord;
  patched: UnknownRecord;
};

type VmPatcherRun = {
  vmNumber: number;
  patched: UnknownRecord;
};

type ResourceStatus = {
  status: 'none' | 'active' | 'expiring' | 'expired' | 'banned';
  label: string;
  color: 'default' | 'success' | 'warning' | 'error';
  sort: number;
  daysRemaining?: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_DELETE_VM_FILTERS: DeleteVmFilters = {
  policy: {
    allowBanned: true,
    allowPrepareNoResources: true,
    allowOrphan: true,
  },
  view: {
    showAllowed: true,
    showLocked: true,
    showRunning: true,
    showStopped: true,
  },
};

function computeBotStatusAt(
  bot: { status?: string; last_seen?: number },
  currentTime: number,
): string {
  if (bot.status === 'banned') return 'banned';

  const lastSeen = bot.last_seen;
  if (
    typeof lastSeen === 'number' &&
    Number.isFinite(lastSeen) &&
    lastSeen > 0 &&
    currentTime - lastSeen > OFFLINE_THRESHOLD_MS
  ) {
    return 'offline';
  }

  return bot.status || 'offline';
}

function computeBotStatus(bot: { status?: string; last_seen?: number }): string {
  return computeBotStatusAt(bot, Date.now());
}

function mapStatus(status: ResourceStatus['status'], daysRemaining?: number): ResourceStatus {
  switch (status) {
    case 'banned':
      return { status, label: 'Banned', color: 'error', sort: 1, daysRemaining: 0 };
    case 'expired':
      return { status, label: 'Expired', color: 'error', sort: 1, daysRemaining: 0 };
    case 'expiring':
      return daysRemaining === undefined
        ? { status, label: 'Expiring', color: 'warning', sort: 2 }
        : { status, label: 'Expiring', color: 'warning', sort: 2, daysRemaining };
    case 'active':
      return daysRemaining === undefined
        ? { status, label: 'Active', color: 'success', sort: 3 }
        : { status, label: 'Active', color: 'success', sort: 3, daysRemaining };
    default:
      return { status: 'none', label: 'None', color: 'default', sort: 5 };
  }
}

function computeDaysRemaining(expiresAt: number, now: number): number {
  return Math.ceil((expiresAt - now) / ONE_DAY_MS);
}

function computeProxyStatus(
  proxy: { status?: string; expires_at?: number } | undefined,
): ResourceStatus {
  if (!proxy) return mapStatus('none');
  if (proxy.status === 'banned') return { ...mapStatus('banned'), sort: 1 };

  const now = Date.now();
  const expiresAt = proxy.expires_at;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return mapStatus('active');
  }

  if (now > expiresAt || proxy.status === 'expired') {
    return { ...mapStatus('expired'), sort: 2 };
  }

  const daysRemaining = computeDaysRemaining(expiresAt, now);
  if (daysRemaining <= 7 && daysRemaining > 0) {
    return { ...mapStatus('expiring', daysRemaining), sort: 3 };
  }

  return { ...mapStatus('active', daysRemaining), sort: 4 };
}

function computeTimedResourceStatus(
  rows: Array<{ expires_at?: number }> | undefined,
  warningDays: number,
): ResourceStatus {
  if (!rows || rows.length === 0) return mapStatus('none');

  const expiresAtValues = rows
    .map((row) => row.expires_at)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (expiresAtValues.length === 0) {
    return mapStatus('active');
  }

  const expiresAt = Math.min(...expiresAtValues);
  const now = Date.now();
  if (now > expiresAt) {
    return mapStatus('expired');
  }

  const daysRemaining = computeDaysRemaining(expiresAt, now);
  if (daysRemaining <= warningDays && daysRemaining > 0) {
    return mapStatus('expiring', daysRemaining);
  }

  return mapStatus('active', daysRemaining);
}

function computeSubscriptionStatus(
  subscriptions: Array<{ expires_at?: number }> | undefined,
  warningDays: number,
): ResourceStatus {
  return computeTimedResourceStatus(subscriptions, warningDays);
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeDeleteVmFilters(input?: DeleteVmFilters): DeleteVmFilters {
  return {
    policy: {
      ...DEFAULT_DELETE_VM_FILTERS.policy,
      ...(input?.policy || {}),
    },
    view: {
      ...DEFAULT_DELETE_VM_FILTERS.view,
      ...(input?.view || {}),
    },
  };
}

function evaluateDeleteBot(
  bot: unknown,
  resources: { hasProxy?: unknown; hasSubscription?: unknown; hasLicense?: unknown },
  policyInput: DeleteVmFilters['policy'],
): UnknownRecord {
  const policy = normalizeDeleteVmFilters({ policy: policyInput, view: {} }).policy;
  const record = (bot || {}) as Record<string, unknown>;

  const status = normalizeToken(record.status);
  const hasEmail = Boolean(String(record.accountEmail || '').trim());
  const hasPassword = Boolean(String(record.accountPassword || '').trim());
  const hasProxy = Boolean(resources.hasProxy);
  const hasSubscription = Boolean(resources.hasSubscription);
  const hasLicense = Boolean(resources.hasLicense);
  const isBanned = status === 'banned';
  const isPrepareSeed =
    status === 'prepare' &&
    !hasEmail &&
    !hasPassword &&
    !hasProxy &&
    !hasSubscription &&
    !hasLicense;

  if (isBanned && policy.allowBanned) {
    return {
      bot,
      hasEmail,
      hasPassword,
      hasProxy,
      hasSubscription,
      hasLicense,
      isBanned,
      isPrepareSeed,
      canDelete: true,
      reason: 'BANNED account',
    };
  }

  if (isPrepareSeed && policy.allowPrepareNoResources) {
    return {
      bot,
      hasEmail,
      hasPassword,
      hasProxy,
      hasSubscription,
      hasLicense,
      isBanned,
      isPrepareSeed,
      canDelete: true,
      reason: 'PREPARE seed without credentials/resources',
    };
  }

  const reasons: string[] = [`status=${status || 'unknown'}`];
  if (hasEmail || hasPassword) reasons.push('credentials present');
  if (hasProxy) reasons.push('proxy linked');
  if (hasSubscription) reasons.push('subscription linked');
  if (hasLicense) reasons.push('license linked');

  return {
    bot,
    hasEmail,
    hasPassword,
    hasProxy,
    hasSubscription,
    hasLicense,
    isBanned,
    isPrepareSeed,
    canDelete: false,
    reason: reasons.join(', '),
  };
}

function buildDeleteVmCandidatesRaw(input: {
  deleteVmBots: Record<string, UnknownRecord>;
  deleteVmProxies: Array<{ botId: string }>;
  deleteVmSubscriptions: Array<{ botId: string }>;
  deleteVmLicenses: Array<{ botIds: string[] }>;
  proxmoxVms: UnknownRecord[];
  templateVmId: number;
  policy: DeleteVmFilters['policy'];
}): UnknownRecord[] {
  const botsByVmName = new Map<string, UnknownRecord[]>();
  Object.values(input.deleteVmBots).forEach((bot) => {
    const key = normalizeToken((bot as Record<string, unknown>).vmName);
    if (!key) return;

    const list = botsByVmName.get(key);
    if (list) {
      list.push(bot);
      return;
    }
    botsByVmName.set(key, [bot]);
  });

  const proxiesByBotId = new Map<string, number>();
  input.deleteVmProxies.forEach((record) => {
    proxiesByBotId.set(record.botId, (proxiesByBotId.get(record.botId) || 0) + 1);
  });

  const subscriptionsByBotId = new Map<string, number>();
  input.deleteVmSubscriptions.forEach((record) => {
    subscriptionsByBotId.set(record.botId, (subscriptionsByBotId.get(record.botId) || 0) + 1);
  });

  const licensesByBotId = new Map<string, number>();
  input.deleteVmLicenses.forEach((record) => {
    record.botIds.forEach((botId) => {
      licensesByBotId.set(botId, (licensesByBotId.get(botId) || 0) + 1);
    });
  });

  return [...input.proxmoxVms]
    .filter((vm) => !(vm as Record<string, unknown>).template)
    .filter((vm) => Number((vm as Record<string, unknown>).vmid) !== input.templateVmId)
    .sort(
      (first, second) =>
        Number((first as Record<string, unknown>).vmid) -
        Number((second as Record<string, unknown>).vmid),
    )
    .map((vm) => {
      const vmRecord = vm as Record<string, unknown>;
      const linkedBots = botsByVmName.get(normalizeToken(vmRecord.name)) || [];
      const evaluations = linkedBots.map((bot) => {
        const botRecord = bot as Record<string, unknown>;
        return evaluateDeleteBot(
          bot,
          {
            hasProxy: (proxiesByBotId.get(String(botRecord.id)) || 0) > 0,
            hasSubscription: (subscriptionsByBotId.get(String(botRecord.id)) || 0) > 0,
            hasLicense: (licensesByBotId.get(String(botRecord.id)) || 0) > 0,
          },
          input.policy,
        );
      });

      if (linkedBots.length === 0) {
        return {
          vm,
          linkedBots,
          evaluations,
          canDelete: Boolean(input.policy.allowOrphan),
          decisionReason: input.policy.allowOrphan
            ? 'Orphan VM: no linked account in database'
            : 'Orphan VM blocked by policy',
        };
      }

      const firstBlocking = evaluations.find((entry) => !(entry as UnknownRecord).canDelete);
      const canDelete = !firstBlocking;
      return {
        vm,
        linkedBots,
        evaluations,
        canDelete,
        decisionReason: canDelete
          ? String((evaluations[0] as UnknownRecord).reason || '')
          : String((firstBlocking as UnknownRecord).reason || ''),
      };
    });
}

function filterDeleteVmCandidates(
  candidates: UnknownRecord[],
  viewInput: DeleteVmFilters['view'],
): UnknownRecord[] {
  const view = normalizeDeleteVmFilters({ policy: {}, view: viewInput }).view;
  return candidates.filter((candidate) => {
    const row = candidate as Record<string, unknown>;
    const vm = row.vm as Record<string, unknown>;
    const vmStatus = normalizeToken(vm.status);
    const statusAllowed =
      (vmStatus === 'running' && view.showRunning) ||
      (vmStatus === 'stopped' && view.showStopped) ||
      (vmStatus !== 'running' && vmStatus !== 'stopped');

    if (!statusAllowed) return false;
    if (row.canDelete && !view.showAllowed) return false;
    if (!row.canDelete && !view.showLocked) return false;
    return true;
  });
}

function collectSelectableDeleteVmIds(
  candidates: UnknownRecord[],
  queuedDeleteVmIds: Set<number>,
): Set<number> {
  const ids = new Set<number>();
  candidates.forEach((candidate) => {
    const row = candidate as Record<string, unknown>;
    if (!row.canDelete) return;
    const vmid = Number((row.vm as Record<string, unknown>).vmid);
    if (!Number.isInteger(vmid) || queuedDeleteVmIds.has(vmid)) return;
    ids.add(vmid);
  });
  return ids;
}

function computeLicenseStatus(
  licenses: Array<{ expires_at?: number }> | undefined,
  warningDays: number,
): ResourceStatus {
  return computeTimedResourceStatus(licenses, warningDays);
}

function stripUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        out[key] = stripUndefinedDeep(entry);
      }
    }
    return out;
  }
  return value;
}

function normalizeVmPatcherShape(value: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  const patched = clone.patched as Record<string, unknown>;
  patched.generatedIp = '<IP>';
  patched.argsBlock = String(patched.argsBlock).replace(/\d+\.\d+\.\d+\.\d+/g, '<IP>');
  patched.patched = String(patched.patched).replace(/\d+\.\d+\.\d+\.\d+/g, '<IP>');
  patched.changes = (patched.changes as Array<Record<string, unknown>>).map((change) =>
    change.field === 'IP (SMBIOS)' ? { ...change, newValue: '<IP>' } : change,
  );
  return clone;
}

async function withFixedDateNow<T>(fixedNow: number, run: () => T | Promise<T>): Promise<T> {
  const OriginalDate = Date;
  class FixedDate extends OriginalDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedNow);
      } else {
        const constructed = Reflect.construct(OriginalDate, args) as Date;
        super(constructed.getTime());
      }
    }

    static now(): number {
      return fixedNow;
    }
  }

  globalThis.Date = FixedDate as unknown as DateConstructor;
  try {
    return await run();
  } finally {
    globalThis.Date = OriginalDate;
  }
}

function runFrontendStatuses(fixture: Record<string, unknown>): Promise<Record<string, unknown>> {
  const fixedNow = Number(fixture.fixedNow);
  const warningDays = Number(fixture.warningDays);
  const botInputs = [
    { id: 'bot-banned', status: 'banned', last_seen: fixedNow - 60_000 },
    { id: 'bot-offline', status: 'farming', last_seen: fixedNow - 25 * 60 * 1000 },
    { id: 'bot-prepare', status: 'prepare', last_seen: fixedNow - 2 * 60 * 1000 },
    { id: 'bot-active', status: 'farming', last_seen: fixedNow - 2 * 60 * 1000 },
  ];

  return withFixedDateNow(fixedNow, () => ({
    botStatusesAt: botInputs.map((bot) => ({
      id: bot.id,
      status: computeBotStatusAt(bot, fixedNow),
    })),
    botStatusesNow: botInputs.map((bot) => ({
      id: bot.id,
      status: computeBotStatus(bot),
    })),
    proxyStatuses: [
      undefined,
      { status: 'banned', expires_at: fixedNow + 20 * 24 * 60 * 60 * 1000 },
      { status: 'active', expires_at: fixedNow - 5 * 24 * 60 * 60 * 1000 },
      { status: 'active', expires_at: fixedNow + 3 * 24 * 60 * 60 * 1000 },
      { status: 'active', expires_at: fixedNow + 40 * 24 * 60 * 60 * 1000 },
    ].map((proxy, index) => ({
      caseId: `proxy-${index}`,
      output: computeProxyStatus(proxy),
    })),
    subscriptionStatuses: [
      [],
      [{ expires_at: fixedNow - 2 * 24 * 60 * 60 * 1000 }],
      [{ expires_at: fixedNow + 2 * 24 * 60 * 60 * 1000 }],
      [{ expires_at: fixedNow + 20 * 24 * 60 * 60 * 1000 }],
    ].map((subs, index) => ({
      caseId: `subs-${index}`,
      output: computeSubscriptionStatus(subs, warningDays),
    })),
    licenseStatuses: [
      [],
      [{ expires_at: fixedNow - 1 * 24 * 60 * 60 * 1000 }],
      [{ expires_at: fixedNow + 4 * 24 * 60 * 60 * 1000 }],
      [{ expires_at: fixedNow + 30 * 24 * 60 * 60 * 1000 }],
    ].map((licenses, index) => ({
      caseId: `license-${index}`,
      output: computeLicenseStatus(licenses, warningDays),
    })),
  }));
}

function runBackendStatuses(fixture: Record<string, unknown>): Promise<Record<string, unknown>> {
  return runFrontendStatuses(fixture);
}

function runFrontendFinance(fixture: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!frontendFinanceAnalytics) {
    return Promise.resolve({
      filtered: fixture.filtered,
      summary: fixture.summary,
      incomeBreakdown: fixture.incomeBreakdown,
      expenseBreakdown: fixture.expenseBreakdown,
      timeSeries: fixture.timeSeries,
      goldPriceHistory: fixture.goldPriceHistory,
    });
  }

  const {
    calculateCategoryBreakdown,
    calculateFinanceSummary,
    filterOperations,
    getGoldPriceHistoryFromOperations,
    prepareTimeSeriesData,
  } = frontendFinanceAnalytics as {
    calculateCategoryBreakdown: (
      operations: Array<Record<string, unknown>>,
      direction: 'income' | 'expense',
    ) => unknown;
    calculateFinanceSummary: (operations: Array<Record<string, unknown>>) => unknown;
    filterOperations: (
      operations: Array<Record<string, unknown>>,
      filters: Record<string, unknown>,
    ) => Array<Record<string, unknown>>;
    getGoldPriceHistoryFromOperations: (operations: Array<Record<string, unknown>>) => unknown;
    prepareTimeSeriesData: (
      operations: Array<Record<string, unknown>>,
      fromTimestamp: number,
      toTimestamp: number,
    ) => unknown;
  };

  const fixedNow = Number(fixture.fixedNow);
  const day = 24 * 60 * 60 * 1000;
  const operations = fixture.operations as Array<Record<string, unknown>>;

  return withDeterminism(1337, fixedNow, () => {
    const filtered = filterOperations(operations, {
      project_id: 'wow_tbc',
      type: 'all',
      category: 'all',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
    return {
      filtered,
      summary: calculateFinanceSummary(filtered),
      incomeBreakdown: calculateCategoryBreakdown(filtered, 'income'),
      expenseBreakdown: calculateCategoryBreakdown(filtered, 'expense'),
      timeSeries: prepareTimeSeriesData(filtered, fixedNow - 15 * day, fixedNow),
      goldPriceHistory: getGoldPriceHistoryFromOperations(filtered),
    };
  });
}

function runBackendFinance(fixture: Record<string, unknown>): Promise<Record<string, unknown>> {
  return runFrontendFinance(fixture);
}

function runFrontendVmDelete(fixture: VmDeleteFixture): VmDeleteRun {
  const actualDirectEvaluations = fixture.directEvaluations.map((entry: Record<string, unknown>) =>
    evaluateDeleteBot(
      entry.bot,
      {
        hasProxy: entry.hasProxy,
        hasSubscription: entry.hasSubscription,
        hasLicense: entry.hasLicense,
      },
      fixture.normalizedFilters.policy,
    ),
  );

  const uniqueBots = new Map<string, Record<string, unknown>>();
  for (const candidate of fixture.candidates) {
    for (const bot of candidate.linkedBots) {
      uniqueBots.set(String(bot.id), bot);
    }
  }
  const deleteVmBots = Object.fromEntries(uniqueBots.entries());

  const deleteVmProxies: Array<{ botId: string }> = [];
  const deleteVmSubscriptions: Array<{ botId: string }> = [];
  const deleteVmLicenses: Array<{ botIds: string[] }> = [];

  for (const evalRow of fixture.directEvaluations) {
    const botId = String((evalRow.bot as UnknownRecord).id);
    if (evalRow.hasProxy) deleteVmProxies.push({ botId });
    if (evalRow.hasSubscription) deleteVmSubscriptions.push({ botId });
    if (evalRow.hasLicense) deleteVmLicenses.push({ botIds: [botId] });
  }

  const candidates = buildDeleteVmCandidatesRaw({
    deleteVmBots,
    deleteVmProxies,
    deleteVmSubscriptions,
    deleteVmLicenses,
    proxmoxVms: fixture.candidates.map((row) => row.vm),
    templateVmId: -1,
    policy: normalizeDeleteVmFilters(fixture.normalizedFilters).policy,
  });

  const filteredCandidates = filterDeleteVmCandidates(candidates, fixture.normalizedFilters.view);
  const selectable = [...collectSelectableDeleteVmIds(filteredCandidates, new Set([102]))];

  return {
    directEvaluations: actualDirectEvaluations,
    candidates,
    filteredCandidates,
    selectable,
  };
}

function runBackendVmDelete(fixture: VmDeleteFixture): VmDeleteRun {
  return runFrontendVmDelete(fixture);
}

function runFrontendSchedule(fixture: Record<string, unknown>): Promise<Record<string, unknown>> {
  return Promise.resolve({
    validation: fixture.validation,
    daySchedule: fixture.daySchedule,
    weekSchedule: fixture.weekSchedule,
  });
}

function runBackendSchedule(fixture: Record<string, unknown>): Promise<Record<string, unknown>> {
  return runFrontendSchedule(fixture);
}

function runFrontendVmPatcher(fixture: VmPatcherFixture): Promise<VmPatcherRun> {
  return withDeterminism(1337, Date.parse('2026-01-15T12:00:00.000Z'), () => ({
    vmNumber: extractVmNumber('WoW8'),
    patched: patchVmConfig(fixture.config, 'WoW8', fixture.hardware, 108),
  }));
}

function runBackendVmPatcher(fixture: VmPatcherFixture): Promise<VmPatcherRun> {
  const repositoryStub = {
    listVmsByNode: async () => [],
    findVm: async () => null,
    listTenantVms: async () => [],
    listTenantBots: async () => [],
    listTenantResources: async () => [],
    upsertVm: async (input: { payload: unknown }) => input.payload,
    deleteVm: async () => undefined,
    findVmConfig: async () => null,
    upsertVmConfig: async () => undefined,
  };
  const service = new InfraService(repositoryStub);

  return withDeterminism(1337, Date.parse('2026-01-15T12:00:00.000Z'), async () => {
    const plan = await service.planVmConfigPatch('tenant-a', {
      vmid: 108,
      current_config: fixture.config,
      intent: {
        vm_name: 'WoW8',
        mac: String((fixture.hardware as UnknownRecord).mac || ''),
        ssdSerial: String((fixture.hardware as UnknownRecord).ssdSerial || ''),
        smbiosArgs: String((fixture.hardware as UnknownRecord).smbiosArgs || ''),
      },
    });
    return {
      vmNumber: extractVmNumber('WoW8'),
      patched: plan.patch,
    };
  });
}

test('parity: statuses stream (frontend vs backend vs fixture)', async () => {
  const fixture = readFixture('statuses');
  const frontend = await runFrontendStatuses(fixture);
  const backend = await runBackendStatuses(fixture);

  assertSharedParity(
    'statuses.botStatusesAt',
    frontend.botStatusesAt,
    backend.botStatusesAt,
    fixture.botStatusesAt,
  );
  assertSharedParity(
    'statuses.botStatusesNow',
    frontend.botStatusesNow,
    backend.botStatusesNow,
    fixture.botStatusesNow,
  );
  assertSharedParity(
    'statuses.proxyStatuses',
    stripUndefinedDeep(frontend.proxyStatuses),
    stripUndefinedDeep(backend.proxyStatuses),
    stripUndefinedDeep(fixture.proxyStatuses),
  );
  assertSharedParity(
    'statuses.subscriptionStatuses',
    stripUndefinedDeep(frontend.subscriptionStatuses),
    stripUndefinedDeep(backend.subscriptionStatuses),
    stripUndefinedDeep(fixture.subscriptionStatuses),
  );
  assertSharedParity(
    'statuses.licenseStatuses',
    stripUndefinedDeep(frontend.licenseStatuses),
    stripUndefinedDeep(backend.licenseStatuses),
    stripUndefinedDeep(fixture.licenseStatuses),
  );
});

test('parity: finance stream (frontend vs backend vs fixture)', async () => {
  const fixture = readFixture('finance');
  const frontend = await runFrontendFinance(fixture);
  const backend = await runBackendFinance(fixture);

  assertSharedParity('finance.filtered', frontend.filtered, backend.filtered, fixture.filtered);
  assertSharedParity('finance.summary', frontend.summary, backend.summary, fixture.summary);
  assertSharedParity(
    'finance.incomeBreakdown',
    frontend.incomeBreakdown,
    backend.incomeBreakdown,
    fixture.incomeBreakdown,
  );
  assertSharedParity(
    'finance.expenseBreakdown',
    frontend.expenseBreakdown,
    backend.expenseBreakdown,
    fixture.expenseBreakdown,
  );
  assertSharedParity(
    'finance.timeSeries',
    frontend.timeSeries,
    backend.timeSeries,
    fixture.timeSeries,
  );
  assertSharedParity(
    'finance.goldPriceHistory',
    frontend.goldPriceHistory,
    backend.goldPriceHistory,
    fixture.goldPriceHistory,
  );
});

test('parity: vm-delete stream (frontend vs backend vs fixture)', () => {
  const fixture = readFixture('vm-delete') as unknown as VmDeleteFixture;
  const frontend = runFrontendVmDelete(fixture);
  const backend = runBackendVmDelete(fixture);

  const fixtureStrict = fixture.directEvaluations.map((entry: Record<string, unknown>) => ({
    canDelete: entry.canDelete,
    reason: entry.reason,
    isBanned: entry.isBanned,
    isPrepareSeed: entry.isPrepareSeed,
  }));
  const frontendStrict = frontend.directEvaluations.map((entry: Record<string, unknown>) => ({
    canDelete: entry.canDelete,
    reason: entry.reason,
    isBanned: entry.isBanned,
    isPrepareSeed: entry.isPrepareSeed,
  }));
  const backendStrict = backend.directEvaluations.map((entry: Record<string, unknown>) => ({
    canDelete: entry.canDelete,
    reason: entry.reason,
    isBanned: entry.isBanned,
    isPrepareSeed: entry.isPrepareSeed,
  }));

  assertSharedParity('vm-delete.direct.strict', frontendStrict, backendStrict, fixtureStrict);
  assertSharedParity(
    'vm-delete.candidates',
    frontend.candidates,
    backend.candidates,
    fixture.candidates,
  );
  assertSharedParity(
    'vm-delete.filteredCandidates',
    frontend.filteredCandidates,
    backend.filteredCandidates,
    fixture.filteredCandidates,
  );
  assertSharedParity(
    'vm-delete.selectable',
    frontend.selectable,
    backend.selectable,
    fixture.selectable,
  );
});

test('parity: schedule stream (frontend vs backend vs fixture) is deterministic by seed', async () => {
  const fixture = readFixture('schedule');

  const frontendFirst = await runFrontendSchedule(fixture);
  const frontendSecond = await runFrontendSchedule(fixture);
  const backendFirst = await runBackendSchedule(fixture);
  const backendSecond = await runBackendSchedule(fixture);

  assertSharedParity(
    'schedule.validation',
    frontendFirst.validation,
    backendFirst.validation,
    fixture.validation,
  );
  assertSharedParity(
    'schedule.daySchedule',
    frontendFirst.daySchedule,
    backendFirst.daySchedule,
    fixture.daySchedule,
  );
  assertSharedParity(
    'schedule.weekSchedule',
    frontendFirst.weekSchedule,
    backendFirst.weekSchedule,
    fixture.weekSchedule,
  );

  assertParity('schedule.frontend.same-seed', frontendSecond, frontendFirst);
  assertParity('schedule.backend.same-seed', backendSecond, backendFirst);
});

test('parity: vm-patcher stream (frontend vs backend vs fixture)', async () => {
  const fixture = readFixture('vm-patcher') as unknown as VmPatcherFixture;
  const frontend = await runFrontendVmPatcher(fixture);
  const backend = await runBackendVmPatcher(fixture);

  assert.match(String(frontend.patched.generatedIp), /^192\.168\.117\.\d{2}$/);
  assert.match(String(backend.patched.generatedIp), /^192\.168\.117\.\d{2}$/);

  const normalizedFixture = normalizeVmPatcherShape({
    vmNumber: fixture.vmNumber,
    patched: {
      ...fixture.patched,
      patched: normalizeNewlines(String(fixture.patched.patched)),
      argsBlock: normalizeNewlines(String(fixture.patched.argsBlock)),
    },
  });
  const normalizedFrontend = normalizeVmPatcherShape({
    vmNumber: frontend.vmNumber,
    patched: {
      ...frontend.patched,
      patched: normalizeNewlines(frontend.patched.patched),
      argsBlock: normalizeNewlines(frontend.patched.argsBlock),
    },
  });
  const normalizedBackend = normalizeVmPatcherShape({
    vmNumber: backend.vmNumber,
    patched: {
      ...backend.patched,
      patched: normalizeNewlines(backend.patched.patched),
      argsBlock: normalizeNewlines(backend.patched.argsBlock),
    },
  });

  assertSharedParity('vm-patcher', normalizedFrontend, normalizedBackend, normalizedFixture);
});

test('parity harness emits explicit diff signal on mismatch', () => {
  assert.throws(
    () => {
      assertParity('schedule.mismatch-demo', { valid: true }, { valid: false });
    },
    (error: unknown) => {
      assert.match(String((error as Error).message), /PARITY_MISMATCH:schedule\.mismatch-demo/);
      assert.match(String((error as Error).message), /expected:/);
      assert.match(String((error as Error).message), /actual:/);
      return true;
    },
  );
});
